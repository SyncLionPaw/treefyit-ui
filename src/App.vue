<script setup lang="ts">
import { onMounted } from 'vue'
import { useTreeStore } from './stores/treeStore'
import { useUiStore } from './stores/uiStore'
import { useKeyboardNav } from './composables/useKeyboardNav'
import TopNav from './components/nav/TopNav.vue'
import SurfaceViewport from './components/surface/SurfaceViewport.vue'
import UniverseView from './components/universe/UniverseView.vue'

const tree = useTreeStore()
const ui = useUiStore()

useKeyboardNav()

onMounted(() => {
  void tree.loadHistory()
})
</script>

<template>
  <div class="treefyit-app" :class="`theme-${ui.themeMode}`">
    <TopNav />
    <Transition name="surface">
      <SurfaceViewport v-show="!ui.isUniverseMode" />
    </Transition>
    <Transition name="universe">
      <UniverseView v-show="ui.isUniverseMode" />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
@use './assets/styles/variables' as *;

.treefyit-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: $color-surface-bg;
  color: $color-text;
  transition: background $transition-normal, color $transition-normal;
}

.theme-dark {
  background: #101010;
  color: #f4f4f5;
}

.theme-dark :deep(.topnav:not(.universe-mode)) {
  border-bottom-color: #2a2a2a !important;
  background: rgba(16, 16, 16, 0.94) !important;
}

.theme-dark :deep(.logo),
.theme-dark :deep(.tab:hover),
.theme-dark :deep(.file-name),
.theme-dark :deep(.section-title),
.theme-dark :deep(.file-title h2),
.theme-dark :deep(.panel-heading h2) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.center),
.theme-dark :deep(.chat-screen),
.theme-dark :deep(.build-screen),
.theme-dark :deep(.query-screen) {
  background: #101010 !important;
}

.theme-dark :deep(.chat-sidebar),
.theme-dark :deep(.build-sidebar),
.theme-dark :deep(.build-main),
.theme-dark :deep(.query-controls),
.theme-dark :deep(.result-card),
.theme-dark :deep(.canvas-card),
.theme-dark :deep(.api-modal),
.theme-dark :deep(.docs-modal),
.theme-dark :deep(.docs-tabs),
.theme-dark :deep(.docs-content),
.theme-dark :deep(.control-card),
.theme-dark :deep(.build-progress-card),
.theme-dark :deep(.build-task-row),
.theme-dark :deep(.build-trace-panel),
.theme-dark :deep(.history-card),
.theme-dark :deep(.dropzone),
.theme-dark :deep(.history-item),
.theme-dark :deep(.history-summary),
.theme-dark :deep(.history-delete),
.theme-dark :deep(.kb-empty),
.theme-dark :deep(.meta-card),
.theme-dark :deep(.json-view),
.theme-dark :deep(.json-panel),
.theme-dark :deep(.chat-input-area),
.theme-dark :deep(.api-field input),
.theme-dark :deep(.kb-current),
.theme-dark :deep(.kb-item),
.theme-dark :deep(.kb-icon),
.theme-dark :deep(.kb-delete),
.theme-dark :deep(.sidebar-tabs),
.theme-dark :deep(.sidebar-note),
.theme-dark :deep(.kb-pill),
.theme-dark :deep(.select-input),
.theme-dark :deep(.text-input),
.theme-dark :deep(.ghost-btn),
.theme-dark :deep(.secondary-btn),
.theme-dark :deep(.modal-close),
.theme-dark :deep(.labels-toggle) {
  border-color: #2a2a2a !important;
  background: #181818 !important;
  color: #f4f4f5 !important;
}

.theme-dark :deep(.chat-input-area) {
  border-color: transparent !important;
  background: transparent !important;
}

.theme-dark :deep(.input-row) {
  border-color: rgba(255, 255, 255, 0.1) !important;
  background: rgba(10, 10, 15, 0.7) !important;
  box-shadow: none !important;
}

.theme-dark :deep(.input-row:focus-within) {
  border-color: rgba(22, 163, 74, 0.34) !important;
  background: rgba(10, 10, 15, 0.82) !important;
}

.theme-dark :deep(.chat-sidebar.docked) {
  border-color: rgba(255, 255, 255, 0.1) !important;
  background: rgba(10, 10, 15, 0.7) !important;
  box-shadow: none !important;
}

.theme-dark :deep(.kb-dock-dot) {
  background: transparent !important;
  color: #22c55e !important;
}

.theme-dark :deep(.sidebar-tabs button.active) {
  background: #242424 !important;
  color: #f4f4f5 !important;
  box-shadow: none !important;
}

.theme-dark :deep(.docs-tabs button.active) {
  background: #242424 !important;
  color: #f4f4f5 !important;
  box-shadow: none !important;
}

.theme-dark :deep(.input) {
  background: transparent !important;
  color: #f4f4f5 !important;
}

.theme-dark :deep(.theme-btn),
.theme-dark :deep(.api-settings-btn) {
  background: transparent !important;
  color: #a1a1aa !important;
}

.theme-dark :deep(.theme-btn:hover),
.theme-dark :deep(.api-settings-btn:hover) {
  background: rgba(255,255,255,0.1) !important;
  color: #f4f4f5 !important;
}

.theme-dark :deep(.build-button) {
  background: #16a34a !important;
  color: #fff !important;
}

.theme-dark :deep(.build-button:hover:not(:disabled)) {
  background: #15803d !important;
}

.theme-dark :deep(.build-button:disabled) {
  background: #242424 !important;
  color: #71717a !important;
  border: 1px solid #2a2a2a !important;
  box-shadow: none !important;
}

.theme-dark :deep(.progress-track) {
  background: rgba(22, 163, 74, 0.14) !important;
}

.theme-dark :deep(.build-progress-card.uploading) {
  border-color: rgba(34, 197, 94, 0.24) !important;
}

.theme-dark :deep(.build-progress-card.uploading .progress-track) {
  background: rgba(34, 197, 94, 0.14) !important;
}

.theme-dark :deep(.build-progress-card.uploading .progress-track span) {
  background: #22c55e !important;
}

.theme-dark :deep(.build-progress-card.parsing) {
  border-color: rgba(14, 165, 233, 0.24) !important;
}

.theme-dark :deep(.build-progress-card.parsing .progress-track) {
  background: rgba(14, 165, 233, 0.15) !important;
}

.theme-dark :deep(.build-progress-card.parsing .progress-track span) {
  background: #0ea5e9 !important;
}

.theme-dark :deep(.build-progress-card.building) {
  border-color: rgba(245, 158, 11, 0.26) !important;
}

.theme-dark :deep(.build-progress-card.building .progress-track) {
  background: rgba(245, 158, 11, 0.15) !important;
}

.theme-dark :deep(.build-progress-card.building .progress-track span) {
  background: #f59e0b !important;
}

.theme-dark :deep(.progress-label) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.build-task-main strong) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.build-trace-panel summary),
.theme-dark :deep(.build-trace-main strong) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.build-task-main small),
.theme-dark :deep(.build-task-main em),
.theme-dark :deep(.build-task-meta),
.theme-dark :deep(.build-trace-panel summary small),
.theme-dark :deep(.build-trace-row),
.theme-dark :deep(.build-trace-main small),
.theme-dark :deep(.build-trace-type) {
  color: #a1a1aa !important;
}

.theme-dark :deep(.stage-dot) {
  filter: saturate(1.08);
}

.theme-dark :deep(.bubble),
.theme-dark :deep(.result-head),
.theme-dark :deep(.file-summary),
.theme-dark :deep(.canvas-shell),
.theme-dark :deep(.result-tabs),
.theme-dark :deep(.runtime-option),
.theme-dark :deep(.segmented),
.theme-dark :deep(.cloud-note) {
  border-color: #2a2a2a !important;
  background: #151515 !important;
}

.theme-dark :deep(.runtime-option.active),
.theme-dark :deep(.segmented .active),
.theme-dark :deep(.segmented button.active),
.theme-dark :deep(.result-tabs button.active),
.theme-dark :deep(.kb-item.active),
.theme-dark :deep(.history-item.active),
.theme-dark :deep(.history-item:hover),
.theme-dark :deep(.detail-row:hover),
.theme-dark :deep(.detail-row.selected),
.theme-dark :deep(.dropzone:hover),
.theme-dark :deep(.dropzone.dragover) {
  border-color: rgba(22, 163, 74, 0.42) !important;
  background: rgba(22, 163, 74, 0.12) !important;
  color: #8de8ad !important;
}

.theme-dark :deep(.file-stats span),
.theme-dark :deep(.current-meta span),
.theme-dark :deep(.nodes-badge) {
  border-color: rgba(22, 163, 74, 0.24) !important;
  background: rgba(22, 163, 74, 0.12) !important;
  color: #8de8ad !important;
}

.theme-dark :deep(.bubble) {
  color: #f4f4f5;
}

.theme-dark :deep(.message.ai .bubble) {
  border-color: #2a2a2a !important;
  background: rgba(24, 24, 24, 0.82) !important;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24) !important;
}

.theme-dark :deep(.message.system .bubble) {
  border-color: rgba(245, 158, 11, 0.28) !important;
  background: rgba(245, 158, 11, 0.1) !important;
  color: #d4d4d8 !important;
}

.theme-dark :deep(.tool-event) {
  border-color: rgba(59, 130, 246, 0.28) !important;
  background: rgba(59, 130, 246, 0.1) !important;
  color: #f4f4f5 !important;
}

.theme-dark :deep(.tool-event.done) {
  border-color: rgba(22, 163, 74, 0.28) !important;
  background: rgba(22, 163, 74, 0.1) !important;
}

.theme-dark :deep(.tool-event.error) {
  border-color: rgba(230, 57, 70, 0.3) !important;
  background: rgba(230, 57, 70, 0.1) !important;
}

.theme-dark :deep(.tool-icon) {
  background: rgba(255, 255, 255, 0.08) !important;
}

.theme-dark :deep(.tool-title),
.theme-dark :deep(.tool-title code) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.tool-detail) {
  color: #a1a1aa !important;
}

.theme-dark :deep(.tool-details) {
  border-color: #2a2a2a !important;
  background: rgba(24, 24, 24, 0.72) !important;
}

.theme-dark :deep(.flow-source) {
  border-color: #2a2a2a !important;
  background: rgba(24, 24, 24, 0.82) !important;
  color: #a1a1aa !important;
}

.theme-dark :deep(.api-field input:focus),
.theme-dark :deep(.select-input:focus),
.theme-dark :deep(.text-input:focus) {
  border-color: rgba(22, 163, 74, 0.55) !important;
  background: #1d1d1d !important;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12) !important;
}

.theme-dark :deep(.query-select-trigger:hover:not(:disabled)),
.theme-dark :deep(.query-select-trigger[aria-expanded='true']) {
  border-color: rgba(22, 163, 74, 0.55) !important;
  background: rgba(22, 163, 74, 0.12) !important;
  color: #8de8ad !important;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12) !important;
}

.theme-dark :deep(.query-select-menu) {
  border-color: rgba(22, 163, 74, 0.28) !important;
  background: #181818 !important;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34) !important;
}

.theme-dark :deep(.query-select-option) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.query-select-option.focused) {
  background: rgba(22, 163, 74, 0.12) !important;
  color: #8de8ad !important;
}

.theme-dark :deep(.query-select-option.active) {
  background: rgba(22, 163, 74, 0.18) !important;
  color: #8de8ad !important;
}

.theme-dark :deep(.message.user .bubble),
.theme-dark :deep(.tab.active) {
  color: #fff !important;
}

.theme-dark :deep(.link),
.theme-dark :deep(.sidebar-stats),
.theme-dark :deep(.tree-label),
.theme-dark :deep(.subtitle),
.theme-dark :deep(.kb-info small),
.theme-dark :deep(.sidebar-note),
.theme-dark :deep(.section-kicker),
.theme-dark :deep(.api-key),
.theme-dark :deep(.field > span),
.theme-dark :deep(.panel-heading p),
.theme-dark :deep(.runtime-option small),
.theme-dark :deep(.api-field span),
.theme-dark :deep(.file-time),
.theme-dark :deep(.history-mode),
.theme-dark :deep(.kb-info small),
.theme-dark :deep(.kb-current p),
.theme-dark :deep(.history-summary small),
.theme-dark :deep(.history-item small) {
  color: #a1a1aa !important;
}

.theme-dark :deep(.runtime-option span),
.theme-dark :deep(.kb-current strong),
.theme-dark :deep(.kb-info strong),
.theme-dark :deep(.history-item p),
.theme-dark :deep(.summary-toggle),
.theme-dark :deep(.history-item),
.theme-dark :deep(.detail-row),
.theme-dark :deep(.preview-panel),
.theme-dark :deep(.json-panel) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.preview-frame-wrap),
.theme-dark :deep(.preview-document),
.theme-dark :deep(.preview-text) {
  border-color: #2a2a2a !important;
  background: #111111 !important;
  color: #f4f4f5 !important;
}

.theme-dark :deep(.preview-frame-wrap) {
  border-color: transparent !important;
  background: transparent !important;
}

.theme-dark :deep(.preview-frame) {
  border-color: transparent !important;
  background: #181818 !important;
}

.theme-dark :deep(.preview-mode-toggle) {
  border-color: #2a2a2a !important;
  background: rgba(24, 24, 24, 0.88) !important;
}

.theme-dark :deep(.preview-mode-toggle button) {
  color: #a1a1aa !important;
}

.theme-dark :deep(.preview-mode-toggle button.active) {
  background: #16a34a !important;
  color: #fff !important;
}

.theme-dark :deep(.markdown-body h1),
.theme-dark :deep(.markdown-body h2),
.theme-dark :deep(.markdown-body h3),
.theme-dark :deep(.markdown-body h4) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.markdown-body blockquote),
.theme-dark :deep(.markdown-body pre),
.theme-dark :deep(.markdown-body :not(pre) > code) {
  border-color: #2a2a2a !important;
  background: #181818 !important;
}

.theme-dark :deep(.markdown-body th),
.theme-dark :deep(.markdown-body td) {
  border-color: #2a2a2a !important;
}

.theme-dark :deep(.markdown-body .katex) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.json-raw) {
  color: #f4f4f5 !important;
}

.theme-dark :deep(.json-token.key) {
  color: #8de8ad !important;
}

.theme-dark :deep(.json-token.string) {
  color: #86efac !important;
}

.theme-dark :deep(.json-token.number) {
  color: #93c5fd !important;
}

.theme-dark :deep(.json-token.boolean) {
  color: #c4b5fd !important;
}

.theme-dark :deep(.json-token.null),
.theme-dark :deep(.json-token.punctuation) {
  color: #a1a1aa !important;
}

.theme-dark :deep(.json-fold) {
  border-color: rgba(141, 232, 173, 0.26) !important;
  background: rgba(22, 163, 74, 0.14) !important;
  color: #8de8ad !important;
}

.theme-dark :deep(.json-fold:hover) {
  background: rgba(22, 163, 74, 0.2) !important;
}
</style>
