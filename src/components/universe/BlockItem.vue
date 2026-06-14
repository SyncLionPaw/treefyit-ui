<script setup lang="ts">
import { computed } from 'vue'
import type { FlatNode } from '../../types'
import { useUiStore } from '../../stores/uiStore'
import { universeNodeColor } from '../../utils/colorPalette'

const props = defineProps<{
  node: FlatNode
  zDepth: number
  isNear: boolean
  compactness?: number
}>()

const ui = useUiStore()

const isHovered = computed(() => ui.hoveredNodeId === props.node.id)
const blockColor = computed(() => universeNodeColor(props.node))

const size = computed(() => {
  const base = props.isNear ? 100 : 72
  const extra = Math.min(props.node.tokenCount / 28, 28)
  const compactScale = 1 - Math.min(props.compactness || 0, 1) * 0.36
  return Math.round((base + extra) * compactScale)
})

const opacity = computed(() => {
  if (isHovered.value) return 0.85
  if (props.isNear) return 0.35 + Math.min(props.node.tokenCount / 600, 0.2)
  return 0.28 + Math.min(props.node.tokenCount / 1000, 0.12)
})

const scale = computed(() => {
  if (isHovered.value) return 1.05
  if (props.isNear) return 0.95 + Math.min(props.node.tokenCount / 800, 0.1)
  return 0.82 - Math.min(props.compactness || 0, 1) * 0.1
})

const glowIntensity = computed(() => {
  if (!props.isNear) return 0
  if (isHovered.value) return 20
  return 8
})
</script>

<template>
  <div
    class="block-item"
    :class="{ hovered: isHovered, near: isNear }"
    :style="{
      '--node-color': blockColor,
      width: size + 'px',
      height: size + 'px',
      opacity: opacity,
      transform: `translateZ(${zDepth + (isHovered ? 30 : 0)}px) scale(${scale})`,
      '--glow': glowIntensity + 'px',
    }"
    @mouseenter="ui.setHoveredNode(node.id)"
    @mouseleave="ui.setHoveredNode(null)"
  >
    <div class="block-title">{{ node.title }}</div>
    <div class="block-source">{{ node.source }}</div>
    <div class="block-bar">
      <div
        class="block-bar-fill"
        :style="{ width: Math.min(node.tokenCount / 5, 100) + '%' }"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.block-item {
  border-radius: $radius-small;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--node-color) 24%, transparent), rgba(255,255,255,0.035)),
    rgba(255,255,255,0.045);
  border: 1px solid color-mix(in srgb, var(--node-color) 36%, rgba(255,255,255,0.08));
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  cursor: default;
  transition: transform 300ms ease, opacity 300ms ease, box-shadow 300ms ease;
  pointer-events: none;

  &.near {
    cursor: pointer;
    border-color: rgba(255,255,255,0.08);
    box-shadow: 0 0 var(--glow, 0px) var(--node-color);
    animation: breatheGlow 4s ease-in-out infinite;
    pointer-events: auto;
  }

  &.hovered {
    border-color: var(--node-color);
  }
}

.block-title {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: rgba(255,255,255,0.85);
  line-height: $line-height-tight;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-source {
  font-size: $font-size-xs;
  color: rgba(255,255,255,0.35);
  margin-top: 2px;
}

.block-bar {
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}

.block-bar-fill {
  height: 100%;
  background: var(--node-color);
  border-radius: 2px;
  opacity: 0.6;
}

@keyframes breatheGlow {
  0%, 100% { box-shadow: 0 0 6px var(--node-color); }
  50% { box-shadow: 0 0 18px var(--node-color); }
}
</style>
