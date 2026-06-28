import type { ApiMode } from '../stores/apiConfigStore'

export const API_ENDPOINTS = {
  buildTree: { method: 'POST', path: '/api/build' },
  buildTreeStream: { method: 'POST', path: '/api/build/stream' },
  chatTree: { method: 'POST', path: '/api/chat' },
  listBuildHistory: { method: 'GET', path: '/api/history' },
  getBuild: { method: 'GET', path: '/api/build/:bid' },
  getBuildOriginalFile: { method: 'GET', path: '/api/build/:bid/file' },
  deleteBuild: { method: 'DELETE', path: '/api/build/:bid' },
  listTrees: { method: 'GET', path: '/api/trees' },
  getForest: { method: 'GET', path: '/api/forest' },
  searchTrees: { method: 'GET', path: '/api/forest/search/trees' },
  searchForestNodes: { method: 'GET', path: '/api/forest/search/nodes' },
  searchTreeNodes: { method: 'GET', path: '/api/trees/:treeId/search/nodes' },
  getTree: { method: 'GET', path: '/api/trees/:treeId' },
  inspectNode: { method: 'GET', path: '/api/trees/:treeId/nodes/:path' },
  getChildren: { method: 'GET', path: '/api/trees/:treeId/children/:path' },
  listQueries: { method: 'GET', path: '/api/queries' },
  getQueryStats: { method: 'GET', path: '/api/queries/stats' },
  listChatSessions: { method: 'GET', path: '/api/sessions' },
  getChatSessionTurns: { method: 'GET', path: '/api/sessions/:sessionId/turns' },
  deleteChatSession: { method: 'DELETE', path: '/api/sessions/:sessionId' },
} as const

export type ApiEndpointName = keyof typeof API_ENDPOINTS

export interface ApiRuntimeConfig {
  mode: ApiMode
  baseUrl: string
  streamBaseUrl?: string
  apiKey?: string
}

export function resolveApiUrl(
  config: ApiRuntimeConfig,
  endpoint: ApiEndpointName,
  params: Record<string, string> = {}
) {
  let path: string = API_ENDPOINTS[endpoint].path
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value))
  }
  return `${config.baseUrl}${path}`
}

export function resolveStreamingApiUrl(
  config: ApiRuntimeConfig,
  endpoint: ApiEndpointName,
  params: Record<string, string> = {}
) {
  let path: string = API_ENDPOINTS[endpoint].path
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value))
  }
  return `${config.streamBaseUrl || config.baseUrl}${path}`
}
