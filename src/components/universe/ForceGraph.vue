<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import { useForceGraph } from '../../composables/useForceGraph'

const svg = ref<SVGSVGElement | null>(null)
const tree = useTreeStore()
const ui = useUiStore()
const { selectedNodeId } = storeToRefs(tree)
const { hoveredNodeId, isUniverseLabelsVisible } = storeToRefs(ui)

const nodes = computed(() => tree.flatNodes)
const links = computed(() => tree.links)

const graph = useForceGraph(svg, nodes, links, {
  hoveredNodeId,
  selectedNodeId,
  showLabels: isUniverseLabelsVisible,
  onHover: ui.setHoveredNode,
  onSelect: tree.selectNode,
})

onUnmounted(graph.teardown)
</script>

<template>
  <svg
    ref="svg"
    class="force-graph"
    aria-label="知识树力导布局"
    role="img"
  ></svg>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.force-graph {
  position: absolute;
  inset: 0;
  z-index: $z-force-graph;
  width: 100%;
  height: 100%;
  overflow: visible;
  touch-action: none;
}

:deep(.node) {
  transition: opacity 200ms ease;
}

:deep(.node.is-dimmed) {
  opacity: 0.24;
}

:deep(.node text) {
  pointer-events: none;
  user-select: none;
}

:deep(.node .core),
:deep(.node .glow) {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 220ms ease, opacity 220ms ease;
}

:deep(.node .label) {
  paint-order: stroke;
  stroke: rgba(10, 10, 15, 0.72);
  stroke-linejoin: round;
  stroke-width: 3px;
  transition: opacity 180ms ease;
}

:deep(.node.is-hovered text),
:deep(.node.is-selected text) {
  fill: rgba(255, 255, 255, 0.95);
  font-weight: 700;
}

:deep(.links line) {
  transition: stroke 180ms ease, stroke-width 180ms ease;
}
</style>
