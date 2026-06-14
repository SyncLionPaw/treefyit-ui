import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QueryParams } from '../types'
import { useApiConfigStore } from './apiConfigStore'
import { useTreeStore } from './treeStore'
import { resolveApiUrl } from '../services/apiClient'

function formatApiError(err: unknown, baseUrl: string) {
  const rawMessage = err instanceof Error ? err.message : String(err || '')
  if (rawMessage === 'Load failed' || rawMessage === 'Failed to fetch') {
    return `Query 失败：无法连接 API 服务。请确认后端已启动，地址为 ${baseUrl}，并已配置 CORS。`
  }
  return `Query 失败：${rawMessage || '未知错误'}`
}

export const useQueryStore = defineStore('query', () => {
  const params = ref<QueryParams>({
    tool: 'inspect',
    path: '0',
  })
  const result = ref<object | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function executeQuery() {
    const apiConfig = useApiConfigStore()
    const tree = useTreeStore()
    const treeId = tree.activeKnowledgeBaseId
    if (!treeId) {
      error.value = '请先在 Build 中构建或选择一棵知识树'
      result.value = null
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const path = params.value.path.trim()
      const endpoint = params.value.tool === 'overview'
        ? 'getTree'
        : params.value.tool === 'children'
          ? 'getChildren'
          : 'inspectNode'
      const requestParams: Record<string, string> = endpoint === 'getTree'
        ? { treeId }
        : { treeId, path: path || '0' }
      const response = await fetch(resolveApiUrl(apiConfig, endpoint, requestParams))
      if (!response.ok) throw new Error(`Query request failed: ${response.status}`)
      result.value = await response.json() as object
    } catch (err) {
      error.value = formatApiError(err, apiConfig.displayBaseUrl)
      result.value = null
    } finally {
      isLoading.value = false
    }
  }

  return { params, result, isLoading, error, executeQuery }
})
