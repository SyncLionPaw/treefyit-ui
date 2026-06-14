<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useTreeStore } from '../../stores/treeStore'
import BlockItem from './BlockItem.vue'

const tree = useTreeStore()

const compactness = computed(() => Math.max(0, Math.min(1, (tree.flatNodes.length - 24) / 120)))
const backgroundBlocks = computed(() => (
  tree.flatNodes
    .slice()
    .sort((a, b) => b.tokenCount - a.tokenCount)
))
const wallStyle = computed(() => ({
  '--block-gap': `${Math.round(10 - compactness.value * 5)}px`,
  '--block-padding': `${Math.round(80 - compactness.value * 34)}px`,
}))

const farOffset = ref({ x: 0, y: 0 })

function handleMouse(e: MouseEvent) {
  const nx = (e.clientX / window.innerWidth - 0.5) * 2
  const ny = (e.clientY / window.innerHeight - 0.5) * 2
  farOffset.value = { x: nx * 2.5, y: ny * 1.8 }
}

onMounted(() => window.addEventListener('mousemove', handleMouse))
onUnmounted(() => window.removeEventListener('mousemove', handleMouse))
</script>

<template>
  <div class="block-wall" :style="wallStyle">
    <div
      class="block-group background"
      :style="{ transform: `translate3d(${farOffset.x}px, ${farOffset.y}px, -520px) scale(${0.74 - compactness * 0.08})` }"
    >
      <BlockItem
        v-for="node in backgroundBlocks"
        :key="node.id"
        :node="node"
        :z-depth="-140 - node.depth * 18"
        :is-near="false"
        :compactness="compactness"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.block-wall {
  position: absolute;
  inset: 0;
  z-index: $z-block-wall;
  perspective: 1600px;
  pointer-events: none;
  transform-style: preserve-3d;
}

.block-group {
  position: absolute;
  inset: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: var(--block-gap, 10px);
  padding: var(--block-padding, 80px);
  transform-style: preserve-3d;
  transition: transform 140ms linear;

  &.background {
    opacity: 0.72;
    filter: saturate(1.08);
  }
}
</style>
