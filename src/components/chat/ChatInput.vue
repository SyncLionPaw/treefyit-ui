<script setup lang="ts">
import { ref } from 'vue'
import { SendHorizontal } from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'

const chat = useChatStore()
const tree = useTreeStore()
const ui = useUiStore()
const input = ref('')
const emit = defineEmits<{
  activeChange: [active: boolean]
}>()

function syncActive(focused: boolean) {
  emit('activeChange', focused || input.value.trim().length > 0)
}

function handleInput() {
  if (input.value.trim().length > 0) {
    syncActive(true)
  }
}

function send() {
  const text = input.value.trim()
  if (!text) return
  chat.sendMessage(text)
  input.value = ''
  syncActive(true)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

</script>

<template>
  <div class="chat-input-area">
    <div class="input-row" :class="{ docked: ui.isChatKnowledgeDocked }">
      <button
        v-if="ui.isChatKnowledgeDocked"
        class="kb-dock-dot"
        type="button"
        :title="tree.activeKnowledgeBase?.name || '展开知识库'"
        aria-label="展开知识库选择"
        @mousedown.prevent
        @click="ui.setChatKnowledgeDocked(false)"
      ></button>
      <input
        v-model="input"
        type="text"
        class="input"
        placeholder="输入消息，按 Enter 发送"
        @focus="syncActive(true)"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <button class="send-btn" :disabled="!input.trim()" aria-label="发送消息" @click="send">
        <SendHorizontal :size="17" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.chat-input-area {
  display: flex;
  justify-content: center;
  padding: 10px 32px 22px;
  transition: padding 560ms cubic-bezier(0.22, 1, 0.36, 1);
}

.input-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(920px, 100%);
  height: 48px;
  padding: 8px 10px 8px 16px;
  border: 1px solid rgba($color-primary, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 34px rgba(18, 51, 32, 0.08);
  backdrop-filter: blur(14px);
  transition: border-color $transition-fast, background $transition-fast, box-shadow $transition-fast;

  &:focus-within {
    border-color: rgba($color-primary, 0.32);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 16px 38px rgba(18, 51, 32, 0.11);
  }
}

.input-row.docked {
  padding-left: 10px;
}

.kb-dock-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba($color-primary, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: $color-primary;
  cursor: pointer;
  flex: 0 0 30px;
  transition: background $transition-fast, transform $transition-fast, border-color $transition-fast;

  &::before,
  &::after {
    position: absolute;
    border-radius: 50%;
    content: '';
  }

  &::before {
    inset: 7px;
    border: 1px solid rgba($color-primary, 0.28);
    background: rgba($color-primary, 0.05);
  }

  &::after {
    top: 50%;
    left: 50%;
    width: 7px;
    height: 7px;
    background: $color-primary;
    transform: translate(-50%, -50%);
  }

  &:hover {
    border-color: rgba($color-primary, 0.36);
    background: rgba($color-primary, 0.08);
    transform: scale(1.04);
  }
}

.input {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 30px;
  border: none;
  border-radius: 999px;
  outline: none;
  font-size: $font-size-md;
  color: $color-text;
  background: transparent;
  font-family: inherit;
  padding: 0;
  box-shadow: none;
  transition: color $transition-fast;

  &:focus {
    box-shadow: none;
    background: transparent;
  }

  &::placeholder { color: $color-text-light; }
}

.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: $color-primary;
  color: #fff;
  box-shadow: $shadow-control;
  cursor: pointer;
  flex-shrink: 0;
  transition: background $transition-fast, border-color $transition-fast, opacity $transition-fast, transform $transition-fast;

  &:hover:not(:disabled) {
    background: $color-secondary;
    transform: translateY(-1px);
  }

  &:disabled {
    background: rgba($color-text-light, 0.12);
    color: $color-text-light;
    cursor: default;
    opacity: 0.7;
  }
}
</style>
