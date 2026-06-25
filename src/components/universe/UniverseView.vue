<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import StarField from './StarField.vue'
import BlockWall from './BlockWall.vue'
import ForceGraph from './ForceGraph.vue'
import NodePopup from './NodePopup.vue'
import UniverseStatusBar from './UniverseStatusBar.vue'

const tree = useTreeStore()
const ui = useUiStore()
const popupNodeId = ref<string | null>(null)
let popupCloseTimer: number | undefined

const popupNode = computed(() => (
  !popupNodeId.value
    ? undefined
    : ui.universeGraphScope === 'tree'
      ? tree.getBuildNodeById(popupNodeId.value)
      : tree.getForestNodeById(popupNodeId.value)
))
const canShowTreeScope = computed(() => tree.hasActiveBuild && tree.buildFlatNodes.length > 0)

function handleTreeChange(event: Event) {
  tree.setActiveKnowledgeBase((event.target as HTMLSelectElement).value)
}

function clearPopupCloseTimer() {
  if (popupCloseTimer) {
    window.clearTimeout(popupCloseTimer)
    popupCloseTimer = undefined
  }
}

function schedulePopupClose() {
  clearPopupCloseTimer()
  popupCloseTimer = window.setTimeout(() => {
    popupNodeId.value = null
    popupCloseTimer = undefined
  }, 260)
}

watch(() => ui.hoveredNodeId, (id) => {
  if (id) {
    clearPopupCloseTimer()
    popupNodeId.value = id
  } else {
    schedulePopupClose()
  }
})

watch(() => ui.universeGraphScope, () => {
  tree.selectNode(null)
  ui.setHoveredNode(null)
  popupNodeId.value = null
})

watch(canShowTreeScope, (ready) => {
  if (!ready && ui.universeGraphScope === 'tree') {
    ui.setUniverseGraphScope('forest')
  }
}, { immediate: true })

onBeforeUnmount(clearPopupCloseTimer)
</script>

<template>
  <div class="universe-view">
    <div class="view-switch" role="tablist" aria-label="图谱视图切换">
      <button
        class="switch-button"
        :class="{ active: ui.universeGraphScope === 'forest' }"
        type="button"
        role="tab"
        :aria-selected="ui.universeGraphScope === 'forest'"
        @click="ui.setUniverseGraphScope('forest')"
      >
        All Knowledge Bases
      </button>
      <button
        class="switch-button"
        :class="{ active: ui.universeGraphScope === 'tree' }"
        type="button"
        role="tab"
        :aria-selected="ui.universeGraphScope === 'tree'"
        :disabled="!canShowTreeScope"
        @click="ui.setUniverseGraphScope('tree')"
      >
        Current Knowledge Base
      </button>
      <select
        v-if="ui.universeGraphScope === 'tree' && tree.knowledgeBases.length > 0"
        class="tree-select"
        :value="tree.activeKnowledgeBaseId"
        aria-label="选择知识库"
        @change="handleTreeChange"
      >
        <option v-for="kb in tree.knowledgeBases" :key="kb.id" :value="kb.id">
          {{ kb.name }}
        </option>
      </select>
    </div>
    <StarField />
    <BlockWall />
    <ForceGraph />
    <NodePopup
      v-if="popupNode"
      :node="popupNode"
      @mouseenter="clearPopupCloseTimer"
      @mouseleave="schedulePopupClose"
    />
    <UniverseStatusBar />
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.universe-view {
  position: fixed;
  top: $nav-height;
  left: 0;
  right: 0;
  bottom: 0;
  background: $universe-bg;
  overflow: hidden;
  z-index: $z-surface;
}

.view-switch {
  position: absolute;
  top: 18px;
  left: 24px;
  z-index: $z-node-popup;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(10, 10, 15, 0.72);
  backdrop-filter: blur(14px);
}

.switch-button,
.tree-select {
  height: 34px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  font-size: $font-size-sm;
}

.switch-button {
  padding: 0 14px;
  cursor: pointer;

  &.active {
    background: rgba($color-primary, 0.22);
    color: #fff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
}

.tree-select {
  min-width: 220px;
  padding: 0 12px;
}
</style>
