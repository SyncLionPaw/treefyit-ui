<script setup lang="ts">
import { computed } from 'vue'
import { Copy, FileText, MessageCircle } from 'lucide-vue-next'
import type { FlatNode } from '../../types'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import { universeNodeColor } from '../../utils/colorPalette'

const props = defineProps<{
  node?: FlatNode
}>()

const chat = useChatStore()
const tree = useTreeStore()
const ui = useUiStore()
const popupColor = computed(() => props.node ? universeNodeColor(props.node) : '#16A34A')

async function copyPath() {
  if (!props.node) return
  try {
    await navigator.clipboard.writeText(props.node.path)
  } catch {
    const input = document.createElement('textarea')
    input.value = props.node.path
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
}

function jumpToChat() {
  if (!props.node) return
  tree.selectNode(props.node.id)
  chat.sendMessage(`讲讲 ${props.node.title}`)
  ui.setScreen('chat')
  ui.exitUniverse()
}
</script>

<template>
  <div v-if="node" class="node-popup" :style="{ '--node-color': popupColor }">
    <div class="popup-kicker">当前节点</div>
    <div class="popup-title">
      <FileText :size="16" :stroke-width="2" aria-hidden="true" />
      {{ node.title }}
    </div>
    <div class="popup-meta">
      来源: {{ node.source }} · Path {{ node.path }} · Token: {{ node.tokenCount }}
    </div>
    <p class="popup-summary">
      {{ node.summary || node.text || '该节点暂无摘要，完整版会展示解析后的内容片段。' }}
    </p>
    <div class="popup-actions">
      <button @click="copyPath">
        <Copy :size="13" :stroke-width="2" aria-hidden="true" />
        复制路径
      </button>
      <button @click="jumpToChat">
        <MessageCircle :size="13" :stroke-width="2" aria-hidden="true" />
        跳转 Chat
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.node-popup {
  position: absolute;
  right: 28px;
  top: 28px;
  z-index: $z-node-popup;
  width: min(360px, calc(100vw - 56px));
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: 3px solid var(--node-color);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.04)),
    rgba(10, 10, 15, 0.84);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), 0 0 32px rgba(255, 255, 255, 0.04);
  color: #fff;
  backdrop-filter: blur(18px);
  animation: popupIn 180ms ease-out;
}

.popup-kicker {
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.46);
  font-size: $font-size-xs;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.popup-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #fff;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  line-height: $line-height-tight;
}

.popup-meta {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.56);
  font-size: $font-size-sm;
  line-height: $line-height-base;
}

.popup-summary {
  display: -webkit-box;
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.78);
  font-size: $font-size-base;
  line-height: $line-height-relaxed;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.popup-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;

  button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: $radius-control;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.88);
    font-size: $font-size-sm;
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;

    &:hover {
      border-color: var(--node-color);
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }
  }
}

@keyframes popupIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
