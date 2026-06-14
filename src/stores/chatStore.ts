import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChatMessage, ChatToolEvent } from '../types'
import { resolveApiUrl } from '../services/apiClient'
import { useApiConfigStore } from './apiConfigStore'
import { useTreeStore } from './treeStore'

type ChatStreamEvent =
  | { type: 'start'; bid?: string; filename?: string; model?: string; session_id?: string }
  | { type: 'text' | 'reasoning'; text?: string }
  | { type: 'tool_call'; id?: string; name?: string; arguments?: unknown }
  | { type: 'tool_result'; id?: string; name?: string; ok?: boolean; content?: unknown }
  | { type: 'done'; answer?: string; turns?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; session_id?: string }
  | { type: 'error'; message?: string }
  | { type: 'debug'; event?: string }

export interface ChatSessionSummary {
  id: string
  bid: string
  model: string
  title: string
  turn_count: number
  created_at: string
  updated_at: string
}

interface ChatSessionTurn {
  session_id: string
  turn_idx: number
  role: 'user' | 'assistant'
  text?: string | null
  tool_calls?: string | Array<{ id?: string; name?: string; arguments?: unknown }> | null
  tool_results?: string | Array<{ id?: string; name?: string; ok?: boolean; content?: unknown }> | null
  created_at: string
}

function formatChatError(err: unknown, baseUrl: string) {
  const rawMessage = err instanceof Error ? err.message : String(err || '')
  if (rawMessage === 'Load failed' || rawMessage === 'Failed to fetch') {
    return `Chat 失败：无法连接 API 服务。请确认后端已启动，地址为 ${baseUrl}，并且已支持 POST /api/chat。`
  }
  return `Chat 失败：${rawMessage || '未知错误'}`
}

function toolEventId(event: { id?: string; name?: string }) {
  return event.id || event.name || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function compactText(text: string, maxLength = 180) {
  const compacted = text.replace(/\s+/g, ' ').trim()
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}...` : compacted
}

function stringifyToolPayload(value: unknown) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseJsonList<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function formatSessionError(err: unknown, action: string, baseUrl: string) {
  const rawMessage = err instanceof Error ? err.message : String(err || '')
  if (rawMessage === 'Load failed' || rawMessage === 'Failed to fetch') {
    return `${action}失败：无法连接 API 服务。请确认后端已启动，地址为 ${baseUrl}。`
  }
  return `${action}失败：${rawMessage || '未知错误'}`
}

function withQuery(url: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const queryString = query.toString()
  return queryString ? `${url}?${queryString}` : url
}

function ensureTextPart(message: ChatMessage) {
  if (!message.parts) {
    message.parts = [{ id: `${message.id}-text-0`, type: 'text', content: message.content }]
  }
  const lastPart = message.parts[message.parts.length - 1]
  if (lastPart?.type === 'text') return lastPart
  const nextPart = { id: `${message.id}-text-${message.parts.length}`, type: 'text' as const, content: '' }
  message.parts.push(nextPart)
  return nextPart
}

function findToolEvent(message: ChatMessage, id: string, name?: string) {
  return message.toolEvents?.find(item => item.id === id || item.name === name)
}

function findToolPart(message: ChatMessage, tool: ChatToolEvent) {
  return message.parts?.find(part => (
    part.type === 'tool' && (part.toolEvent.id === tool.id || part.toolEvent.name === tool.name)
  ))
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const inputText = ref('')
  const isSending = ref(false)
  const currentSessionId = ref<string | null>(null)
  const currentSessionBid = ref<string | null>(null)
  const sessions = ref<ChatSessionSummary[]>([])
  const sessionsLoading = ref(false)
  const sessionsError = ref<string | null>(null)
  const turnsLoading = ref(false)
  const selectedSessionId = ref<string | null>(null)

  const sessionsGuard = computed(() => {
    if (sessionsLoading.value) {
      return { status: 'loading' as const, title: '正在加载聊天记录', description: '从后端读取最近的对话会话。' }
    }
    if (sessionsError.value) {
      return { status: 'error' as const, title: '聊天记录加载失败', description: sessionsError.value }
    }
    if (!sessions.value.length) {
      return { status: 'empty' as const, title: '暂无聊天记录', description: '当前知识库还没有对话记录。' }
    }
    return { status: 'ready' as const, title: '聊天记录已就绪', description: `${sessions.value.length} 个对话` }
  })

  function updateMessage(id: string, updater: (message: ChatMessage) => void) {
    const message = messages.value.find(item => item.id === id)
    if (message) updater(message)
  }

  function applyChatEvent(messageId: string, event: ChatStreamEvent) {
    if (event.type === 'start') {
      if (event.session_id) currentSessionId.value = event.session_id
      if (event.bid) currentSessionBid.value = event.bid
      updateMessage(messageId, message => {
        if (event.filename) message.sourceRef = event.filename
      })
      return
    }

    if (event.type === 'text' && event.text) {
      updateMessage(messageId, message => {
        message.content += event.text
        ensureTextPart(message).content += event.text
      })
      return
    }

    if (event.type === 'done' && event.answer) {
      if (event.session_id) currentSessionId.value = event.session_id
      updateMessage(messageId, message => {
        if (!message.content.trim()) {
          message.content = event.answer || ''
          ensureTextPart(message).content = event.answer || ''
        }
      })
      return
    }

    if (event.type === 'tool_call' && event.name) {
      const toolName = event.name
      updateMessage(messageId, message => {
        const id = toolEventId(event)
        const toolEvents = message.toolEvents || []
        const existing = findToolEvent(message, id, toolName)
        if (existing) {
          existing.status = 'running'
          existing.name = toolName
          existing.arguments = stringifyToolPayload(event.arguments) || existing.arguments
        } else {
          const toolEvent: ChatToolEvent = {
            id,
            name: toolName,
            status: 'running',
            arguments: stringifyToolPayload(event.arguments),
          }
          toolEvents.push(toolEvent)
          message.parts ||= []
          message.parts.push({ id: `${message.id}-tool-${id}`, type: 'tool', toolEvent })
          message.parts.push({ id: `${message.id}-text-${message.parts.length}`, type: 'text', content: '' })
        }
        message.toolEvents = toolEvents
      })
      return
    }

    if (event.type === 'tool_result') {
      updateMessage(messageId, message => {
        const id = toolEventId(event)
        const toolEvents = message.toolEvents || []
        const existing = findToolEvent(message, id, event.name)
        const status = event.ok === false ? 'error' : 'done'
        if (existing) {
          existing.status = status
          existing.ok = event.ok
          existing.result = event.content ? compactText(stringifyToolPayload(event.content) || '') : existing.result
          if (event.name) existing.name = event.name
          const toolPart = findToolPart(message, existing)
          if (toolPart?.type === 'tool') toolPart.toolEvent = existing
        } else {
          const toolEvent: ChatToolEvent = {
            id,
            name: event.name || 'retrieval_tool',
            status,
            ok: event.ok,
            result: event.content ? compactText(stringifyToolPayload(event.content) || '') : undefined,
          }
          toolEvents.push(toolEvent)
          message.parts ||= []
          message.parts.push({ id: `${message.id}-tool-${id}`, type: 'tool', toolEvent })
          message.parts.push({ id: `${message.id}-text-${message.parts.length}`, type: 'text', content: '' })
        }
        message.toolEvents = toolEvents
      })
      return
    }

    if (event.type === 'error') {
      throw new Error(event.message || 'Chat stream error')
    }
  }

  async function readChatStream(response: Response, messageId: string) {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Chat response has no readable stream')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
        if (!payload || payload === '[DONE]') continue
        const event = JSON.parse(payload) as ChatStreamEvent

        applyChatEvent(messageId, event)
      }
    }

    const tail = buffer.trim()
    if (tail) {
      const payload = tail.startsWith('data:') ? tail.slice(5).trim() : tail
      if (!payload || payload === '[DONE]') return
      const event = JSON.parse(payload) as ChatStreamEvent
      applyChatEvent(messageId, event)
    }
  }

  async function sendMessage(content: string) {
    const text = content.trim()
    if (!text || isSending.value) return

    const apiConfig = useApiConfigStore()
    const tree = useTreeStore()
    const currentBuild = tree.currentBuild
    const sessionId = currentBuild?.id && currentSessionBid.value === currentBuild.id
      ? currentSessionId.value
      : null

    messages.value.push({
      id: `${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    })

    const aiMessage: ChatMessage = {
      id: `${Date.now() + 1}`,
      role: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
      sourceRef: currentBuild?.filename,
      parts: [{ id: `${Date.now() + 1}-text-0`, type: 'text', content: '' }],
    }
    messages.value.push(aiMessage)

    isSending.value = true
    try {
      const payload = currentBuild?.id
        ? {
          bid: currentBuild.id,
          question: text,
          model: currentBuild.stats?.model || 'deepseek-chat',
          ...(sessionId ? { session_id: sessionId } : {}),
        }
        : {
          question: text,
          model: 'deepseek-chat',
        }

      const response = await fetch(resolveApiUrl(apiConfig, 'chatTree'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`)
      }

      await readChatStream(response, aiMessage.id)
      updateMessage(aiMessage.id, message => {
        if (!message.content.trim()) message.content = 'Chat API 已返回，但没有生成答案文本。'
      })
    } catch (err) {
      updateMessage(aiMessage.id, message => {
        message.role = 'system'
        message.content = formatChatError(err, apiConfig.displayBaseUrl)
        message.sourceRef = undefined
      })
    } finally {
      isSending.value = false
      void loadSessions({ bid: currentBuild?.id, limit: 50 })
    }
  }

  function turnToMessage(turn: ChatSessionTurn): ChatMessage {
    const role = turn.role === 'assistant' ? 'ai' : 'user'
    const content = turn.text || ''
    const message: ChatMessage = {
      id: `${turn.session_id}-${turn.turn_idx}`,
      role,
      content,
      timestamp: turn.created_at,
      parts: [],
    }

    if (role === 'ai') {
      const toolCalls = parseJsonList<{ id?: string; name?: string; arguments?: unknown }>(turn.tool_calls)
      const toolResults = parseJsonList<{ id?: string; name?: string; ok?: boolean; content?: unknown }>(turn.tool_results)
      const toolEvents = toolCalls.map((call, index) => {
        const result = toolResults.find(item => item.id === call.id) || toolResults[index]
        return {
          id: call.id || result?.id || `tc-${index}`,
          name: call.name || result?.name || 'retrieval_tool',
          status: result?.ok === false ? 'error' as const : 'done' as const,
          arguments: stringifyToolPayload(call.arguments),
          result: result?.content ? compactText(stringifyToolPayload(result.content) || '') : undefined,
          ok: result?.ok,
        }
      })
      message.toolEvents = toolEvents
      message.parts = [
        ...toolEvents.map(toolEvent => ({ id: `${message.id}-tool-${toolEvent.id}`, type: 'tool' as const, toolEvent })),
        { id: `${message.id}-text-0`, type: 'text' as const, content },
      ]
    } else {
      message.parts = [{ id: `${message.id}-text-0`, type: 'text', content }]
    }

    return message
  }

  async function loadSessions(options: { bid?: string; limit?: number } = {}) {
    const apiConfig = useApiConfigStore()
    sessionsLoading.value = true
    sessionsError.value = null
    try {
      const response = await fetch(withQuery(resolveApiUrl(apiConfig, 'listChatSessions'), {
        bid: options.bid,
        limit: options.limit || 50,
      }))
      if (!response.ok) throw new Error(`Sessions request failed: ${response.status}`)
      const data = await response.json() as { sessions?: ChatSessionSummary[] }
      sessions.value = data.sessions || []
    } catch (err) {
      sessionsError.value = formatSessionError(err, '加载聊天记录', apiConfig.displayBaseUrl)
      sessions.value = []
    } finally {
      sessionsLoading.value = false
    }
  }

  async function loadSessionTurns(session: ChatSessionSummary, limit = 200) {
    const apiConfig = useApiConfigStore()
    turnsLoading.value = true
    sessionsError.value = null
    try {
      const response = await fetch(withQuery(resolveApiUrl(apiConfig, 'getChatSessionTurns', { sessionId: session.id }), {
        limit,
      }))
      if (!response.ok) throw new Error(`Session turns request failed: ${response.status}`)
      const data = await response.json() as { turns?: ChatSessionTurn[] }
      messages.value = (data.turns || []).map(turnToMessage)
      selectedSessionId.value = session.id
      currentSessionId.value = session.id
      currentSessionBid.value = session.bid
    } catch (err) {
      sessionsError.value = formatSessionError(err, '加载对话消息', apiConfig.displayBaseUrl)
    } finally {
      turnsLoading.value = false
    }
  }

  async function deleteSession(sessionId: string) {
    const apiConfig = useApiConfigStore()
    sessionsError.value = null
    try {
      const response = await fetch(resolveApiUrl(apiConfig, 'deleteChatSession', { sessionId }), {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`Delete session request failed: ${response.status}`)
      sessions.value = sessions.value.filter(session => session.id !== sessionId)
      if (selectedSessionId.value === sessionId || currentSessionId.value === sessionId) {
        selectedSessionId.value = null
        currentSessionId.value = null
        currentSessionBid.value = null
        messages.value = []
      }
    } catch (err) {
      sessionsError.value = formatSessionError(err, '删除聊天记录', apiConfig.displayBaseUrl)
    }
  }

  return {
    messages,
    inputText,
    isSending,
    currentSessionId,
    sessions,
    sessionsLoading,
    sessionsError,
    sessionsGuard,
    turnsLoading,
    selectedSessionId,
    sendMessage,
    loadSessions,
    loadSessionTurns,
    deleteSession,
  }
})
