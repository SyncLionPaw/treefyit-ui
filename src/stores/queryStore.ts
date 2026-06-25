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
    tool: 'overview_forest',
    path: '0',
    query: '',
  })
  const result = ref<object | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function withQuery(url: string, query: string) {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}q=${encodeURIComponent(normalizedQuery)}`
  }

  function requiresTree(tool: QueryParams['tool']) {
    return tool === 'overview' || tool === 'inspect' || tool === 'children'
  }

  function requiresPath(tool: QueryParams['tool']) {
    return tool === 'inspect' || tool === 'children'
  }

  function requiresSearchQuery(tool: QueryParams['tool']) {
    return tool === 'search_trees' || tool === 'search_nodes'
  }

  async function executeQuery() {
    const apiConfig = useApiConfigStore()
    const tree = useTreeStore()
    const tool = params.value.tool
    const treeId = tree.activeKnowledgeBaseId

    if (requiresTree(tool) && !treeId) {
      error.value = '请先选择一个 tree'
      result.value = null
      return
    }
    if (requiresSearchQuery(tool) && !params.value.query.trim()) {
      error.value = '请输入搜索内容'
      result.value = null
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const path = params.value.path.trim()
      let url = ''

      switch (tool) {
        case 'overview_forest':
          url = resolveApiUrl(apiConfig, 'getForest')
          break
        case 'search_trees':
          url = withQuery(resolveApiUrl(apiConfig, 'searchTrees'), params.value.query)
          break
        case 'search_nodes':
          url = withQuery(resolveApiUrl(apiConfig, 'searchForestNodes'), params.value.query)
          break
        case 'overview':
          url = resolveApiUrl(apiConfig, 'getTree', { treeId })
          break
        case 'children':
          url = resolveApiUrl(apiConfig, 'getChildren', { treeId, path: path || '0' })
          break
        case 'inspect':
          url = resolveApiUrl(apiConfig, 'inspectNode', { treeId, path: path || '0' })
          break
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error(`Query request failed: ${response.status}`)
      result.value = await response.json() as object
    } catch (err) {
      error.value = formatApiError(err, apiConfig.displayBaseUrl)
      result.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    params,
    result,
    isLoading,
    error,
    executeQuery,
    requiresTree,
    requiresPath,
    requiresSearchQuery,
  }
})
