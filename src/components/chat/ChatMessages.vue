<script setup lang="ts">
import { useChatStore } from '../../stores/chatStore'
import { computed, nextTick, ref, watch } from 'vue'
import { Brain, Paperclip, Search } from 'lucide-vue-next'
import { renderMarkdown } from '../../utils/markdown'

const chat = useChatStore()
const messagesEl = ref<HTMLElement | null>(null)
const thinkingOpen = ref<Record<string, boolean>>({})

const scrollSignature = computed(() => chat.messages.map(message => {
  const parts = message.parts?.map(part => (
    part.type === 'text' || part.type === 'reasoning'
      ? part.content
      : `${part.toolEvent.status}:${part.toolEvent.arguments || ''}:${part.toolEvent.result || ''}`
  )).join('|') || message.content
  return `${message.id}:${message.role}:${parts}:${message.sourceRef || ''}`
}).join('||'))

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    requestAnimationFrame(() => {
      if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    })
  }
}

watch(scrollSignature, () => {
  void scrollToBottom()
}, { flush: 'post' })

function formatToolArguments(args?: string) {
  if (!args) return ''
  return args.length > 140 ? `${args.slice(0, 140)}...` : args
}

function compactThinkingText(text: string, maxLength = 72) {
  const compacted = text.replace(/\s+/g, ' ').trim()
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}...` : compacted
}

function isThinkingExpanded(messageId: string, partId: string, isStreaming?: boolean) {
  if (isStreaming) return true
  return thinkingOpen.value[`${messageId}:${partId}`] ?? false
}

function updateThinkingExpanded(messageId: string, partId: string, event: Event) {
  const element = event.currentTarget as HTMLDetailsElement | null
  if (!element) return
  thinkingOpen.value[`${messageId}:${partId}`] = element.open
}

function shouldRenderMarkdown(isStreaming?: boolean) {
  return !isStreaming
}
</script>

<template>
  <div class="chat-messages" ref="messagesEl">
    <div
      v-for="msg in chat.messages"
      :key="msg.id"
      class="message"
      :class="msg.role"
    >
      <div v-if="msg.parts?.length" class="message-flow">
        <template
          v-for="part in msg.parts"
          :key="part.id"
        >
          <details
            v-if="part.type === 'reasoning' && part.content.trim()"
            class="thinking-block"
            :open="isThinkingExpanded(msg.id, part.id, msg.isStreaming)"
            @toggle="updateThinkingExpanded(msg.id, part.id, $event)"
          >
            <summary class="thinking-summary" aria-label="展开思考内容">
              <span class="thinking-label" aria-hidden="true">
                <Brain :size="13" :stroke-width="2.1" />
              </span>
              <span class="thinking-preview">{{ compactThinkingText(part.content) }}</span>
            </summary>
            <div class="thinking-body">
              <div
                v-if="shouldRenderMarkdown(msg.isStreaming)"
                class="thinking-content markdown-content"
                v-html="renderMarkdown(part.content)"
              ></div>
              <pre v-else class="thinking-content streaming-text">{{ part.content }}</pre>
            </div>
          </details>
          <div v-else-if="part.type === 'text' && part.content.trim()" class="bubble">
            <div
              v-if="shouldRenderMarkdown(msg.isStreaming)"
              class="content markdown-content"
              v-html="renderMarkdown(part.content)"
            ></div>
            <pre v-else class="content streaming-text">{{ part.content }}</pre>
          </div>
          <details
            v-else-if="part.type === 'tool'"
            class="tool-events"
            aria-label="Agent tool calls"
          >
            <summary
              class="tool-event"
              :class="part.toolEvent.status"
            >
              <div class="tool-body">
                <div class="tool-title">
                  <Search :size="13" :stroke-width="2.1" aria-hidden="true" />
                  <code>{{ part.toolEvent.name }}</code>
                </div>
              </div>
            </summary>
            <div class="tool-details">
              <div v-if="part.toolEvent.arguments" class="tool-detail">
                参数: {{ formatToolArguments(part.toolEvent.arguments) }}
              </div>
              <div v-if="part.toolEvent.result" class="tool-detail">
                结果: {{ part.toolEvent.result }}
              </div>
              <div v-if="!part.toolEvent.arguments && !part.toolEvent.result" class="tool-detail muted">
                暂无更多工具详情。
              </div>
            </div>
          </details>
        </template>
        <div v-if="msg.sourceRef" class="source-ref flow-source">
          <Paperclip :size="12" :stroke-width="2" aria-hidden="true" />
          {{ msg.sourceRef }}
        </div>
      </div>
      <div v-else class="bubble">
        <div
          v-if="shouldRenderMarkdown(msg.isStreaming)"
          class="content markdown-content"
          v-html="renderMarkdown(msg.content)"
        ></div>
        <pre v-else class="content streaming-text">{{ msg.content }}</pre>
        <div v-if="msg.sourceRef" class="source-ref">
          <Paperclip :size="12" :stroke-width="2" aria-hidden="true" />
          {{ msg.sourceRef }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 26px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.message {
  display: flex;
  width: fit-content;
  max-width: 100%;
  animation: fadeIn 300ms ease;

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;
    max-width: min(72%, 760px);

    .bubble {
      background: $color-primary;
      color: #fff;
      border: 1px solid $color-primary;
      box-shadow: 0 14px 30px rgba($color-primary, 0.16);
    }
  }

  &.ai {
    align-self: flex-start;
    width: min(84%, 980px);

    .bubble {
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.92);
      box-shadow: 0 14px 34px rgba(18, 51, 32, 0.08);
      backdrop-filter: blur(12px);
    }
  }

  &.system {
    align-self: center;
    width: min(82%, 720px);

    .bubble {
      border: 1px solid rgba($color-warning, 0.22);
      background: rgba($color-warning, 0.08);
      color: $color-text-light;
      box-shadow: none;
    }
  }
}

.message-flow {
  display: grid;
  gap: 8px;
  width: 100%;

  .bubble,
  .thinking-block,
  .tool-events {
    width: 100%;
    box-sizing: border-box;
  }
}

.thinking-block {
  display: block;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: $radius-panel;
  background: rgba(15, 23, 42, 0.04);
  color: $color-text-light;
}

.thinking-block[open] {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  column-gap: 8px;
  align-items: start;
}

.thinking-summary {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 18px;
  cursor: pointer;
  line-height: 1;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
}

.thinking-block[open] .thinking-summary {
  grid-template-columns: 16px;
}

.thinking-body {
  margin-top: 6px;
  padding-left: 24px;
}

.thinking-block[open] .thinking-body {
  margin-top: 0;
  padding-left: 0;
}

.thinking-block:not([open]) .thinking-body {
  display: none;
}

.thinking-block[open] .thinking-preview {
  display: none;
}

.thinking-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 18px;
  line-height: 0;
  font-size: $font-size-xs;
  color: rgba(15, 23, 42, 0.52);

  :deep(svg) {
    display: block;
    flex: 0 0 auto;
  }
}

.thinking-preview {
  min-width: 0;
  overflow: hidden;
  color: rgba(15, 23, 42, 0.72);
  font-size: $font-size-sm;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.thinking-content {
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;

  :deep(p) { margin: 0; }
  :deep(p + p) { margin-top: 8px; }
  :deep(.md-image) {
    display: block;
    max-width: min(100%, 680px);
    max-height: 360px;
    width: auto;
    height: auto;
    margin: 8px 0 0;
    border-radius: $radius-control;
    object-fit: contain;
  }
}

.streaming-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.bubble {
  padding: 11px 15px;
  border-radius: $radius-panel;
  font-size: $font-size-md;
  font-weight: $font-weight-regular;
  line-height: $line-height-relaxed;
}

.content {
  :deep(p) { margin: 0; }
  :deep(p + p),
  :deep(.md-table-wrap + p),
  :deep(p + .md-table-wrap),
  :deep(pre + p),
  :deep(p + pre) { margin-top: 8px; }
  :deep(strong) { font-weight: $font-weight-semibold; }
  :deep(code) {
    background: rgba(0,0,0,0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: $font-size-base;
    .user & { background: rgba(255,255,255,0.2); }
  }
  :deep(pre) {
    margin: 8px 0 0;
    padding: 9px 10px;
    overflow-x: auto;
    border-radius: $radius-control;
    background: rgba(0,0,0,0.06);
  }
  :deep(pre code) {
    padding: 0;
    background: transparent;
  }
  :deep(.md-image) {
    display: block;
    max-width: min(100%, 720px);
    max-height: 420px;
    width: auto;
    height: auto;
    margin: 8px 0 0;
    border-radius: $radius-control;
    object-fit: contain;
  }
  :deep(ul),
  :deep(ol) {
    margin: 0;
    padding-left: 18px;
  }
  :deep(li + li) {
    margin-top: 3px;
  }
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5) {
    margin: 10px 0 6px;
    border: 0;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    line-height: $line-height-tight;
  }
  :deep(p + h2),
  :deep(p + h3),
  :deep(p + h4) {
    margin-top: 10px;
  }
  :deep(.md-table-wrap) {
    max-width: 100%;
    margin-top: 8px;
    overflow-x: auto;
  }
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: $radius-control;
    font-size: $font-size-sm;
  }
  :deep(th),
  :deep(td) {
    padding: 6px 8px;
    border: 1px solid rgba(0,0,0,0.08);
    text-align: left;
    vertical-align: top;
  }
  :deep(th) {
    background: rgba(0,0,0,0.04);
    font-weight: $font-weight-semibold;
  }
}

.source-ref {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: $font-size-xs;
  opacity: 0.7;
  padding-top: 6px;
  border-top: 1px solid rgba(0,0,0,0.06);
}

.tool-events {
  display: block;
  margin: 0;
}

.tool-event {
  display: block;
  padding: 6px 10px;
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: $radius-control;
  background: rgba($color-primary, 0.06);
  color: $color-text;
  cursor: pointer;
  box-shadow: $shadow-control;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }
}

.tool-event.running {
  border-color: rgba($color-info, 0.22);
  background: rgba($color-info, 0.06);
}

.tool-event.error {
  border-color: rgba($color-error, 0.24);
  background: rgba($color-error, 0.07);
}

.tool-body {
  min-width: 0;
}

.tool-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  color: $color-text;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  line-height: $line-height-base;

  code {
    padding: 1px 5px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.06);
    color: $color-text-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
  }
}

.tool-detail {
  color: $color-text-light;
  font-size: $font-size-xs;
  line-height: $line-height-base;
  overflow-wrap: anywhere;
}

.tool-details {
  display: grid;
  gap: 5px;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid rgba($color-border, 0.8);
  border-radius: $radius-control;
  background: rgba(255, 255, 255, 0.5);
}

.tool-detail.muted {
  opacity: 0.72;
}

.flow-source {
  width: fit-content;
  max-width: 100%;
  margin-top: 0;
  margin-left: 2px;
  padding: 4px 8px;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 999px;
  background: rgba(255,255,255,0.58);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 960px) {
  .message {
    &.user {
      max-width: min(78%, 760px);
    }

    &.ai {
      width: min(90%, 980px);
    }

    &.system {
      width: min(90%, 720px);
    }
  }
}

@media (max-width: 640px) {
  .chat-messages {
    padding: 20px 16px;
  }

  .message {
    &.user {
      max-width: min(88%, 760px);
    }

    &.ai,
    &.system {
      width: 100%;
    }
  }
}
</style>
