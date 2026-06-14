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
  popupNodeId.value ? tree.getNodeById(popupNodeId.value) : undefined
))

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

onBeforeUnmount(clearPopupCloseTimer)
</script>

<template>
  <div class="universe-view">
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
</style>
