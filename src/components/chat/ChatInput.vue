<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SendHorizontal, X } from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import {
  getInitialMentionActiveIndex,
  getNextMentionActiveIndex,
  normalizeMentionActiveIndex,
} from './mentionNavigation'

const chat = useChatStore()
const tree = useTreeStore()
const ui = useUiStore()
const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const mentionQuery = ref('')
const mentionStart = ref<number | null>(null)
const showMentionMenu = ref(false)
const mentionActiveIndex = ref(-1)
const emit = defineEmits<{
  activeChange: [active: boolean]
}>()

const mentionOptions = computed(() => {
  const query = mentionQuery.value.trim().toLowerCase()
  const options = tree.knowledgeBases
    .filter(kb => !query || kb.name.toLowerCase().includes(query))
    .map(kb => ({
      id: kb.id,
      label: kb.name,
      description: `${kb.nodeCount} nodes`,
    }))

  return [
    {
      id: '',
      label: '直接对话',
      description: '不附带知识库上下文',
    },
    ...options,
  ]
})

function syncActive(focused: boolean) {
  emit('activeChange', focused || input.value.trim().length > 0)
}

function handleInput() {
  updateMentionState()
  if (input.value.trim().length > 0) {
    syncActive(true)
  }
}

function resetMentionState() {
  mentionQuery.value = ''
  mentionStart.value = null
  showMentionMenu.value = false
  mentionActiveIndex.value = -1
}

function updateMentionState() {
  const element = inputEl.value
  const caret = element?.selectionStart ?? input.value.length
  const prefix = input.value.slice(0, caret)
  const match = prefix.match(/(?:^|\s)@([^\s@]*)$/)
  if (!match || match.index === undefined) {
    resetMentionState()
    return
  }

  const wasVisible = showMentionMenu.value
  mentionQuery.value = match[1] || ''
  mentionStart.value = match.index + match[0].lastIndexOf('@')
  showMentionMenu.value = true
  mentionActiveIndex.value = wasVisible
    ? normalizeMentionActiveIndex(mentionActiveIndex.value, mentionOptions.value.length)
    : getInitialMentionActiveIndex(mentionOptions.value.length)
}

function applyKnowledgeBase(id: string | null) {
  chat.selectKnowledgeBase(id)
}

function clearKnowledgeBase() {
  chat.clearKnowledgeBase()
}

function applyMentionSelection(id: string) {
  applyKnowledgeBase(id || null)
  const start = mentionStart.value
  if (start === null) {
    resetMentionState()
    return
  }
  const element = inputEl.value
  const caret = element?.selectionStart ?? input.value.length
  input.value = `${input.value.slice(0, start)}${input.value.slice(caret).replace(/^\s*/, '')}`.trimStart()
  resetMentionState()
  syncActive(Boolean(input.value.trim()))
  requestAnimationFrame(() => {
    inputEl.value?.focus()
  })
}

function send() {
  const text = input.value.trim()
  if (!text) return
  chat.sendMessage(text)
  input.value = ''
  resetMentionState()
  syncActive(true)
}

function moveMentionSelection(direction: 'next' | 'previous') {
  mentionActiveIndex.value = getNextMentionActiveIndex(
    mentionActiveIndex.value,
    mentionOptions.value.length,
    direction,
  )
}

function handleKeydown(e: KeyboardEvent) {
  if (showMentionMenu.value && e.key === 'ArrowDown') {
    e.preventDefault()
    moveMentionSelection('next')
    return
  }
  if (showMentionMenu.value && e.key === 'ArrowUp') {
    e.preventDefault()
    moveMentionSelection('previous')
    return
  }
  if (showMentionMenu.value && e.key === 'Escape') {
    e.preventDefault()
    resetMentionState()
    return
  }
  if (showMentionMenu.value && e.key === 'Enter' && !e.shiftKey) {
    const activeOption = mentionOptions.value[mentionActiveIndex.value]
    if (activeOption) {
      e.preventDefault()
      applyMentionSelection(activeOption.id)
      return
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

watch(mentionOptions, options => {
  mentionActiveIndex.value = normalizeMentionActiveIndex(
    mentionActiveIndex.value,
    showMentionMenu.value ? options.length : 0,
  )
})

</script>

<template>
  <div class="chat-input-area">
    <div class="input-row" :class="{ docked: ui.isChatKnowledgeDocked }">
      <button
        v-if="ui.isChatKnowledgeDocked"
        class="kb-dock-dot"
        type="button"
        :title="chat.selectedKnowledgeBase?.name || '展开知识库'"
        aria-label="展开知识库选择"
        @mousedown.prevent
        @click="ui.setChatKnowledgeDocked(false)"
      ></button>
      <button
        v-if="chat.selectedKnowledgeBase"
        type="button"
        class="context-chip"
        :title="chat.selectedKnowledgeBase.description"
        @click="clearKnowledgeBase"
      >
        <span>@{{ chat.selectedKnowledgeBase.name }}</span>
        <X :size="12" :stroke-width="2.2" aria-hidden="true" />
      </button>
      <input
        ref="inputEl"
        v-model="input"
        type="text"
        class="input"
        placeholder="输入消息，按 Enter 发送；输入 @ 选择知识库"
        @focus="syncActive(true)"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <button class="send-btn" :disabled="!input.trim()" aria-label="发送消息" @click="send">
        <SendHorizontal :size="17" :stroke-width="2" aria-hidden="true" />
      </button>
      <div v-if="showMentionMenu" class="mention-menu">
        <button
          v-for="(option, index) in mentionOptions"
          :key="option.id || 'no-kb'"
          type="button"
          class="mention-item"
          :class="{ active: mentionActiveIndex === index }"
          :aria-selected="mentionActiveIndex === index"
          @mousedown.prevent
          @mouseenter="mentionActiveIndex = index"
          @click="applyMentionSelection(option.id)"
        >
          <strong>@{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </button>
      </div>
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
  position: relative;
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

.context-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba($color-primary, 0.18);
  border-radius: 999px;
  background: rgba($color-primary, 0.06);
  color: $color-primary;
  cursor: pointer;
  flex-shrink: 0;
  transition: background $transition-fast, border-color $transition-fast, transform $transition-fast;

  &:hover {
    background: rgba($color-primary, 0.1);
    border-color: rgba($color-primary, 0.26);
    transform: translateY(-1px);
  }
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

.mention-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 10px);
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgba($color-border, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 40px rgba(18, 51, 32, 0.12);
  backdrop-filter: blur(18px);
}

.mention-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: $color-text;
  cursor: pointer;
  text-align: left;
  transition: background $transition-fast, border-color $transition-fast;

  strong {
    min-width: 0;
    font-size: $font-size-sm;
  }

  small {
    color: $color-text-light;
    white-space: nowrap;
  }

  &:hover {
    background: rgba($color-primary, 0.06);
    border-color: rgba($color-primary, 0.14);
  }

  &.active {
    background: rgba($color-primary, 0.09);
    border-color: rgba($color-primary, 0.22);
    box-shadow: inset 0 0 0 1px rgba($color-primary, 0.08);
  }
}
</style>
