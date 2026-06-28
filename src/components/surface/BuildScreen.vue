<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Graph as G6Graph } from '@antv/g6'
import {
  AlertCircle,
  Braces,
  ChevronDown,
  Eye,
  FileText,
  GitBranch,
  Rows3,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { useApiConfigStore } from '../../stores/apiConfigStore'
import { useTreeStore } from '../../stores/treeStore'
import type { FlatNode } from '../../types'
import { formatUiDateTime } from '../../utils/dateTime'
import { renderMarkdown } from '../../utils/markdown'
import JsonRenderer from '../common/JsonRenderer.vue'

type BuildTab = 'diagram' | 'detail' | 'preview' | 'json'
type BuildGraphNode = FlatNode
const buildLockedTabs = new Set<BuildTab>(['diagram', 'detail', 'json'])

const tree = useTreeStore()
const apiConfig = useApiConfigStore()
const activeTab = ref<BuildTab>('diagram')
const summarize = ref(true)
const selectedFile = ref<File | null>(null)
const showLabels = ref(true)
const isDragOver = ref(false)
const previewMode = ref<'original' | 'parsed'>('original')
const previewText = ref('')
const backendOriginalText = ref('')
const previewObjectUrl = ref('')
const deletingBuildId = ref<string | null>(null)
const expandedDetailNodeIds = ref<Set<string>>(new Set())
const graphContainer = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const buildSidebarWidth = ref(300)
const isResizingBuildSidebar = ref(false)
let graph: G6Graph | null = null
let graphLoading = false
let resizeObserver: ResizeObserver | null = null
let hasFitGraph = false
let graphDensityKey = ''
let graphRenderQueue = Promise.resolve()
let graphRendering = false
let graphPendingDestroy = false
let isDisposed = false
const GRAPH_FULL_RENDER_LIMIT = 650
const GRAPH_LOD_NODE_LIMIT = 420
const BUILD_SIDEBAR_WIDTH_STORAGE_KEY = 'treefyit:build-sidebar-width'
const BUILD_SIDEBAR_DEFAULT_WIDTH = 300
const BUILD_SIDEBAR_MIN_WIDTH = 240
const BUILD_SIDEBAR_MAX_WIDTH = 460
const BUILD_SIDEBAR_STACK_BREAKPOINT = 960
const BUILD_MAIN_MIN_WIDTH = 520
const BUILD_SCREEN_HORIZONTAL_SPACE = 36
let sidebarResizeStartX = 0
let sidebarResizeStartWidth = BUILD_SIDEBAR_DEFAULT_WIDTH

const currentStats = computed(() => tree.currentBuild?.stats)
const shouldShowBuildProgress = computed(() => tree.isBuilding)
const buildHistoryRows = computed(() => tree.knowledgeBases.slice(0, 5).map(kb => ({
  ...kb,
  updatedAtLabel: formatUiDateTime(kb.updatedAt, { preset: 'monthDayTime' }),
  updatedAtTitle: formatUiDateTime(kb.updatedAt, { preset: 'detail' }),
})))
const currentBuildTimeLabel = computed(() => {
  const createdAt = tree.currentBuild?.created_at
  if (!createdAt) return tree.buildGuard.title
  return formatUiDateTime(createdAt, { preset: 'compact' })
})
const currentBuildTimeTitle = computed(() => {
  const createdAt = tree.currentBuild?.created_at
  if (!createdAt) return tree.buildGuard.description
  return formatUiDateTime(createdAt, { preset: 'detail' })
})
const buildStages = computed(() => [
  { key: 'uploading', label: '上传文件', tone: 'upload', done: tree.buildProgress >= 30 },
  { key: 'parsing', label: '解析内容', tone: 'parse', done: tree.buildProgress >= 64 },
  { key: 'building', label: '生成知识树', tone: 'build', done: tree.buildPhase === 'complete' },
])
const buildTraceRows = computed(() => tree.buildTrace.slice(-16))
const previewFileName = computed(() => selectedFile.value?.name || tree.currentBuild?.filename || '')
const activeOriginalFile = computed(() => (
  selectedFile.value && selectedFile.value.name === previewFileName.value ? selectedFile.value : null
))
const backendOriginalUrl = computed(() => {
  const url = tree.currentBuild?.original_file_url
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${apiConfig.baseUrl}${url.startsWith('/') ? url : `/${url}`}`
})
const previewExtension = computed(() => {
  const name = previewFileName.value.toLowerCase()
  const match = name.match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
})
const previewContentType = computed(() => tree.currentBuild?.content_type || activeOriginalFile.value?.type || '')
const isTextOriginal = computed(() => {
  const contentType = previewContentType.value.toLowerCase()
  return contentType.startsWith('text/')
    || ['md', 'markdown', 'mdx', 'txt', 'json'].includes(previewExtension.value)
})
const parsedSourceText = computed(() => (
  tree.currentBuild?.parsed_text || tree.currentBuild?.raw_text || previewText.value || ''
))
const activePreviewText = computed(() => (
  previewMode.value === 'original' ? previewText.value || backendOriginalText.value : parsedSourceText.value
))
function looksLikeMarkdown(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  return /^#{1,6}\s+\S/m.test(trimmed)
    || /^\s*[-*+]\s+\S/m.test(trimmed)
    || /^\s*\|.+\|\s*$/m.test(trimmed)
    || /```[\s\S]*?```/.test(trimmed)
    || /<table[\s>]/i.test(trimmed)
    || /\$\$[\s\S]+?\$\$/.test(trimmed)
    || /(^|[^\\$])\$[^$\n]+\$/.test(trimmed)
}
const isMarkdownPreview = computed(() => {
  if (previewMode.value === 'original' && ['md', 'markdown', 'mdx'].includes(previewExtension.value)) return true
  return looksLikeMarkdown(activePreviewText.value)
})
const hasOriginalPreview = computed(() => Boolean(activeOriginalFile.value || backendOriginalUrl.value))
const originalPreviewUrl = computed(() => previewObjectUrl.value || backendOriginalUrl.value)
const previewKind = computed<'markdown' | 'html' | 'pdf' | 'text' | 'missing-original' | 'empty'>(() => {
  if (previewMode.value === 'original') {
    if (!previewFileName.value) return 'empty'
    if (!activeOriginalFile.value && !backendOriginalUrl.value) return 'missing-original'
    if (previewExtension.value === 'pdf') return 'pdf'
    if (['html', 'htm'].includes(previewExtension.value)) return 'html'
    if (isMarkdownPreview.value) return 'markdown'
    if (isTextOriginal.value) return 'text'
    return 'text'
  }
  if (isMarkdownPreview.value) return 'markdown'
  return 'text'
})
const previewMarkdownHtml = computed(() => renderMarkdown(activePreviewText.value))

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getMaxBuildSidebarWidth() {
  if (typeof window === 'undefined') return BUILD_SIDEBAR_MAX_WIDTH
  const availableWidth = window.innerWidth - BUILD_SCREEN_HORIZONTAL_SPACE - BUILD_MAIN_MIN_WIDTH
  return Math.max(BUILD_SIDEBAR_MIN_WIDTH, Math.min(BUILD_SIDEBAR_MAX_WIDTH, availableWidth))
}

function setBuildSidebarWidth(width: number) {
  buildSidebarWidth.value = clamp(width, BUILD_SIDEBAR_MIN_WIDTH, getMaxBuildSidebarWidth())
}

function syncBuildSidebarWidth() {
  setBuildSidebarWidth(buildSidebarWidth.value)
}

function saveBuildSidebarWidth() {
  window.localStorage.setItem(BUILD_SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(buildSidebarWidth.value)))
}

function resizeBuildSidebar(event: PointerEvent) {
  if (!isResizingBuildSidebar.value) return
  const deltaX = event.clientX - sidebarResizeStartX
  setBuildSidebarWidth(sidebarResizeStartWidth + deltaX)
}

function stopBuildSidebarResize() {
  if (!isResizingBuildSidebar.value) return
  isResizingBuildSidebar.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', resizeBuildSidebar)
  window.removeEventListener('pointerup', stopBuildSidebarResize)
  window.removeEventListener('pointercancel', stopBuildSidebarResize)
  saveBuildSidebarWidth()
}

function startBuildSidebarResize(event: PointerEvent) {
  if (window.innerWidth <= BUILD_SIDEBAR_STACK_BREAKPOINT) return
  sidebarResizeStartX = event.clientX
  sidebarResizeStartWidth = buildSidebarWidth.value
  isResizingBuildSidebar.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  event.preventDefault()
  window.addEventListener('pointermove', resizeBuildSidebar)
  window.addEventListener('pointerup', stopBuildSidebarResize)
  window.addEventListener('pointercancel', stopBuildSidebarResize)
}

function adjustBuildSidebarWidth(delta: number) {
  setBuildSidebarWidth(buildSidebarWidth.value + delta)
  saveBuildSidebarWidth()
}

function formatTraceElapsed(elapsedSec?: number) {
  if (typeof elapsedSec !== 'number') return '--'
  return `${elapsedSec < 10 ? elapsedSec.toFixed(3) : elapsedSec.toFixed(1)}s`
}

const graphDensity = computed(() => {
  const count = graphData.value.nodes.length
  const density = clamp((count - 24) / 140, 0, 1)
  return {
    key: `${Math.round(density * 10)}:${count > 80 ? 'dense' : 'normal'}:${graphIsLod.value ? 'lod' : 'full'}`,
    nodeScale: 1 - density * 0.34,
    linkDistance: Math.round(88 - density * 38),
    charge: -360 + density * 190,
    labelMaxDepth: count > 96 ? 0 : count > 48 ? 1 : 99,
    labelFontSize: count > 96 ? 8 : count > 48 ? 9 : 10,
    labelMaxWidth: count > 96 ? 72 : count > 48 ? 84 : 96,
  }
})

const graphIsLod = computed(() => tree.buildFlatNodes.length > GRAPH_FULL_RENDER_LIMIT)
const graphLodText = computed(() => (
  graphIsLod.value
    ? `Canvas LOD: showing ${graphData.value.nodes.length}/${tree.buildFlatNodes.length} nodes. Full tree remains in Detail/JSON.`
    : ''
))

function collectBuildGraphNodes() {
  const allNodes = tree.buildFlatNodes
  if (allNodes.length <= GRAPH_FULL_RENDER_LIMIT) return allNodes

  const included = new Set<string>()
  const nodeMap = new Map(allNodes.map(node => [node.id, node]))
  const childrenMap = new Map<string, BuildGraphNode[]>()
  for (const node of allNodes) {
    if (!node.parentId) continue
    const siblings = childrenMap.get(node.parentId) || []
    siblings.push(node)
    childrenMap.set(node.parentId, siblings)
  }

  function addNode(node?: BuildGraphNode) {
    if (!node || included.size >= GRAPH_LOD_NODE_LIMIT) return
    included.add(node.id)
  }

  function addAncestors(node?: BuildGraphNode) {
    let cursor: BuildGraphNode | undefined = node
    while (cursor) {
      addNode(cursor)
      cursor = cursor.parentId ? nodeMap.get(cursor.parentId) : undefined
    }
  }

  function addChildren(node?: BuildGraphNode) {
    if (!node) return
    for (const child of childrenMap.get(node.id) || []) addNode(child)
  }

  const selected = tree.selectedNodeId ? nodeMap.get(tree.selectedNodeId) : allNodes[0]
  for (const node of allNodes) {
    if (node.depth <= 1) addNode(node)
  }
  addAncestors(selected)
  addChildren(selected)
  if (selected?.parentId) {
    for (const sibling of childrenMap.get(selected.parentId) || []) addNode(sibling)
  }
  for (const node of allNodes) {
    if (node.depth <= 2) addNode(node)
  }
  for (const node of allNodes.slice().sort((a, b) => b.tokenCount - a.tokenCount)) addNode(node)

  return allNodes.filter(node => included.has(node.id))
}

const graphData = computed(() => {
  const graphNodes = collectBuildGraphNodes()
  const graphNodeIds = new Set(graphNodes.map(node => node.id))

  return {
    nodes: graphNodes.map(node => ({
      id: node.id,
      data: {
        title: node.title,
        depth: node.depth,
        color: node.color,
        tokenCount: node.tokenCount,
      },
    })),
    edges: tree.buildLinks
      .filter(link => graphNodeIds.has(link.source) && graphNodeIds.has(link.target))
      .map(link => ({ source: link.source, target: link.target })),
  }
})
const detailChildCountMap = computed(() => {
  const map = new Map<string, number>()
  for (const link of tree.buildLinks) {
    map.set(link.source, (map.get(link.source) || 0) + 1)
  }
  return map
})
const detailNodeMap = computed(() => (
  new Map(tree.buildFlatNodes.map(node => [node.id, node]))
))
const visibleDetailNodes = computed(() => tree.buildFlatNodes.filter((node) => {
  let parentId = node.parentId
  while (parentId) {
    if (!expandedDetailNodeIds.value.has(parentId)) return false
    parentId = detailNodeMap.value.get(parentId)?.parentId || null
  }
  return true
}))

const tabs: Array<{ key: BuildTab; label: string; icon: unknown }> = [
  { key: 'diagram', label: 'Diagram', icon: GitBranch },
  { key: 'detail', label: 'Detail Tree', icon: Rows3 },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'json', label: 'JSON', icon: Braces },
]

function isTabDisabled(tab: BuildTab) {
  return tree.isBuilding && buildLockedTabs.has(tab)
}

function selectTab(tab: BuildTab) {
  if (isTabDisabled(tab)) return
  activeTab.value = tab
}

async function createGraph() {
  if (isDisposed || !graphContainer.value || graph || graphLoading) return
  graphLoading = true
  const { Graph } = await import('@antv/g6')
  if (isDisposed || !graphContainer.value) {
    graphLoading = false
    return
  }

  graph = new Graph({
    container: graphContainer.value,
    autoResize: true,
    data: graphData.value,
    animation: graphIsLod.value ? false : { duration: 240, easing: 'ease-out' },
    layout: {
      type: 'd3-force',
      link: { distance: graphDensity.value.linkDistance, strength: 0.55 },
      manyBody: { strength: graphDensity.value.charge },
      center: { strength: 0.45 },
    },
    node: {
      style: (datum: { data?: Record<string, unknown> }) => {
        const depth = Number(datum.data?.depth || 0)
        const density = graphDensity.value
        const shouldShowLabel = !graphIsLod.value && showLabels.value && depth <= density.labelMaxDepth
        return {
          size: Math.max(10, Math.round((34 - depth * 4) * density.nodeScale)),
          fill: String(datum.data?.color || '#16A34A'),
          stroke: '#ffffff',
          lineWidth: 2,
          labelText: shouldShowLabel ? String(datum.data?.title || '') : '',
          labelFill: '#18181B',
          labelFontSize: density.labelFontSize,
          labelFontWeight: 700,
          labelPlacement: 'top',
          labelMaxWidth: density.labelMaxWidth,
          shadowColor: 'rgba(18, 51, 32, 0.18)',
          shadowBlur: 8,
        }
      },
    },
    edge: {
      style: {
        stroke: '#D8E4DC',
        lineWidth: 1.2,
      },
    },
    behaviors: [
      'drag-canvas',
      'zoom-canvas',
      { type: 'drag-element-force', fixed: true },
    ],
  } as never)

  graph.on('node:click', (event: unknown) => {
    const target = (event as { target?: { id?: string } }).target
    if (target?.id) tree.selectNode(target.id)
  })
  graphLoading = false
}

function isGraphDestroyed(target: G6Graph | null) {
  return Boolean((target as unknown as { destroyed?: boolean } | null)?.destroyed)
}

function destroyGraph() {
  if (!graph) return
  if (graphRendering) {
    graphPendingDestroy = true
    return
  }
  graph.destroy()
  graph = null
  graphLoading = false
  graphDensityKey = ''
  hasFitGraph = false
}

function renderGraph() {
  graphRenderQueue = graphRenderQueue
    .catch(() => undefined)
    .then(renderGraphNow)
}

async function renderGraphNow() {
  await nextTick()
  if (isDisposed || activeTab.value !== 'diagram' || !graphContainer.value) return
  try {
    if (graph && graphDensityKey !== graphDensity.value.key) {
      destroyGraph()
    }
    await createGraph()
    if (isDisposed || activeTab.value !== 'diagram' || !graphContainer.value || !graph) return
    graphDensityKey = graphDensity.value.key
    const shouldFit = !hasFitGraph
    const currentGraph = graph
    graphRendering = true
    currentGraph.setData(graphData.value)
    await currentGraph.render()
    if (!isDisposed && graph === currentGraph && !isGraphDestroyed(currentGraph) && shouldFit) {
      await currentGraph.fitView()
      hasFitGraph = true
    }
  } catch (error) {
    if (!isDisposed) console.error(error)
  } finally {
    graphRendering = false
    if (graphPendingDestroy || isDisposed) {
      graphPendingDestroy = false
      destroyGraph()
    }
  }
}

function startDrag(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function endDrag(event?: DragEvent) {
  event?.preventDefault()
  isDragOver.value = false
}

function chooseFile() {
  fileInput.value?.click()
}

function hasDetailChildren(nodeId: string) {
  return Boolean(detailChildCountMap.value.get(nodeId))
}

function toggleDetailNode(nodeId: string) {
  if (!hasDetailChildren(nodeId)) return

  const nextExpanded = new Set(expandedDetailNodeIds.value)
  if (nextExpanded.has(nodeId)) {
    nextExpanded.delete(nodeId)
  } else {
    nextExpanded.add(nodeId)
  }
  expandedDetailNodeIds.value = nextExpanded
}

function setSelectedFile(file: File | undefined) {
  if (!file) return
  selectedFile.value = file
}

async function refreshFilePreview(file: File | null) {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = ''
  }
  previewText.value = ''
  if (!file) return

  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  if (extension === 'pdf' || ['html', 'htm'].includes(extension)) {
    previewObjectUrl.value = URL.createObjectURL(file)
  }
  if (['md', 'markdown', 'mdx', 'txt', 'json', 'html', 'htm'].includes(extension) || file.type.startsWith('text/')) {
    previewText.value = await file.text()
  }
}

async function refreshBackendOriginalPreview() {
  backendOriginalText.value = ''
  if (previewMode.value !== 'original' || activeOriginalFile.value || !backendOriginalUrl.value || !isTextOriginal.value) return

  const response = await fetch(backendOriginalUrl.value)
  if (!response.ok) return
  backendOriginalText.value = await response.text()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  setSelectedFile(input.files?.[0])
}

function handleDrop(event: DragEvent) {
  endDrag(event)
  setSelectedFile(event.dataTransfer?.files?.[0])
}

async function buildSelectedFile() {
  if (!selectedFile.value || tree.isBuilding) return
  await tree.buildFromFile(selectedFile.value, {
    summarize: summarize.value,
  })
}

async function removeBuild(kb: typeof buildHistoryRows.value[number]) {
  if (deletingBuildId.value) return
  const confirmed = window.confirm(`删除 Tree「${kb.name}」？这个操作会删除对应的构建记录、索引和原始文件。`)
  if (!confirmed) return

  deletingBuildId.value = kb.id
  await tree.deleteKnowledgeBase(kb.id)
  deletingBuildId.value = null
}

watch(() => tree.currentBuild?.id, () => {
  hasFitGraph = false
  expandedDetailNodeIds.value = new Set(
    tree.buildFlatNodes
      .filter(node => node.depth <= 1 && hasDetailChildren(node.id))
      .map(node => node.id)
  )
})

watch(() => tree.isBuilding, (isBuilding) => {
  if (isBuilding && isTabDisabled(activeTab.value)) {
    activeTab.value = 'preview'
  }
})

watch(selectedFile, file => {
  void refreshFilePreview(file)
})

watch([
  () => tree.currentBuild?.id,
  backendOriginalUrl,
  previewMode,
  isTextOriginal,
], () => {
  void refreshBackendOriginalPreview()
}, { immediate: true })

watch([activeTab, graphData, showLabels], renderGraph, { immediate: true, deep: true })

watch(graphContainer, (container) => {
  resizeObserver?.disconnect()
  if (!container) return
  resizeObserver = new ResizeObserver(() => {
    if (!graphRendering && graph && !isGraphDestroyed(graph)) graph.resize()
  })
  resizeObserver.observe(container)
  renderGraph()
})

onMounted(() => {
  const savedWidth = Number(window.localStorage.getItem(BUILD_SIDEBAR_WIDTH_STORAGE_KEY))
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    setBuildSidebarWidth(savedWidth)
  }
  window.addEventListener('resize', syncBuildSidebarWidth)
})

onBeforeUnmount(() => {
  isDisposed = true
  window.removeEventListener('resize', syncBuildSidebarWidth)
  stopBuildSidebarResize()
  resizeObserver?.disconnect()
  if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value)
  destroyGraph()
})
</script>

<template>
  <div
    class="build-screen"
    :class="{ resizing: isResizingBuildSidebar }"
    :style="{ '--build-sidebar-width': `${buildSidebarWidth}px` }"
  >
    <aside class="build-sidebar">
      <div class="build-sidebar-head">Build Console</div>
      <div
        class="build-sidebar-resizer"
        role="separator"
        aria-label="调整 Build Console 宽度"
        aria-orientation="vertical"
        :aria-valuemin="BUILD_SIDEBAR_MIN_WIDTH"
        :aria-valuemax="getMaxBuildSidebarWidth()"
        :aria-valuenow="Math.round(buildSidebarWidth)"
        tabindex="0"
        @pointerdown="startBuildSidebarResize"
        @keydown.left.prevent="adjustBuildSidebarWidth(-24)"
        @keydown.right.prevent="adjustBuildSidebarWidth(24)"
      ></div>
        <button
          class="dropzone"
          :class="{ dragover: isDragOver }"
          type="button"
          @dragover="startDrag"
          @dragleave="endDrag"
          @drop.prevent="handleDrop"
          @click="chooseFile"
        >
          <Upload :size="34" :stroke-width="1.8" aria-hidden="true" />
          <span v-if="selectedFile"><strong>{{ selectedFile.name }}</strong></span>
          <span v-else>Drop <strong>.md .pdf .html or .zip</strong> here</span>
          <small>{{ selectedFile ? 'Ready to build with real API' : 'or click to browse' }}</small>
        </button>
        <input
          ref="fileInput"
          class="file-input"
          type="file"
          accept=".md,.pdf,.html,.htm,.zip"
          @change="handleFileChange"
        />

        <label class="summary-toggle">
          <input v-model="summarize" type="checkbox" />
          <span class="switch" :class="{ active: summarize }"><span></span></span>
          Generate summaries
        </label>

        <section v-if="shouldShowBuildProgress" class="build-progress-card" :class="tree.buildPhase">
          <div class="progress-track" aria-hidden="true">
            <span :style="{ width: `${tree.buildProgress}%` }"></span>
          </div>
          <div class="progress-inline">
            <span class="progress-label">{{ tree.buildPhaseLabel }}</span>
            <div class="stage-dots" aria-label="Build stages">
              <span
              v-for="stage in buildStages"
              :key="stage.key"
              class="stage-dot"
              :class="[stage.tone, { active: tree.buildPhase === stage.key, done: stage.done }]"
              :title="stage.label"
            ></span>
            </div>
          </div>
          <div v-if="tree.buildTasks.length" class="build-task-list" aria-label="Build task progress">
            <div
              v-for="task in tree.buildTasks"
              :key="task.task"
              class="build-task-row"
              :class="task.status"
            >
              <span class="build-task-status" aria-hidden="true"></span>
              <span class="build-task-main">
                <strong>{{ task.task }}</strong>
                <small>{{ task.description }}</small>
                <em v-if="task.depends_on.length">依赖 {{ task.depends_on.join(', ') }}</em>
              </span>
              <span class="build-task-meta">
                {{ task.status === 'pending' ? '等待' : task.status === 'running' ? '运行中' : task.status === 'done' ? '完成' : '失败' }}
                <small v-if="typeof task.elapsed_ms === 'number'">{{ Math.round(task.elapsed_ms) }}ms</small>
              </span>
            </div>
          </div>
          <details v-if="buildTraceRows.length" class="build-trace-panel" open>
            <summary>
              <span>Trace</span>
              <small>{{ buildTraceRows.length }} events</small>
            </summary>
            <ol class="build-trace-list" aria-label="Build trace timeline">
              <li
                v-for="event in buildTraceRows"
                :key="event.id"
                class="build-trace-row"
                :class="[event.type, event.status]"
              >
                <code>#{{ event.seq }}</code>
                <span class="build-trace-time">{{ formatTraceElapsed(event.elapsed_sec) }}</span>
                <span class="build-trace-main">
                  <strong>{{ event.task || event.stage }}</strong>
                  <small>{{ event.message }}</small>
                </span>
                <span class="build-trace-type">{{ event.type }}</span>
              </li>
            </ol>
          </details>
        </section>
        <button v-else class="build-button" :disabled="!selectedFile" @click="buildSelectedFile">
          {{ selectedFile ? 'Build Tree' : 'Select a file' }}
        </button>

        <p v-if="tree.error" class="build-error">
          <AlertCircle :size="14" :stroke-width="2" aria-hidden="true" />
          <span>{{ tree.error }}</span>
          <button type="button" @click="tree.loadHistory()">Retry</button>
        </p>

        <section class="history-card">
          <div class="history-head">
            <span>History</span>
            <button type="button" @click="tree.loadHistory()">
              {{ tree.isLoadingHistory ? 'Loading' : 'Refresh' }}
            </button>
          </div>
          <div class="history-list">
            <p v-if="tree.historyGuard.status !== 'ready'" class="history-empty">
              {{ tree.historyGuard.title }}
              <small>{{ tree.historyGuard.description }}</small>
            </p>
            <div
              v-for="kb in buildHistoryRows"
              :key="kb.id"
              class="history-row"
            >
              <button
                class="history-item"
                :class="{ active: kb.id === tree.activeKnowledgeBaseId }"
                @click="tree.setActiveKnowledgeBase(kb.id)"
              >
                <span class="history-name">{{ kb.name }}</span>
                <span class="nodes-badge">{{ kb.nodeCount }} nodes</span>
                <span class="history-mode" :title="kb.updatedAtTitle">{{ kb.updatedAtLabel }}</span>
              </button>
              <button
                class="history-delete"
                type="button"
                :disabled="deletingBuildId === kb.id"
                :aria-label="`删除 Tree ${kb.name}`"
                :title="`删除 ${kb.name}`"
                @click.stop="removeBuild(kb)"
              >
                <Trash2 :size="12" :stroke-width="2.2" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
    </aside>

    <main class="build-main">
      <nav class="result-tabs" aria-label="Build result views">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="{ active: activeTab === tab.key, disabled: isTabDisabled(tab.key) }"
          :disabled="isTabDisabled(tab.key)"
          :title="isTabDisabled(tab.key) ? 'Building in progress. Available after parsing completes.' : ''"
          @click="selectTab(tab.key)"
        >
          <component :is="tab.icon" :size="13" :stroke-width="2" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </nav>

      <section class="file-summary">
        <div class="file-title">
          <h2>{{ tree.activeBuildTitle }}</h2>
        </div>
        <div class="file-stats">
          <span>{{ tree.activeBuildNodeCount }} nodes</span>
          <span>{{ currentStats?.input_tokens || 0 }} in</span>
          <span>{{ currentStats?.output_tokens || 0 }} out</span>
        </div>
        <span class="file-time" :title="currentBuildTimeTitle">{{ currentBuildTimeLabel }}</span>
        <div
          v-if="activeTab === 'preview' && (previewFileName || parsedSourceText)"
          class="preview-mode-toggle"
          aria-label="Preview mode"
        >
          <button
            type="button"
            :class="{ active: previewMode === 'original' }"
            :disabled="!hasOriginalPreview"
            :title="hasOriginalPreview ? '查看上传原件' : '当前构建没有可访问的原件，请重新选择文件或检查后端原件接口'"
            @click="previewMode = 'original'"
          >
            原件
          </button>
          <button
            type="button"
            :class="{ active: previewMode === 'parsed' }"
            @click="previewMode = 'parsed'"
          >
            解析文本
          </button>
        </div>
      </section>

      <section class="canvas-shell">
        <div
          class="canvas-card"
          :class="{ 'preview-empty-card': activeTab === 'preview' && ['missing-original', 'empty'].includes(previewKind) }"
        >
          <button v-if="activeTab === 'diagram'" class="labels-toggle" @click="showLabels = !showLabels">
            <span :class="{ active: showLabels }"><span></span></span>
            Labels
          </button>
          <div v-if="activeTab === 'diagram' && graphIsLod" class="graph-lod-note">
            {{ graphLodText }}
          </div>

          <div v-if="activeTab === 'diagram'" ref="graphContainer" class="diagram-canvas"></div>

          <div v-else-if="activeTab === 'detail'" class="detail-tree">
            <button
              v-for="node in visibleDetailNodes"
              :key="node.id"
              class="detail-row"
              :style="{ paddingLeft: `${node.depth * 18 + 14}px` }"
              :class="{ selected: tree.selectedNodeId === node.id }"
              @click="tree.selectNode(node.id)"
            >
              <span
                v-if="hasDetailChildren(node.id)"
                class="detail-expander"
                :class="{ expanded: expandedDetailNodeIds.has(node.id) }"
                role="button"
                tabindex="0"
                aria-label="Toggle node"
                @click.stop="toggleDetailNode(node.id)"
                @keydown.enter.stop.prevent="toggleDetailNode(node.id)"
                @keydown.space.stop.prevent="toggleDetailNode(node.id)"
              >
                <ChevronDown :size="13" :stroke-width="2" aria-hidden="true" />
              </span>
              <span v-else class="row-spacer"></span>
              <span class="row-dot"></span>
              <span>{{ node.title }}</span>
              <small>{{ node.tokenCount }} tkn</small>
            </button>
          </div>

          <article v-else-if="activeTab === 'preview'" class="preview-panel" :class="previewKind">
            <div v-if="previewKind === 'pdf' && originalPreviewUrl" class="preview-frame-wrap">
              <iframe class="preview-frame" :src="originalPreviewUrl" title="PDF preview"></iframe>
            </div>
            <div v-else-if="previewKind === 'html'" class="preview-frame-wrap">
              <iframe
                class="preview-frame"
                title="HTML preview"
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                :src="originalPreviewUrl"
              ></iframe>
            </div>
            <div v-else-if="previewKind === 'markdown'" class="preview-document markdown-body" v-html="previewMarkdownHtml"></div>
            <pre v-else-if="previewKind === 'text'" class="preview-text">{{ activePreviewText || '当前 build 没有返回 raw_text，无法还原完整原始文件。' }}</pre>
            <div v-else-if="previewKind === 'missing-original'" class="preview-empty">
              <FileText :size="24" :stroke-width="1.8" aria-hidden="true" />
              <span>当前构建没有可访问的原件；请重新选择同名文件，或检查后端原件预览接口。</span>
              <button type="button" @click="chooseFile">选择原件</button>
            </div>
            <div v-else class="preview-empty">
              <FileText :size="24" :stroke-width="1.8" aria-hidden="true" />
              <span>选择或构建一个文件后查看真实预览。</span>
            </div>
          </article>

          <div v-else class="json-panel">
            <JsonRenderer :value="tree.currentBuild" raw />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

$plant: $color-primary;
$plant-soft: $color-accent;
$border: $color-border;
$text-dark: $color-text;
$muted: $color-text-light;
$bg: $color-surface-bg;

.build-screen {
  display: flex;
  gap: $space-screen;
  width: 100%;
  height: 100%;
  padding: $space-screen;
  background: $bg;
  color: $text-dark;

  &.resizing {
    cursor: col-resize;

    * {
      user-select: none;
    }
  }
}

.build-sidebar {
  position: relative;
  width: var(--build-sidebar-width, #{$build-sidebar-width});
  min-width: 240px;
  max-width: 460px;
  height: 100%;
  padding: 10px;
  border: 1px solid $border;
  border-radius: $radius-panel;
  background: #fff;
  box-shadow: $shadow-control;
  flex-shrink: 0;
  overflow: hidden;
}

.build-sidebar-resizer {
  position: absolute;
  top: 12px;
  right: -8px;
  bottom: 12px;
  z-index: 3;
  width: 16px;
  cursor: col-resize;
  touch-action: none;

  &::after {
    position: absolute;
    top: 50%;
    left: 7px;
    width: 2px;
    height: 42px;
    border-radius: 999px;
    background: rgba($color-border, 0.95);
    content: '';
    transform: translateY(-50%);
    transition: background $transition-fast, box-shadow $transition-fast;
  }

  &:hover::after,
  &:focus-visible::after {
    background: rgba($plant, 0.58);
    box-shadow: 0 0 0 3px rgba($plant, 0.1);
  }

  &:focus-visible {
    outline: none;
  }
}

.build-sidebar-head {
  min-height: 20px;
  margin-bottom: 10px;
  color: $muted;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
}

.dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  height: 98px;
  gap: 5px;
  border: 1px solid $border;
  border-radius: $radius-control;
  background: #fff;
  color: $muted;
  cursor: pointer;
  font-size: $font-size-sm;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: border-color $transition-normal, background $transition-normal, box-shadow $transition-normal, transform $transition-normal;

  &::before {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, rgba($plant, 0.14) 0%, transparent 70%);
    content: '';
    opacity: 0;
    transition: opacity $transition-normal;
  }

  &:hover,
  &.dragover {
    border-color: rgba($plant, 0.45);
    background: $plant-soft;
    box-shadow: $shadow-panel;
    transform: translateY(-2px);

    &::before { opacity: 1; }

    svg { transform: scale(1.08); }
  }

  svg,
  span,
  small {
    position: relative;
    z-index: 1;
  }

  svg {
    color: $plant;
    transition: transform $transition-bounce, color $transition-normal;
  }
  strong { color: $text-dark; }
  small { color: $muted; font-size: $font-size-xs; }
}

.file-input {
  display: none;
}

.control-card,
.history-card {
  margin-top: 10px;
  padding: 12px 10px;
  border: 1px solid $border;
  border-radius: $radius-control;
  background: #fff;
  box-shadow: $shadow-control;
}

.control-card {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 8px;
}

.control-label,
.history-head span {
  color: $muted;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.08em;
  line-height: 1.25;
  text-transform: uppercase;
}

.summary-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  color: $text-dark;
  cursor: pointer;
  font-size: $font-size-sm;

  input {
    display: none;
  }
}

.switch,
.labels-toggle > span {
  position: relative;
  width: 25px;
  height: 14px;
  border-radius: 99px;
  background: $plant;
  flex-shrink: 0;

  span {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
  }

  &:not(.active) {
    background: $color-border;

    span {
      right: auto;
      left: 2px;
    }
  }
}

.build-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: $radius-control;
  background: $plant;
  color: #fff;
  cursor: pointer;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;

  &:disabled {
    border: 1px solid $border;
    background: $color-surface-bg;
    color: $muted;
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.72;
  }

  &:hover:not(:disabled) {
    background: #15803d;
  }
}

.build-progress-card {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 9px 10px;
  border: 1px solid rgba(34, 197, 94, 0.16);
  border-radius: $radius-control;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: $shadow-control;

  &.uploading {
    border-color: rgba(34, 197, 94, 0.18);

    .progress-track {
      background: rgba(34, 197, 94, 0.11);

      span {
        background: #22c55e;
      }
    }
  }

  &.parsing {
    border-color: rgba(14, 165, 233, 0.18);

    .progress-track {
      background: rgba(14, 165, 233, 0.11);

      span {
        background: #0ea5e9;
      }
    }
  }

  &.building {
    border-color: rgba(245, 158, 11, 0.18);

    .progress-track {
      background: rgba(245, 158, 11, 0.12);

      span {
        background: #f59e0b;
      }
    }
  }
}

.progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba($plant, 0.1);

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #22c55e;
    transition: width 520ms cubic-bezier(0.22, 1, 0.36, 1), background $transition-fast;
  }
}

.progress-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  color: $muted;
  font-size: $font-size-xs;
}

.progress-label {
  color: $muted;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  line-height: 1;
}

.build-task-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.build-task-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid rgba($border, 0.82);
  border-radius: $radius-control;
  background: rgba(255, 255, 255, 0.64);
  color: $muted;
  font-size: $font-size-xs;

  &.running {
    border-color: rgba(245, 158, 11, 0.22);
    background: rgba(245, 158, 11, 0.08);

    .build-task-status {
      background: #f59e0b;
      animation: taskPulse 960ms ease-in-out infinite;
    }
  }

  &.done {
    border-color: rgba(34, 197, 94, 0.18);

    .build-task-status {
      background: #22c55e;
    }
  }

  &.error {
    border-color: rgba($color-error, 0.24);
    background: rgba($color-error, 0.07);

    .build-task-status {
      background: $color-error;
    }
  }
}

.build-task-status {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba($muted, 0.38);
}

.build-task-main {
  display: grid;
  gap: 1px;
  min-width: 0;

  strong,
  small,
  em {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: $text-dark;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }

  small,
  em {
    color: $muted;
    font-size: 10px;
    font-style: normal;
  }
}

.build-task-meta {
  display: grid;
  justify-items: end;
  gap: 1px;
  color: $muted;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;

  small {
    color: rgba($muted, 0.78);
    font-size: 10px;
  }
}

.build-trace-panel {
  margin-top: 10px;
  border: 1px solid rgba($border, 0.72);
  border-radius: $radius-control;
  background: rgba(255, 255, 255, 0.54);

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 8px;
    color: $text-dark;
    cursor: pointer;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    small {
      color: $muted;
      font-size: 10px;
      font-weight: $font-weight-medium;
    }
  }
}

.build-trace-list {
  display: grid;
  gap: 0;
  max-height: 180px;
  margin: 0;
  padding: 0 8px 8px;
  overflow: auto;
  list-style: none;
}

.build-trace-row {
  display: grid;
  grid-template-columns: 34px 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  border-top: 1px solid rgba($border, 0.58);
  color: $muted;
  font-size: 10px;

  &.done,
  &.progress.done {
    .build-trace-type {
      color: #16a34a;
    }
  }

  &.error,
  &.task_error {
    .build-trace-type {
      color: $color-error;
    }
  }

  code {
    color: rgba($muted, 0.82);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
  }
}

.build-trace-time,
.build-trace-type {
  white-space: nowrap;
}

.build-trace-main {
  display: grid;
  gap: 1px;
  min-width: 0;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: $text-dark;
    font-size: 10px;
    font-weight: $font-weight-semibold;
  }

  small {
    color: $muted;
    font-size: 10px;
  }
}

.build-trace-type {
  color: rgba($muted, 0.82);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.stage-dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.stage-dot {
  width: 8px;
  height: 8px;
  border: none;
  border-radius: 50%;
  opacity: 0.34;
  transition: opacity $transition-fast, box-shadow $transition-fast, transform $transition-fast;

  &.upload {
    background: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  &.parse {
    background: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
  }

  &.build {
    background: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &.done {
    opacity: 0.82;
  }

  &.active {
    opacity: 1;
    transform: scale(1.14);
  }

  &.upload.active {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
  }

  &.parse.active {
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.18);
  }

  &.build.active {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
  }
}

.spin {
  animation: spin 900ms linear infinite;
}

.build-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 9px;
  color: $color-error;
  font-size: $font-size-xs;
  line-height: $line-height-base;

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  span {
    flex: 1;
  }

  button {
    border: none;
    background: transparent;
    color: $color-primary;
    cursor: pointer;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }
}

.history-card {
  min-height: 216px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  button {
    border: none;
    background: transparent;
    color: $muted;
    cursor: pointer;
    font-size: $font-size-xs;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 168px;
  overflow: auto;
}

.history-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid $border;
  border-radius: $radius-control;
  background: $bg;
  color: $muted;
  font-size: $font-size-xs;
  line-height: $line-height-base;

  small {
    font-size: $font-size-xs;
    opacity: 0.82;
  }
}

.history-row {
  position: relative;
}

.history-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding-right: 38px;
  padding-top: 11px;
  padding-bottom: 11px;
  padding-left: 10px;
  border: 1px solid $border;
  border-radius: $radius-control;
  background: #fff;
  color: $text-dark;
  cursor: pointer;
  text-align: left;

  &.active,
  &:hover {
    border-color: rgba($plant, 0.28);
    background: #fbfdfb;
  }
}

.history-delete {
  position: absolute;
  top: 9px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid $border;
  border-radius: 999px;
  background: #fff;
  color: $muted;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast, color $transition-fast;

  &:hover:not(:disabled) {
    border-color: rgba($plant, 0.28);
    color: $plant;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }
}

.history-name,
.history-mode {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-name {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
}

.nodes-badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: #dff8ee;
  color: #00a876;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
}

.history-mode {
  color: $muted;
  font-size: $font-size-xs;
}

.build-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  border: 1px solid $border;
  border-radius: $radius-panel;
  background: #fff;
  box-shadow: $shadow-panel;
  overflow: hidden;
}

.result-tabs {
  display: flex;
  gap: 8px;
  height: 44px;
  padding: 6px 18px 0;
  border-bottom: 1px solid $border;
  background: #fff;

  button {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 94px;
    height: 30px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: $radius-small;
    background: transparent;
    color: $muted;
    cursor: pointer;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;

    &.active {
      border-color: $plant;
      background: $plant-soft;
      color: $plant;
    }

    &:disabled,
    &.disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
  }
}

.file-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 60px;
  padding: 10px 24px;
  border-bottom: 1px solid $border;
  background: $bg;
}

.file-title {
  min-width: 0;
  flex-shrink: 0;
}

.file-title h2 {
  margin: 0;
  overflow: hidden;
  color: $text-dark;
  font-size: $font-size-title;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  color: $muted;
  font-size: $font-size-xs;
  line-height: 1;

  span {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border: 1px solid $border;
    border-radius: 999px;
    background: #fff;
    box-shadow: $shadow-control;
    white-space: nowrap;
  }
}

.file-time {
  margin-left: auto;
  color: $muted;
  font-size: $font-size-xs;
  line-height: 1;
  white-space: nowrap;
}

.canvas-shell {
  flex: 1;
  min-height: 0;
  padding: 16px;
  background: #fff;
}

.canvas-card {
  position: relative;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $radius-panel;
  background: #fff;
  box-shadow: $shadow-panel;
}

.canvas-card.preview-empty-card {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.labels-toggle {
  position: absolute;
  top: 22px;
  right: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid $border;
  border-radius: $radius-small;
  background: #fff;
  color: $text-dark;
  cursor: pointer;
  font-size: $font-size-sm;
}

.graph-lod-note {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 3;
  max-width: min(480px, calc(100% - 28px));
  padding: 7px 10px;
  border: 1px solid rgba($color-primary, 0.16);
  border-radius: $radius-small;
  background: rgba(255, 255, 255, 0.86);
  color: $muted;
  font-size: $font-size-xs;
  line-height: 1.35;
  backdrop-filter: blur(10px);
}

.diagram-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
}

.detail-tree {
  height: 100%;
  overflow: auto;
  padding: 16px 0;
}

.detail-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 7px;
  padding-top: 7px;
  padding-right: 18px;
  padding-bottom: 7px;
  border: none;
  background: transparent;
  color: $text-dark;
  cursor: pointer;
  text-align: left;

  &:hover,
  &.selected { background: $bg; }

  small {
    margin-left: auto;
    color: $muted;
    font-size: $font-size-xs;
  }
}

.detail-expander,
.row-spacer {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.detail-expander {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-small;
  color: $muted;
  transition: background $transition-fast, color $transition-fast, transform $transition-fast;

  svg {
    transform: rotate(-90deg);
    transition: transform $transition-fast;
  }

  &:hover {
    background: rgba($plant, 0.1);
    color: $plant;
  }

  &.expanded svg {
    transform: rotate(0deg);
  }
}

.row-spacer { display: inline-block; }
.row-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $plant;
  flex-shrink: 0;
}

.preview-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  color: $text-dark;
}

.preview-mode-toggle {
  display: inline-flex;
  flex-shrink: 0;
  gap: 3px;
  padding: 3px;
  border: 1px solid rgba($color-border, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: $shadow-control;
  backdrop-filter: blur(12px);

  button {
    min-width: 58px;
    height: 24px;
    padding: 0 9px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: $muted;
    cursor: pointer;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;

    &.active {
      background: $plant;
      color: #fff;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.46;
    }
  }
}

.preview-frame-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: #fff;
  display: block;
}

.preview-document {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 28px 34px;
  background: #fff;
  color: $text-dark;
  font-size: $font-size-md;
  line-height: $line-height-relaxed;
}

.markdown-body {
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 1.1em 0 0.45em;
    color: $text-dark;
    line-height: $line-height-tight;
  }

  :deep(h1) { font-size: 24px; }
  :deep(h2) { font-size: 20px; }
  :deep(h3) { font-size: 17px; }

  :deep(p),
  :deep(ul),
  :deep(ol),
  :deep(blockquote),
  :deep(pre),
  :deep(table) {
    margin: 0.75em 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.45em;
  }

  :deep(blockquote) {
    padding: 8px 12px;
    border-left: 3px solid rgba($plant, 0.35);
    border-radius: 0 $radius-small $radius-small 0;
    background: $bg;
    color: $muted;
  }

  :deep(pre) {
    overflow: auto;
    padding: 12px;
    border: 1px solid $border;
    border-radius: $radius-control;
    background: #f6f8f7;
  }

  :deep(code) {
    font-family: $font-mono;
    font-size: 0.92em;
  }

  :deep(:not(pre) > code) {
    padding: 2px 5px;
    border-radius: $radius-small;
    background: $bg;
  }

  :deep(table) {
    display: block;
    max-width: 100%;
    overflow: auto;
    border-collapse: collapse;
  }

  :deep(.katex-display) {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.35em 0;
  }

  :deep(.katex) {
    font-size: 1.02em;
  }

  :deep(th),
  :deep(td) {
    padding: 7px 9px;
    border: 1px solid $border;
    text-align: left;
    vertical-align: top;
  }

  :deep(img) {
    display: block;
    max-width: 100%;
    height: auto;
    max-height: 70vh;
    object-fit: contain;
    border-radius: $radius-control;
  }
}

.preview-text {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow: auto;
  padding: 24px;
  background: #fff;
  color: $text-dark;
  font-family: $font-mono;
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border: none;
  background: transparent;
  box-shadow: none;
  color: $muted;
  font-size: $font-size-sm;
  text-align: center;

  button {
    padding: 0;
    border: none;
    background: transparent;
    color: $plant;
    cursor: pointer;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;

    &:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
}

.json-panel {
  height: 100%;
  margin: 0;
  overflow: auto;
  padding: 18px;
  background: #fff;
  color: $text-dark;
}

@media (max-width: 1100px) {
  .build-screen {
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 960px) {
  .build-screen {
    flex-direction: column;
    align-items: stretch;
  }

  .build-sidebar {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: auto;
  }

  .build-sidebar-resizer {
    display: none;
  }

  .build-main {
    min-height: 0;
  }

  .file-summary {
    flex-wrap: wrap;
    align-items: flex-start;
    min-height: auto;
    row-gap: 10px;
  }

  .file-title {
    flex: 1 1 100%;
  }

  .file-stats {
    flex: 1 1 100%;
    flex-wrap: wrap;
    gap: 6px;
    overflow-x: visible;
  }

  .file-time {
    margin-left: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-mode-toggle {
    flex: 1 1 100%;
    justify-content: flex-start;
    margin-left: 0;
  }
}

@media (max-width: 720px) {
  .build-screen {
    gap: 10px;
    padding: 10px;
  }

  .result-tabs {
    flex-wrap: wrap;
    height: auto;
    padding: 6px 12px;
  }

  .result-tabs button {
    min-width: 0;
    flex: 1 1 calc(50% - 8px);
    justify-content: center;
  }

  .file-summary {
    gap: 8px 10px;
    padding: 10px 14px;
  }

  .file-stats span {
    height: 22px;
    padding: 0 8px;
  }

  .preview-mode-toggle {
    width: 100%;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes taskPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.2);
  }

  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
  }
}
</style>
