<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Graph as G6Graph } from '@antv/g6'
import type { TreeNode } from '../../types'

defineOptions({ name: 'ChatReplayBuildGraph' })

const props = defineProps<{
  trees: TreeNode[]
  activeNodeId?: string
  activePathIds: Set<string>
}>()

const graphContainer = ref<HTMLDivElement | null>(null)
let graph: G6Graph | null = null
let graphLoading = false
let hasFitGraph = false

const viewportAnimation = { duration: 320, easing: 'ease-out' }
const REPLAY_FULL_RENDER_LIMIT = 650
const REPLAY_LOD_NODE_LIMIT = 360

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function nodeId(node: TreeNode) {
  return node.id || node.path || node.title
}

function nodeTitle(node: TreeNode) {
  return node.title || node.path || 'Untitled node'
}

function countTreeNodes(trees: TreeNode[]) {
  let count = 0
  function walk(node: TreeNode) {
    count += 1
    const children = node.children || []
    children.forEach(walk)
  }
  trees.forEach(walk)
  return count
}

const graphSettings = computed(() => {
  const count = countTreeNodes(props.trees)
  const density = clamp((count - 36) / 760, 0, 1)
  return {
    count,
    levelGap: Math.round(132 - density * 54),
    leafGap: Math.round(132 - density * 86),
    maxSpread: Math.round(980 + density * 360),
    nodeScale: 1 - density * 0.46,
  }
})

function flattenReplayNodes(trees: TreeNode[]) {
  const items: Array<{ node: TreeNode; id: string; depth: number; parentId?: string }> = []
  function walk(node: TreeNode, depth: number, parentId?: string) {
    const id = nodeId(node)
    items.push({ node, id, depth, parentId })
    ;(node.children || []).forEach(child => walk(child, depth + 1, id))
  }
  trees.forEach(tree => walk(tree, 0))
  return items
}

function collectReplayVisibleIds(trees: TreeNode[]) {
  const items = flattenReplayNodes(trees)
  if (items.length <= REPLAY_FULL_RENDER_LIMIT) return null

  const visible = new Set<string>()
  const itemMap = new Map(items.map(item => [item.id, item]))
  const childrenMap = new Map<string, string[]>()
  for (const item of items) {
    if (!item.parentId) continue
    const children = childrenMap.get(item.parentId) || []
    children.push(item.id)
    childrenMap.set(item.parentId, children)
  }

  function add(id?: string) {
    if (!id || visible.size >= REPLAY_LOD_NODE_LIMIT) return
    visible.add(id)
  }

  function addAncestors(id?: string) {
    let cursor = id ? itemMap.get(id) : undefined
    while (cursor) {
      add(cursor.id)
      cursor = cursor.parentId ? itemMap.get(cursor.parentId) : undefined
    }
  }

  items.filter(item => item.depth <= 1).forEach(item => add(item.id))
  props.activePathIds.forEach(id => addAncestors(id))
  addAncestors(props.activeNodeId)
  ;(childrenMap.get(props.activeNodeId || '') || []).forEach(add)
  const activeParentId = props.activeNodeId ? itemMap.get(props.activeNodeId)?.parentId : undefined
  ;(childrenMap.get(activeParentId || '') || []).forEach(add)
  items.filter(item => item.depth <= 2).forEach(item => add(item.id))
  items.forEach(item => add(item.id))

  return visible
}

function collectGraphData(trees: TreeNode[]) {
  const nodes: Array<{ id: string; data: Record<string, unknown>; style: { x: number; y: number } }> = []
  const edges: Array<{ source: string; target: string }> = []
  const { levelGap, leafGap, maxSpread } = graphSettings.value
  const visibleIds = collectReplayVisibleIds(trees)
  let cursor = 0

  function walk(node: TreeNode, depth: number, parentId?: string, siblingIndex = 0, siblingCount = 1): number {
    const id = nodeId(node)
    if (visibleIds && !visibleIds.has(id)) return cursor * leafGap
    const children = (node.children || []).filter(child => !visibleIds || visibleIds.has(nodeId(child)))
    const childXs = children.map((child, index) => walk(child, depth + 1, id, index, children.length))
    const x = childXs.length
      ? (Math.min(...childXs) + Math.max(...childXs)) / 2
      : cursor++ * leafGap
    const fanOffset = siblingCount > 1 ? (siblingIndex - (siblingCount - 1) / 2) * 18 : 0
    const anchoredX = x + fanOffset
    const y = depth * levelGap + 54

    nodes.push({
      id,
      data: {
        title: nodeTitle(node),
        depth,
        treeX: anchoredX,
        treeY: y,
        isActive: id === props.activeNodeId,
        isAncestor: props.activePathIds.has(id) && id !== props.activeNodeId,
      },
      style: { x: anchoredX, y },
    })

    if (parentId) edges.push({ source: parentId, target: id })
    return x
  }

  trees.forEach(tree => walk(tree, 0))
  const minX = Math.min(...nodes.map(node => node.style.x), 0)
  const maxX = Math.max(...nodes.map(node => node.style.x), 0)
  const centerX = (minX + maxX) / 2
  const spread = Math.max(maxX - minX, 1)
  const spreadScale = Math.min(1, maxSpread / spread)
  nodes.forEach(node => {
    node.style.x = (node.style.x - centerX) * spreadScale
    node.data.treeX = node.style.x
    node.style.x = Number(node.data.treeX)
  })

  return { nodes, edges }
}

const graphData = computed(() => collectGraphData(props.trees))
const hasActiveGraphNode = computed(() => Boolean(
  props.activeNodeId && graphData.value.nodes.some(node => node.id === props.activeNodeId)
))

async function createGraph() {
  if (!graphContainer.value || graph || graphLoading) return
  graphLoading = true
  const { Graph } = await import('@antv/g6')
  if (!graphContainer.value) {
    graphLoading = false
    return
  }

  graph = new Graph({
    container: graphContainer.value,
    autoResize: true,
    data: graphData.value,
    animation: { duration: 240, easing: 'ease-out' },
    node: {
      style: (datum: { data?: Record<string, unknown> }) => {
        const depth = Number(datum.data?.depth || 0)
        const isActive = Boolean(datum.data?.isActive)
        const isAncestor = Boolean(datum.data?.isAncestor)
        const size = Math.max(7, Math.round((26 - depth * 3) * graphSettings.value.nodeScale))

        return {
          x: Number(datum.data?.treeX || 0),
          y: Number(datum.data?.treeY || 0),
          size,
          fill: isActive
            ? '#F59E0B'
            : isAncestor
              ? 'rgba(245, 158, 11, 0.16)'
              : 'rgba(255, 255, 255, 0.92)',
          stroke: isActive
            ? '#FDE68A'
            : isAncestor
              ? 'rgba(245, 158, 11, 0.52)'
              : 'rgba(82, 100, 91, 0.56)',
          lineWidth: 2,
          labelText: isActive ? String(datum.data?.title || '') : '',
          labelFill: isActive ? '#B45309' : '#18181B',
          labelFontSize: 10,
          labelFontWeight: isActive ? 800 : 700,
          labelPlacement: 'bottom',
          labelMaxWidth: 96,
          shadowColor: isActive ? 'rgba(245, 158, 11, 0.24)' : 'rgba(18, 51, 32, 0.16)',
          shadowBlur: isActive ? 14 : 7,
        }
      },
    },
    edge: {
      style: (datum: { source?: string; target?: string }) => {
        const sourceActive = datum.source ? props.activePathIds.has(String(datum.source)) : false
        const targetActive = datum.target ? props.activePathIds.has(String(datum.target)) : false
        const active = sourceActive && targetActive

        return {
          stroke: active ? 'rgba(245, 158, 11, 0.5)' : 'rgba(216, 228, 220, 0.82)',
          lineWidth: active ? 1.7 : 1.2,
        }
      },
    },
    behaviors: [
      'drag-canvas',
      'zoom-canvas',
      'drag-element',
    ],
  } as never)

  graphLoading = false
}

function renderGraph() {
  void nextTick(async () => {
    if (!graphData.value.nodes.length) return
    await createGraph()
    const shouldFit = !hasFitGraph
    graph?.setData(graphData.value as never)
    await graph?.render()
    if (shouldFit) {
      await graph?.fitView(undefined, viewportAnimation)
      hasFitGraph = true
    }
    if (hasActiveGraphNode.value && props.activeNodeId) {
      await graph?.focusElement(props.activeNodeId, viewportAnimation)
    }
  })
}

watch(() => [props.trees, props.activeNodeId, [...props.activePathIds].join('|')], () => {
  renderGraph()
}, { deep: true, immediate: true })

watch(() => props.trees, () => {
  hasFitGraph = false
}, { deep: true })

onBeforeUnmount(() => {
  graph?.destroy()
  graph = null
})
</script>

<template>
  <div ref="graphContainer" class="replay-build-graph"></div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.replay-build-graph {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba($color-border, 0.72);
  border-radius: $radius-panel;
  background:
    radial-gradient(circle at 50% 0%, rgba(22, 163, 74, 0.09), transparent 36%),
    linear-gradient(180deg, rgba(236, 241, 238, 0.96), rgba(224, 231, 226, 0.88));
}

:global(.theme-dark) .replay-build-graph {
  border-color: #2a2a2a;
  background:
    radial-gradient(circle at 50% 0%, rgba(22, 163, 74, 0.12), transparent 34%),
    rgba(10, 10, 15, 0.34);
}
</style>
