<script setup lang="ts">
import { ref } from 'vue'
import { Clapperboard, X } from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import ChatSidebar from '../chat/ChatSidebar.vue'
import ChatMessages from '../chat/ChatMessages.vue'
import ChatInput from '../chat/ChatInput.vue'
import ChatEmptyState from '../chat/ChatEmptyState.vue'
import ChatReplayModal from '../chat/ChatReplayModal.vue'

const chat = useChatStore()
const tree = useTreeStore()
const ui = useUiStore()
const isReplayOpen = ref(false)
</script>

<template>
  <div class="chat-screen" :class="{ typing: ui.isChatKnowledgeDocked }">
    <ChatSidebar :docked="ui.isChatKnowledgeDocked" @expand="ui.setChatKnowledgeDocked(false)" />
    <div class="chat-main">
      <button
        v-if="chat.messages.length > 0"
        class="replay-trigger"
        type="button"
        aria-label="打开对话回放"
        @click="isReplayOpen = true"
      >
        <Clapperboard :size="14" :stroke-width="2.2" aria-hidden="true" />
        Replay
      </button>
      <ChatEmptyState v-if="chat.messages.length === 0" />
      <ChatMessages v-else />
      <div class="scroll-hint" v-if="!ui.isUniverseMode && !ui.isUniverseHintDismissed && tree.flatNodes.length > 0">
        <span class="hint-text">按 ↓ 查看知识图谱</span>
        <button class="hint-close" type="button" aria-label="关闭宇宙提示" @click="ui.dismissUniverseHint()">
          <X :size="12" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </div>
      <ChatInput @active-change="ui.setChatKnowledgeDocked($event)" />
    </div>
    <ChatReplayModal :open="isReplayOpen" @close="isReplayOpen = false" />
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.chat-screen {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  background: $color-surface-bg;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  margin: $space-screen $space-screen $space-screen calc(#{$sidebar-width} + #{$space-screen * 2});
  border-radius: $radius-panel;
  background: transparent;
  overflow: hidden;
  transition: margin 560ms cubic-bezier(0.22, 1, 0.36, 1);
}

.replay-trigger {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba($color-border, 0.82);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: $color-text-light;
  cursor: pointer;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  box-shadow: $shadow-control;
  backdrop-filter: blur(10px);
  transition: background $transition-fast, color $transition-fast, transform $transition-fast;

  &:hover {
    background: rgba($color-primary, 0.1);
    color: $color-primary;
    transform: translateY(-1px);
  }
}

.typing {
  .chat-main {
    margin-left: $space-screen;
  }

  :deep(.chat-input-area) {
    padding-left: 32px;
  }
}

.scroll-hint {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 6px 14px;
  background: $color-accent;
  border: 1px solid rgba($color-primary, 0.18);
  border-radius: 999px;
  color: $color-primary;
  font-size: $font-size-sm;
  animation: hintBounce 2s ease-in-out infinite;
}

.hint-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: -6px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.62;
  transition: background $transition-fast, opacity $transition-fast;

  &:hover {
    background: rgba($color-primary, 0.1);
    opacity: 1;
  }
}

@keyframes hintBounce {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

</style>
