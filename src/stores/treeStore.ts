import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KnowledgeBase, TreeNode, FlatNode, SourceFile } from '../types'
import { flattenTree, assignPaths } from '../utils/treeUtils'
import { sourceToColor } from '../utils/colorPalette'
import { useApiConfigStore } from './apiConfigStore'
import { resolveApiUrl } from '../services/apiClient'

export interface BuildStats {
  input_tokens?: number
  output_tokens?: number
  node_count?: number
  max_depth?: number
  root_count?: number
  elapsed_sec?: number
  mode?: string
}

export interface BuildRecord {
  id: string
  tree_id?: string
  bid?: string | null
  filename: string
  title?: string
  content_type?: string
  file_size?: number
  sha256?: string
  storage_key?: string
  has_original_file?: boolean
  original_file_url?: string | null
  raw_text?: string
  mermaid?: string
  tree?: TreeNode[] | TreeNode
  stats?: BuildStats
  node_count?: number
  max_depth?: number
  root_count?: number
  created_at: string
  cached?: boolean
  error?: string
}

export type BuildPhase = 'idle' | 'uploading' | 'parsing' | 'building' | 'complete' | 'error'
export type DataGuardStatus = 'loading' | 'error' | 'empty' | 'ready'

type BuildStreamStage =
  | 'start'
  | 'save_original'
  | 'save_original_done'
  | 'save_original_failed'
  | 'parse'
  | 'parse_done'
  | 'structure'
  | 'md_parsed'
  | 'semantic'
  | 'structure_done'
  | 'refine'
  | 'thin'
  | 'thin_done'
  | 'summarize'
  | 'verify'
  | 'verify_done'
  | 'verify_failed'
  | 'done'
  | 'error'

type BuildStreamEvent =
  | { type: 'start'; stage?: BuildStreamStage | string; bid?: string; filename?: string; summarize?: boolean; file_size?: number; elapsed_sec?: number }
  | { type: 'progress'; stage?: BuildStreamStage | string; message?: string; progress?: number; done?: number; total?: number; chars?: number; nodes?: number; root_nodes?: number; node_count?: number; ok?: boolean; score?: number; elapsed_sec?: number }
  | { type: 'warning'; message?: string; stage?: BuildStreamStage | string; elapsed_sec?: number }
  | { type: 'done'; stage?: BuildStreamStage | string; cached?: boolean; result?: BuildRecord; elapsed_sec?: number }
  | { type: 'error'; stage?: BuildStreamStage | string; message?: string; result?: BuildRecord; elapsed_sec?: number }

export interface DataGuard {
  status: DataGuardStatus
  title: string
  description: string
}

const BUILD_PHASE_LABELS: Record<BuildPhase, string> = {
  idle: '等待构建',
  uploading: '上传文件中',
  parsing: '后端解析中',
  building: '生成知识树中',
  complete: '构建完成',
  error: '构建失败',
}

interface BuildStageConfig {
  phase: BuildPhase
  base: number
  span: number
  label: string
  done?: boolean
}

const BUILD_STAGE_PROGRESS: Record<string, BuildStageConfig> = {
  save_original: { phase: 'uploading', base: 10, span: 10, label: '保存原件中' },
  save_original_done: { phase: 'uploading', base: 20, span: 4, label: '原件已保存', done: true },
  parse: { phase: 'parsing', base: 28, span: 12, label: '读取并解析文档' },
  parse_done: { phase: 'parsing', base: 40, span: 8, label: '文档解析完成', done: true },
  structure: { phase: 'building', base: 50, span: 8, label: '生成知识结构中' },
  md_parsed: { phase: 'building', base: 58, span: 4, label: 'Markdown 结构已解析', done: true },
  semantic: { phase: 'building', base: 60, span: 8, label: '抽取语义结构中' },
  structure_done: { phase: 'building', base: 68, span: 4, label: '知识结构已生成', done: true },
  refine: { phase: 'building', base: 72, span: 8, label: '细化知识树中' },
  thin: { phase: 'building', base: 80, span: 4, label: '压缩过长节点中' },
  thin_done: { phase: 'building', base: 84, span: 3, label: '节点压缩完成', done: true },
  summarize: { phase: 'building', base: 87, span: 8, label: '生成节点摘要中' },
  verify: { phase: 'building', base: 95, span: 3, label: '校验构建结果中' },
  verify_done: { phase: 'building', base: 98, span: 1, label: '构建结果已校验', done: true },
}

function formatApiError(err: unknown, action: string, baseUrl: string) {
  const rawMessage = err instanceof Error ? err.message : String(err || '')
  if (rawMessage === 'Load failed' || rawMessage === 'Failed to fetch') {
    return `${action}失败：无法连接 API 服务。请确认后端已启动，地址为 ${baseUrl}，并已配置 CORS。`
  }
  return `${action}失败：${rawMessage || '未知错误'}`
}

type BackendTreeNode = TreeNode & {
  node_id?: string
  content?: { kind?: string; text?: string }
  children?: BackendTreeNode[]
}

type BackendBuildRecord = Partial<Omit<BuildRecord, 'tree'>> & {
  id?: string
  bid?: string | null
  tree_id?: string
  tree?: BackendTreeNode | BackendTreeNode[]
  roots?: BackendTreeNode[]
}

function backendText(node: BackendTreeNode) {
  return node.text || (node.content?.kind === 'text' ? node.content.text : '') || ''
}

function normalizeTreeNode(node: BackendTreeNode): TreeNode {
  return {
    title: node.title || node.node_id || 'Untitled',
    line_num: node.line_num,
    text: backendText(node),
    summary: node.summary,
    children: node.children?.map(normalizeTreeNode),
  }
}

function normalizeTreeList(tree: BackendBuildRecord['tree']) {
  if (!tree) return []
  if (Array.isArray(tree)) return tree.map(normalizeTreeNode)
  return tree.children?.map(normalizeTreeNode) || [normalizeTreeNode(tree)]
}

function buildRecordId(record: BackendBuildRecord) {
  return record.id || record.bid || record.tree_id || ''
}

function normalizeBuildRecord(record: BackendBuildRecord): BuildRecord {
  const id = buildRecordId(record)
  const nodeCount = record.stats?.node_count || record.node_count
  return {
    ...record,
    id,
    tree_id: record.tree_id || id,
    bid: record.bid ?? id,
    filename: record.filename || record.title || 'document.md',
    created_at: record.created_at || new Date().toISOString(),
    stats: record.stats || {
      node_count: nodeCount,
      max_depth: record.max_depth,
      root_count: record.root_count,
    },
    node_count: nodeCount,
    tree: normalizeTreeList(record.tree),
  }
}

function hasFullTree(record: BuildRecord) {
  return Array.isArray(record.tree) && record.tree.length > 0
}

export const useTreeStore = defineStore('tree', () => {
  const trees = ref<TreeNode[]>([])
  const sourceFiles = ref<SourceFile[]>([])
  const selectedNodeId = ref<string | null>(null)
  const activeKnowledgeBaseId = ref('')
  const knowledgeBases = ref<KnowledgeBase[]>([])
  const buildRecords = ref<Record<string, BuildRecord>>({})
  const currentBuild = ref<BuildRecord | null>(null)
  const isLoadingHistory = ref(false)
  const isBuilding = ref(false)
  const buildPhase = ref<BuildPhase>('idle')
  const buildProgress = ref(0)
  const buildProgressMessage = ref('')
  const error = ref<string | null>(null)
  let buildProgressTimer: ReturnType<typeof setInterval> | null = null

  const enrichedTrees = computed(() => assignPaths(trees.value))

  const flatNodes = computed(() => {
    const { nodes } = flattenTree(enrichedTrees.value)
    return nodes
  })

  const links = computed(() => {
    const { links } = flattenTree(enrichedTrees.value)
    return links
  })

  const sourceColorMap = computed(() => {
    const map = new Map<string, string>()
    for (const node of flatNodes.value) {
      if (!map.has(node.source)) {
        map.set(node.source, sourceToColor(node.source))
      }
    }
    return map
  })

  const totalNodes = computed(() => flatNodes.value.length)
  const totalTokens = computed(() => flatNodes.value.reduce((s, n) => s + n.tokenCount, 0))
  const sources = computed(() => [...new Set(flatNodes.value.map(n => n.source))])
  const activeKnowledgeBase = computed(() => (
    knowledgeBases.value.find(kb => kb.id === activeKnowledgeBaseId.value)
  ))
  const buildTrees = computed<TreeNode[]>(() => {
    if (!activeKnowledgeBase.value || trees.value.length === 0) return []

    return assignPaths([{
      title: activeKnowledgeBase.value.name,
      source: activeKnowledgeBase.value.name,
      tokenCount: totalTokens.value,
      summary: activeKnowledgeBase.value.description,
      children: trees.value,
    }])
  })
  const buildFlatNodes = computed(() => {
    const { nodes } = flattenTree(buildTrees.value, activeKnowledgeBase.value?.name)
    return nodes
  })
  const buildLinks = computed(() => {
    const { links } = flattenTree(buildTrees.value, activeKnowledgeBase.value?.name)
    return links
  })
  const buildPhaseLabel = computed(() => buildProgressMessage.value || BUILD_PHASE_LABELS[buildPhase.value])
  const hasKnowledgeBases = computed(() => knowledgeBases.value.length > 0)
  const hasActiveBuild = computed(() => Boolean(currentBuild.value && activeKnowledgeBase.value))
  const hasBuildTree = computed(() => buildFlatNodes.value.length > 0)
  const activeBuildTitle = computed(() => activeKnowledgeBase.value?.name || '未选择知识库')
  const activeBuildDescription = computed(() => (
    activeKnowledgeBase.value?.description || '请先在 Build 中上传文件并构建知识树。'
  ))
  const activeBuildNodeCount = computed(() => (
    activeKnowledgeBase.value?.nodeCount || buildFlatNodes.value.length || 0
  ))
  const historyGuard = computed<DataGuard>(() => {
    if (isLoadingHistory.value) {
      return {
        status: 'loading',
        title: '正在加载构建历史',
        description: '正在从 Build Service 拉取已有知识树。',
      }
    }
    if (error.value && !hasKnowledgeBases.value) {
      return {
        status: 'error',
        title: '历史记录加载失败',
        description: error.value,
      }
    }
    if (!hasKnowledgeBases.value) {
      return {
        status: 'empty',
        title: '还没有知识库',
        description: '请先上传文件并构建知识树。',
      }
    }
    return {
      status: 'ready',
      title: '知识库已就绪',
      description: `${knowledgeBases.value.length} 个知识库可用。`,
    }
  })
  const buildGuard = computed<DataGuard>(() => {
    if (isBuilding.value) {
      return {
        status: 'loading',
        title: buildPhaseLabel.value,
        description: 'Build Service 正在处理上传文件。',
      }
    }
    if (error.value && !currentBuild.value) {
      return {
        status: 'error',
        title: '构建结果不可用',
        description: error.value,
      }
    }
    if (!currentBuild.value) {
      return {
        status: 'empty',
        title: '还没有 API 构建',
        description: '请先上传文件并构建知识树。',
      }
    }
    if (!hasBuildTree.value) {
      return {
        status: 'empty',
        title: '当前构建没有知识树',
        description: '后端返回了构建记录，但没有返回可展示的 tree 节点。',
      }
    }
    return {
      status: 'ready',
      title: activeBuildTitle.value,
      description: activeBuildDescription.value,
    }
  })

  function stopBuildProgressTimer() {
    if (buildProgressTimer) {
      clearInterval(buildProgressTimer)
      buildProgressTimer = null
    }
  }

  function setBuildProgress(phase: BuildPhase, progress: number) {
    buildPhase.value = phase
    buildProgress.value = Math.max(0, Math.min(100, progress))
  }

  function buildFormData(file: File, options: { summarize: boolean }) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('summarize', String(options.summarize))
    return formData
  }

  function updateSourceProgress(fileName: string, progress: number, status?: SourceFile['status']) {
    sourceFiles.value = [{
      name: fileName,
      status: status || (buildPhase.value === 'uploading' ? 'uploading' : buildPhase.value === 'parsing' ? 'parsing' : 'building'),
      nodeCount: currentBuild.value?.stats?.node_count || currentBuild.value?.node_count || 0,
      parseProgress: Math.max(0, Math.min(100, progress)),
    }]
  }

  function buildProgressLabel(event: Extract<BuildStreamEvent, { type: 'progress' }>, config: BuildStageConfig) {
    if (event.stage === 'parse_done' && typeof event.chars === 'number') {
      return `文档解析完成 · ${event.chars.toLocaleString()} chars`
    }
    if (event.stage === 'md_parsed' && typeof event.nodes === 'number') {
      return `Markdown 结构已解析 · ${event.nodes} nodes`
    }
    if (event.stage === 'structure_done' && typeof event.node_count === 'number') {
      return `知识结构已生成 · ${event.node_count} nodes`
    }
    if (event.stage === 'thin_done' && typeof event.node_count === 'number') {
      return `节点压缩完成 · ${event.node_count} nodes`
    }
    if (event.stage === 'summarize' && typeof event.done === 'number' && typeof event.total === 'number' && event.total > 0) {
      return `生成节点摘要中 · ${event.done}/${event.total}`
    }
    if (event.stage === 'verify_done' && typeof event.score === 'number') {
      return `构建结果已校验 · score ${event.score.toFixed(2)}`
    }
    return config.label
  }

  function progressFromStreamEvent(event: Extract<BuildStreamEvent, { type: 'progress' }>) {
    const stage = event.stage || ''
    const config = BUILD_STAGE_PROGRESS[stage] || BUILD_STAGE_PROGRESS.structure
    const ratio = typeof event.progress === 'number'
      ? event.progress > 1 ? event.progress / 100 : event.progress
      : event.total ? (event.done || 0) / event.total : config.done ? 1 : 0
    return {
      phase: config.phase,
      progress: config.base + config.span * Math.max(0, Math.min(1, ratio)),
      label: buildProgressLabel(event, config),
    }
  }

  function applyBuildStreamEvent(event: BuildStreamEvent, fileName: string) {
    if (event.type === 'start') {
      buildProgressMessage.value = '构建任务已启动'
      setBuildProgress('uploading', 8)
      updateSourceProgress(event.filename || fileName, 8, 'uploading')
      return
    }

    if (event.type === 'progress') {
      const next = progressFromStreamEvent(event)
      buildProgressMessage.value = next.label
      setBuildProgress(next.phase, Math.max(buildProgress.value, next.progress))
      updateSourceProgress(fileName, buildProgress.value)
      return
    }

    if (event.type === 'warning') {
      if (event.stage === 'save_original_failed') {
        buildProgressMessage.value = '原件保存失败，继续构建解析文本'
        return
      }
      if (event.stage === 'verify_failed') {
        buildProgressMessage.value = '校验失败，使用当前最佳知识树'
        return
      }
      buildProgressMessage.value = event.message || '构建过程中出现非致命警告'
      return
    }

    if (event.type === 'done') {
      if (!event.result) throw new Error('Build stream done event missing result')
      buildProgressMessage.value = '构建完成'
      const record = normalizeBuildRecord(event.result)
      if (hasFullTree(record)) {
        applyBuild(record)
        knowledgeBases.value = [
          toKnowledgeBase(record),
          ...knowledgeBases.value.filter(kb => kb.id !== record.id),
        ]
      } else {
        setBuildProgress('complete', 100)
        updateSourceProgress(record.filename || fileName, 100, 'done')
      }
      return
    }

    if (event.type === 'error') {
      if (event.result) applyBuild(event.result)
      throw new Error(event.message || event.result?.error || 'Build stream failed')
    }
  }

  function startBuildProgressTimer() {
    stopBuildProgressTimer()
    buildProgressTimer = setInterval(() => {
      if (!isBuilding.value) return

      if (buildPhase.value === 'uploading' && buildProgress.value >= 24) {
        setBuildProgress('parsing', 32)
        sourceFiles.value = sourceFiles.value.map(file => ({
          ...file,
          status: 'parsing',
          parseProgress: 32,
        }))
        return
      }

      if (buildPhase.value === 'parsing' && buildProgress.value >= 58) {
        setBuildProgress('building', 64)
        sourceFiles.value = sourceFiles.value.map(file => ({
          ...file,
          status: 'building',
          parseProgress: 64,
        }))
        return
      }

      const cap = buildPhase.value === 'uploading' ? 28 : buildPhase.value === 'parsing' ? 62 : 88
      if (buildProgress.value < cap) {
        const nextProgress = buildProgress.value + (buildPhase.value === 'uploading' ? 6 : 4)
        buildProgress.value = Math.min(cap, nextProgress)
        sourceFiles.value = sourceFiles.value.map(file => ({
          ...file,
          parseProgress: buildProgress.value,
        }))
      }
    }, 650)
  }

  function toKnowledgeBase(rawRecord: BuildRecord): KnowledgeBase {
    const record = normalizeBuildRecord(rawRecord)
    return {
      id: record.id,
      name: record.filename,
      description: record.error || `${record.stats?.mode || 'treefyit'} build`,
      updatedAt: record.created_at,
      documentCount: 1,
      nodeCount: record.stats?.node_count || record.node_count || 0,
    }
  }

  function applyBuild(rawRecord: BuildRecord) {
    const record = normalizeBuildRecord(rawRecord)
    if (!record.id) throw new Error('Build record missing id/tree_id')
    buildRecords.value[record.id] = record
    currentBuild.value = record
    activeKnowledgeBaseId.value = record.id
    trees.value = Array.isArray(record.tree) ? record.tree : []
    sourceFiles.value = [{
      name: record.filename,
      status: record.error ? 'error' : 'done',
      nodeCount: record.stats?.node_count || record.node_count || 0,
      parseProgress: 100,
    }]
    setBuildProgress(record.error ? 'error' : 'complete', record.error ? 0 : 100)
    selectedNodeId.value = null
  }

  async function loadHistory() {
    const apiConfig = useApiConfigStore()
    isLoadingHistory.value = true
    error.value = null
    try {
      const response = await fetch(resolveApiUrl(apiConfig, 'listBuildHistory'))
      if (!response.ok) throw new Error(`History request failed: ${response.status}`)
      const payload = await response.json() as BackendBuildRecord[] | { items?: BackendBuildRecord[] }
      const records = (Array.isArray(payload) ? payload : payload.items || []).map(normalizeBuildRecord)
      buildRecords.value = Object.fromEntries(records.map(record => [record.id, record]))
      knowledgeBases.value = records.map(toKnowledgeBase)
      if (records[0]) {
        await loadBuild(records[0].id)
      } else {
        currentBuild.value = null
        activeKnowledgeBaseId.value = ''
        trees.value = []
        sourceFiles.value = []
      }
    } catch (err) {
      error.value = formatApiError(err, '加载历史记录', apiConfig.displayBaseUrl)
    } finally {
      isLoadingHistory.value = false
    }
  }

  async function loadBuild(id: string) {
    const apiConfig = useApiConfigStore()
    error.value = null
    try {
      const cached = buildRecords.value[id]
      if (cached && hasFullTree(cached)) {
        applyBuild(cached)
        return
      }
      const response = await fetch(resolveApiUrl(apiConfig, 'getBuild', { bid: id }))
      if (!response.ok) throw new Error(`Build request failed: ${response.status}`)
      const record = normalizeBuildRecord(await response.json() as BackendBuildRecord)
      applyBuild(record)
      if (!knowledgeBases.value.some(kb => kb.id === record.id)) {
        knowledgeBases.value = [toKnowledgeBase(record), ...knowledgeBases.value]
      }
    } catch (err) {
      error.value = formatApiError(err, '加载构建结果', apiConfig.displayBaseUrl)
    }
  }

  async function buildFromFile(file: File, options: { summarize: boolean }) {
    const apiConfig = useApiConfigStore()
    isBuilding.value = true
    error.value = null
    buildProgressMessage.value = '准备上传文件'
    setBuildProgress('uploading', 4)
    sourceFiles.value = [{ name: file.name, status: 'uploading', nodeCount: 0, parseProgress: 4 }]
    try {
      const response = await fetch(resolveApiUrl(apiConfig, 'buildTreeStream'), {
        method: 'POST',
        body: buildFormData(file, options),
      })
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          await buildFromFileLegacy(file, options)
          return
        }
        throw new Error(`Build stream request failed: ${response.status}`)
      }
      if (!response.body) throw new Error('Build stream response has no body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completed = false
      let completedBuildId = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as BuildStreamEvent
          applyBuildStreamEvent(event, file.name)
          if (event.type === 'done') {
            completed = true
            completedBuildId = event.result ? buildRecordId(event.result) : ''
          }
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        const event = JSON.parse(buffer) as BuildStreamEvent
        applyBuildStreamEvent(event, file.name)
        if (event.type === 'done') {
          completed = true
          completedBuildId = event.result ? buildRecordId(event.result) : ''
        }
      }
      if (!completed) throw new Error('Build stream ended before done event')
      if (completedBuildId) await loadBuild(completedBuildId)
    } catch (err) {
      error.value = formatApiError(err, '构建知识树', apiConfig.displayBaseUrl)
      buildProgressMessage.value = '构建失败'
      setBuildProgress('error', 0)
      sourceFiles.value = [{ name: file.name, status: 'error', nodeCount: 0, parseProgress: 0 }]
    } finally {
      stopBuildProgressTimer()
      isBuilding.value = false
    }
  }

  async function buildFromFileLegacy(file: File, options: { summarize: boolean }) {
    const apiConfig = useApiConfigStore()
    buildProgressMessage.value = ''
    setBuildProgress('uploading', 12)
    sourceFiles.value = [{ name: file.name, status: 'uploading', nodeCount: 0, parseProgress: 12 }]
    startBuildProgressTimer()

    const response = await fetch(resolveApiUrl(apiConfig, 'buildTree'), {
      method: 'POST',
      body: buildFormData(file, options),
    })
    if (!response.ok) throw new Error(`Build request failed: ${response.status}`)
    setBuildProgress('building', Math.max(buildProgress.value, 92))
    sourceFiles.value = sourceFiles.value.map(item => ({ ...item, status: 'building', parseProgress: 92 }))
    const record = normalizeBuildRecord(await response.json() as BackendBuildRecord)
    if (record.error) throw new Error(record.error)
    applyBuild(record)
    knowledgeBases.value = [
      toKnowledgeBase(record),
      ...knowledgeBases.value.filter(kb => kb.id !== record.id),
    ]
  }

  function selectNode(id: string | null) {
    selectedNodeId.value = id
  }

  function setActiveKnowledgeBase(id: string) {
    activeKnowledgeBaseId.value = id
    selectedNodeId.value = null
    void loadBuild(id)
  }

  function getNodeById(id: string): FlatNode | undefined {
    return flatNodes.value.find(n => n.id === id)
  }

  function getBuildNodeById(id: string): FlatNode | undefined {
    return buildFlatNodes.value.find(n => n.id === id)
  }

  return {
    trees, sourceFiles, selectedNodeId, activeKnowledgeBaseId, knowledgeBases,
    buildRecords, currentBuild, isLoadingHistory, isBuilding, buildPhase, buildProgress, buildPhaseLabel, error,
    enrichedTrees, flatNodes, links, sourceColorMap, activeKnowledgeBase,
    buildTrees, buildFlatNodes, buildLinks,
    totalNodes, totalTokens, sources,
    hasKnowledgeBases, hasActiveBuild, hasBuildTree,
    activeBuildTitle, activeBuildDescription, activeBuildNodeCount,
    historyGuard, buildGuard,
    loadHistory, loadBuild, buildFromFile, selectNode, setActiveKnowledgeBase, getNodeById, getBuildNodeById,
  }
})
