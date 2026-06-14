<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUp } from 'lucide-vue-next'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'

const tree = useTreeStore()
const ui = useUiStore()

const statusText = computed(() => {
  const selected = tree.selectedNodeId ? tree.getNodeById(tree.selectedNodeId) : null
  if (selected) {
    return `已选中 ${selected.title} · ${selected.source} · ${selected.tokenCount} tokens`
  }
  return `${tree.totalNodes} 节点 · ${tree.totalTokens.toLocaleString()} tokens · ${tree.sources.length} 文档`
})
</script>

<template>
  <footer class="universe-status">
    <div class="status-left">
      <span class="pulse"></span>
      <span>{{ statusText }}</span>
    </div>
    <div class="status-right">
      <span>拖拽平移</span>
      <span>滚轮缩放</span>
      <span>↑ / Esc 返回</span>
      <span>Hover 详情</span>
      <button class="label-toggle" type="button" @click="ui.toggleUniverseLabels">
        <span :class="{ active: ui.isUniverseLabelsVisible }"><span></span></span>
        Labels
      </button>
      <button class="surface-action" type="button" aria-label="返回表层工作区" title="返回表层工作区" @click="ui.exitUniverse">
        <ArrowUp :size="13" :stroke-width="2.2" aria-hidden="true" />
      </button>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.universe-status {
  position: absolute;
  left: 50%;
  bottom: 18px;
  z-index: $z-node-popup;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(920px, calc(100vw - 48px));
  gap: 18px;
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(10, 10, 15, 0.7);
  color: rgba(255, 255, 255, 0.72);
  font-size: $font-size-sm;
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.status-left {
  overflow: hidden;

  span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $color-accent;
  box-shadow: 0 0 12px $color-accent;
  flex-shrink: 0;
  animation: statusPulse 1.8s ease-in-out infinite;
}

.status-right {
  flex-shrink: 0;

  span {
    color: rgba(255, 255, 255, 0.42);
  }

  button {
    padding: 5px 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    font-size: $font-size-sm;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }
  }
}

.label-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  > span {
    position: relative;
    width: 25px;
    height: 14px;
    border-radius: 99px;
    background: $color-accent;
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
      background: rgba(255, 255, 255, 0.18);

      span {
        right: auto;
        left: 2px;
      }
    }
  }
}

.surface-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0 !important;
}

@keyframes statusPulse {
  0%, 100% { opacity: 0.45; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}

@media (max-width: $bp-tablet) {
  .universe-status {
    align-items: flex-start;
    flex-direction: column;
    border-radius: 18px;
  }

  .status-right {
    flex-wrap: wrap;
  }
}
</style>
