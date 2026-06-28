<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
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
const treeMenuOpen = ref(false)
const treeMenuActiveIndex = ref(0)
let popupCloseTimer: number | undefined

const popupNode = computed(() => (
  !popupNodeId.value
    ? undefined
    : ui.universeGraphScope === 'tree'
      ? tree.getBuildNodeById(popupNodeId.value)
      : tree.getForestNodeById(popupNodeId.value)
))
const canShowTreeScope = computed(() => tree.hasActiveBuild && tree.buildFlatNodes.length > 0)
const activeKnowledgeBase = computed(() => (
  tree.knowledgeBases.find(kb => kb.id === tree.activeKnowledgeBaseId) || tree.knowledgeBases[0]
))
const activeKnowledgeBaseIndex = computed(() => (
  Math.max(0, tree.knowledgeBases.findIndex(kb => kb.id === activeKnowledgeBase.value?.id))
))

function openTreeMenu() {
  treeMenuActiveIndex.value = activeKnowledgeBaseIndex.value
  treeMenuOpen.value = true
}

function closeTreeMenu() {
  treeMenuOpen.value = false
}

function toggleTreeMenu() {
  if (treeMenuOpen.value) {
    closeTreeMenu()
    return
  }
  openTreeMenu()
}

function selectKnowledgeBase(id: string) {
  tree.setActiveKnowledgeBase(id)
  closeTreeMenu()
}

function moveTreeMenuSelection(offset: number) {
  const total = tree.knowledgeBases.length
  if (!total) return
  treeMenuActiveIndex.value = (treeMenuActiveIndex.value + offset + total) % total
}

function handleTreeMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeTreeMenu()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!treeMenuOpen.value) openTreeMenu()
    moveTreeMenuSelection(1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!treeMenuOpen.value) openTreeMenu()
    moveTreeMenuSelection(-1)
    return
  }
  if (event.key === 'Enter' && treeMenuOpen.value) {
    event.preventDefault()
    const target = tree.knowledgeBases[treeMenuActiveIndex.value]
    if (target) selectKnowledgeBase(target.id)
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.tree-select-wrap')) return
  closeTreeMenu()
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
  closeTreeMenu()
  tree.selectNode(null)
  ui.setHoveredNode(null)
  popupNodeId.value = null
})

watch(canShowTreeScope, (ready) => {
  if (!ready && ui.universeGraphScope === 'tree') {
    ui.setUniverseGraphScope('forest')
  }
}, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  clearPopupCloseTimer()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
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
      <div
        v-if="ui.universeGraphScope === 'tree' && tree.knowledgeBases.length > 0"
        class="tree-select-wrap"
        @keydown="handleTreeMenuKeydown"
      >
        <button
          class="tree-select"
          type="button"
          aria-label="选择知识库"
          :aria-expanded="treeMenuOpen"
          aria-haspopup="listbox"
          @click="toggleTreeMenu"
        >
          <span>{{ activeKnowledgeBase?.name || '选择知识库' }}</span>
          <ChevronDown class="tree-select-icon" :class="{ open: treeMenuOpen }" :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <div v-if="treeMenuOpen" class="tree-menu" role="listbox" aria-label="选择知识库">
          <button
            v-for="(kb, index) in tree.knowledgeBases"
            :key="kb.id"
            class="tree-menu-item"
            :class="{
              active: kb.id === tree.activeKnowledgeBaseId,
              focused: index === treeMenuActiveIndex,
            }"
            type="button"
            role="option"
            :aria-selected="kb.id === tree.activeKnowledgeBaseId"
            @mouseenter="treeMenuActiveIndex = index"
            @click="selectKnowledgeBase(kb.id)"
          >
            <span>{{ kb.name }}</span>
            <Check v-if="kb.id === tree.activeKnowledgeBaseId" :size="14" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </div>
      </div>
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

.switch-button {
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

.tree-select-wrap {
  position: relative;
}

.tree-select {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 34px;
  min-width: 220px;
  max-width: 300px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  font-size: $font-size-sm;
  transition: border-color $transition-fast, background $transition-fast, color $transition-fast;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover,
  &[aria-expanded='true'] {
    border-color: rgba($color-primary, 0.56);
    background: rgba($color-primary, 0.22);
    color: #fff;
  }
}

.tree-select-icon {
  flex: 0 0 auto;
  opacity: 0.78;
  transition: transform $transition-fast;

  &.open {
    transform: rotate(180deg);
  }
}

.tree-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, calc(100vw - 48px));
  max-height: 260px;
  overflow: auto;
  padding: 6px;
  border: 1px solid rgba($color-primary, 0.24);
  border-radius: 16px;
  background: rgba(10, 10, 15, 0.94);
  box-shadow: 0 18px 44px rgba($color-primary, 0.16), 0 18px 44px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px);
}

.tree-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 8px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-size: $font-size-sm;
  text-align: left;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.focused {
    background: rgba($color-primary, 0.12);
    color: #fff;
  }

  &.active {
    background: rgba($color-primary, 0.24);
    color: #fff;
  }
}
</style>
