import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChatMessage, ChatToolEvent } from '../types'
import { resolveApiUrl, resolveStreamingApiUrl } from '../services/apiClient'
import { mergeStreamingText } from '../utils/streamText'
import { useApiConfigStore } from './apiConfigStore'
import { useTreeStore } from './treeStore'

type ChatStreamEvent =
  | { type: 'start'; bid?: string; tree_id?: string; filename?: string; session_id?: string }
  | { type: 'text' | 'reasoning'; text?: string }
  | { type: 'tool_call'; id?: string; name?: string; arguments?: unknown }
  | { type: 'tool_result'; id?: string; name?: string; ok?: boolean; content?: unknown }
  | { type: 'turn_end'; turn?: number; stopped?: boolean }
  | { type: 'done'; answer?: string; turns?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; session_id?: string }
  | { type: 'error'; message?: string }
  | { type: 'debug'; event?: string }

export interface ChatSessionSummary {
  id: string
  bid: string | null
  title: string
  turn_count: number
  created_at: string
  updated_at: string
}

interface ChatSessionTurn {
  session_id?: string
  turn_idx?: number
  role: 'user' | 'assistant'
  text?: string | null
  content?: string | null
  tool_calls?: string | Array<{ id?: string; name?: string; arguments?: unknown }> | null
  tool_results?: string | Array<{ id?: string; name?: string; ok?: boolean; content?: unknown }> | null
  assistant_events?: string | Array<{
    seq?: number
    type?: 'text' | 'reasoning' | 'tool_call' | 'tool_result'
    text?: string
    id?: string
    name?: string
    arguments?: unknown
    ok?: boolean
    content?: unknown
  }> | null
  created_at: string
}

type BackendChatSessionSummary = Partial<ChatSessionSummary> & {
  session_id?: string
  tree_id?: string
  turns?: unknown[]
}

function formatChatError(err: unknown, baseUrl: string) {
  const rawMessage = err instanceof Error ? err.message : String(err || '')
  if (rawMessage === 'Load failed' || rawMessage === 'Failed to fetch') {
    return `Chat 失败：无法连接 API 服务。请确认后端已启动，地址为 ${baseUrl}，并且已支持 POST /api/chat。`
  }
  return `Chat 失败：${rawMessage || '未知错误'}`
}

function isAbortLikeError(err: unknown) {
  if (!(err instanceof Error)) return false
  const message = err.message || ''
  return (
    err.name === 'AbortError' ||
    /abort/i.test(message) ||
    message === 'Load failed' ||
    message === 'Failed to fetch'
  )
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

function normalizeSession(session: BackendChatSessionSummary): ChatSessionSummary {
  const id = session.id || session.session_id || ''
  return {
    id,
    bid: session.bid || session.tree_id || null,
    title: session.title || 'Untitled chat',
    turn_count: session.turn_count || session.turns?.length || 0,
    created_at: session.created_at || '',
    updated_at: session.updated_at || session.created_at || '',
  }
}

function normalizeTurn(turn: ChatSessionTurn, session: ChatSessionSummary, index: number): ChatSessionTurn {
  return {
    ...turn,
    session_id: turn.session_id || session.id,
    turn_idx: turn.turn_idx ?? index,
    text: turn.text ?? turn.content ?? '',
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

function ensureMessagePart(message: ChatMessage, type: 'text' | 'reasoning') {
  if (!message.parts) {
    message.parts = [{ id: `${message.id}-${type}-0`, type, content: message.content }]
  }
  const lastPart = message.parts[message.parts.length - 1]
  if (lastPart?.type === type) return lastPart
  const nextPart = { id: `${message.id}-${type}-${message.parts.length}`, type, content: '' }
  message.parts.push(nextPart)
  return nextPart
}

function setMessageText(message: ChatMessage, content: string) {
  message.content = content
  ensureMessagePart(message, 'text').content = content
}

function appendMessagePartText(message: ChatMessage, type: 'text' | 'reasoning', patch: string) {
  if (!patch) return
  const part = ensureMessagePart(message, type)
  part.content = mergeStreamingText(part.content, patch)
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
  const tree = useTreeStore()
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
  const selectedKnowledgeBaseId = ref<string | null>(null)

  const selectedKnowledgeBase = computed(() => {
    if (!selectedKnowledgeBaseId.value) return null
    return tree.knowledgeBases.find(kb => kb.id === selectedKnowledgeBaseId.value) || null
  })

  const sessionsGuard = computed(() => {
    if (sessionsLoading.value) {
      return { status: 'loading' as const, title: '正在加载聊天记录', description: '从后端读取最近的对话会话。' }
    }
    if (sessionsError.value) {
      return { status: 'error' as const, title: '聊天记录加载失败', description: sessionsError.value }
    }
    if (!sessions.value.length) {
      return { status: 'empty' as const, title: '暂无聊天记录', description: '这里展示后端保存的全部对话会话。' }
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
      currentSessionBid.value = event.bid || event.tree_id || null
      updateMessage(messageId, message => {
        if (event.filename) message.sourceRef = event.filename
      })
      return
    }

    if (event.type === 'text' && event.text) {
      const textPatch = event.text
      updateMessage(messageId, message => {
        message.content = mergeStreamingText(message.content, textPatch)
        appendMessagePartText(message, 'text', textPatch)
      })
      return
    }

    if (event.type === 'reasoning' && event.text) {
      const reasoningPatch = event.text
      updateMessage(messageId, message => {
        appendMessagePartText(message, 'reasoning', reasoningPatch)
      })
      return
    }

    if (event.type === 'done' && event.answer) {
      if (event.session_id) currentSessionId.value = event.session_id
      updateMessage(messageId, message => {
        if (!message.content.trim()) {
          message.content = event.answer || ''
          ensureMessagePart(message, 'text').content = event.answer || ''
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
        }
        message.toolEvents = toolEvents
      })
      return
    }

    if (event.type === 'turn_end') {
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
    const currentKnowledgeBase = selectedKnowledgeBase.value
    const selectedBid = currentKnowledgeBase?.id || null
    const sessionId = selectedBid
      ? (currentSessionBid.value === selectedBid ? currentSessionId.value : null)
      : (currentSessionBid.value ? null : currentSessionId.value)

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
      isStreaming: true,
      sourceRef: currentKnowledgeBase?.name,
      parts: [{ id: `${Date.now() + 1}-text-0`, type: 'text', content: '' }],
    }
    messages.value.push(aiMessage)

    isSending.value = true
    try {
      const payload: Record<string, string> = { question: text }
      if (selectedBid) payload.bid = selectedBid
      if (sessionId) payload.session_id = sessionId

      const response = await fetch(resolveStreamingApiUrl(apiConfig, 'chatTree'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`)
      }

      await readChatStream(response, aiMessage.id)
      updateMessage(aiMessage.id, message => {
        if (!message.content.trim()) {
          const fallback = message.toolEvents?.length
            ? '已完成工具调用，但模型没有返回最终答复。请重试一次，或换个问题再问。'
            : 'Chat API 已返回，但没有生成答案文本。'
          setMessageText(message, fallback)
        }
      })
    } catch (err) {
      if (isAbortLikeError(err)) {
        updateMessage(aiMessage.id, message => {
          if (!message.content.trim()) {
            const fallback = message.toolEvents?.length
              ? '本次响应在预览环境中被中断，已保留已收到的工具结果。'
              : aiMessage.content.trim()
                ? '本次响应在预览环境中被中断，已保留已收到的内容。'
                : '本次请求被浏览器或预览环境中断。后端接口可用，请直接重试。'
            setMessageText(message, fallback)
          }
          message.isStreaming = false
        })
        return
      }
      updateMessage(aiMessage.id, message => {
        message.role = 'system'
        message.isStreaming = false
        message.toolEvents = undefined
        message.parts = [{ id: `${message.id}-text-error`, type: 'text', content: formatChatError(err, apiConfig.displayStreamBaseUrl) }]
        message.content = formatChatError(err, apiConfig.displayStreamBaseUrl)
        message.sourceRef = undefined
      })
    } finally {
      updateMessage(aiMessage.id, message => {
        message.isStreaming = false
      })
      isSending.value = false
      void loadSessions({ limit: 50 })
    }
  }

  function turnToMessage(turn: ChatSessionTurn): ChatMessage {
    const role = turn.role === 'assistant' ? 'ai' : 'user'
    const content = turn.text || turn.content || ''
    const sessionId = turn.session_id || 'session'
    const turnIndex = turn.turn_idx ?? Date.now()
    const message: ChatMessage = {
      id: `${sessionId}-${turnIndex}`,
      role,
      content,
      timestamp: turn.created_at,
      parts: [],
    }

    if (role === 'ai') {
      const assistantEvents = parseJsonList<{
        seq?: number
        type?: 'text' | 'reasoning' | 'tool_call' | 'tool_result'
        text?: string
        id?: string
        name?: string
        arguments?: unknown
        ok?: boolean
        content?: unknown
      }>(turn.assistant_events)
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
      if (assistantEvents.length) {
        message.parts = []
        for (const [index, event] of assistantEvents.entries()) {
          if ((event.type === 'text' || event.type === 'reasoning') && event.text) {
            const lastPart = message.parts[message.parts.length - 1]
            if (lastPart?.type === event.type) {
              lastPart.content = mergeStreamingText(lastPart.content, event.text)
            } else {
              message.parts.push({
                id: `${message.id}-${event.type}-${event.seq ?? index}`,
                type: event.type,
                content: event.text,
              })
            }
            continue
          }

          if (event.type === 'tool_call' || event.type === 'tool_result') {
            const toolId = event.id || event.name || `tool-${index}`
            const toolEvent = toolEvents.find(item => item.id === toolId || item.name === event.name)
            if (toolEvent) {
              const existingPart = message.parts.find(part => (
                part.type === 'tool' && (part.toolEvent.id === toolEvent.id || part.toolEvent.name === toolEvent.name)
              ))
              if (!existingPart) {
                message.parts.push({
                  id: `${message.id}-tool-${toolEvent.id}-${event.seq ?? index}`,
                  type: 'tool',
                  toolEvent,
                })
              }
            }
          }
        }
        if (!message.parts.some(part => part.type === 'text' && part.content.trim()) && content.trim()) {
          message.parts.push({ id: `${message.id}-text-fallback`, type: 'text', content })
        }
      } else {
        message.parts = []
        for (const toolEvent of toolEvents) {
          message.parts.push({ id: `${message.id}-tool-${toolEvent.id}`, type: 'tool' as const, toolEvent })
        }
        if (content.trim()) {
          message.parts.push({ id: `${message.id}-text-0`, type: 'text' as const, content })
        }
      }
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
        limit: options.limit || 50,
      }))
      if (!response.ok) throw new Error(`Sessions request failed: ${response.status}`)
      const data = await response.json() as { sessions?: BackendChatSessionSummary[] }
      sessions.value = (data.sessions || []).map(normalizeSession).filter(session => session.id)
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
      messages.value = (data.turns || []).map((turn, index) => turnToMessage(normalizeTurn(turn, session, index)))
      selectedSessionId.value = session.id
      currentSessionId.value = session.id
      currentSessionBid.value = session.bid
      selectedKnowledgeBaseId.value = session.bid
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

  function selectKnowledgeBase(id: string | null) {
    selectedKnowledgeBaseId.value = id
    selectedSessionId.value = null
  }

  function clearKnowledgeBase() {
    selectedKnowledgeBaseId.value = null
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
    selectedKnowledgeBaseId,
    selectedKnowledgeBase,
    sendMessage,
    loadSessions,
    loadSessionTurns,
    deleteSession,
    selectKnowledgeBase,
    clearKnowledgeBase,
  }
})
