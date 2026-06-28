export interface TreeNode {
  title: string
  line_num?: number
  text?: string
  summary?: string
  children?: TreeNode[]
  // Frontend-enriched fields
  id?: string
  path?: string
  depth?: number
  tokenCount?: number
  source?: string
  color?: string
}

export interface FlatNode {
  id: string
  title: string
  path: string
  depth: number
  tokenCount: number
  source: string
  color: string
  parentId: string | null
  text: string
  summary: string
}

export interface LinkData {
  source: string
  target: string
}

export interface SourceFile {
  name: string
  status: 'pending' | 'uploading' | 'parsing' | 'building' | 'done' | 'error'
  parseProgress?: number
  nodeCount: number
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  updatedAt: string
  documentCount: number
  nodeCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  content: string
  timestamp: string
  isStreaming?: boolean
  sourceRef?: string
  toolEvents?: ChatToolEvent[]
  parts?: ChatMessagePart[]
}

export interface ChatToolEvent {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  arguments?: string
  result?: string
  ok?: boolean
}

export type ChatMessagePart =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'reasoning'; content: string }
  | { id: string; type: 'tool'; toolEvent: ChatToolEvent }

export interface QueryParams {
  tool: 'overview_forest' | 'search_trees' | 'search_nodes' | 'overview' | 'inspect' | 'children'
  path: string
  query: string
}

export type ScreenName = 'build' | 'chat' | 'query'
export type UniverseTransition = 'surface' | 'entering' | 'universe' | 'exiting'
export type KnowledgeGraphScope = 'forest' | 'tree'
