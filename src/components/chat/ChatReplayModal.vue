<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleX, LoaderCircle, Pause, Play, Search, X } from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'
import { useUiStore } from '../../stores/uiStore'
import type { ChatMessage, ChatMessagePart, ChatToolEvent } from '../../types'
import { renderMarkdown } from '../../utils/markdown'
import ChatReplayBuildGraph from './ChatReplayBuildGraph.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type ReplayStep =
  | { id: string; type: 'message'; role: ChatMessage['role']; content: string; sourceRef?: string }
  | { id: string; type: 'tool'; role: 'ai'; toolEvent: ChatToolEvent; nodeId?: string }

const chat = useChatStore()
const tree = useTreeStore()
const ui = useUiStore()
const activeIndex = ref(0)
const isPlaying = ref(false)
const replayChatEl = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function stopPlayback() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  isPlaying.value = false
}

function compactText(text: string, length = 120) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > length ? `${normalized.slice(0, length)}...` : normalized
}

function safeParseJson(text?: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings)
  }
  return []
}

function findNodeForTool(event: ChatToolEvent) {
  const nodes = tree.buildFlatNodes
  if (!nodes.length) return undefined

  const parsedArgs = safeParseJson(event.arguments)
  const argCandidates = [
    ...collectStrings(parsedArgs),
    event.arguments || '',
  ].map(item => item.trim()).filter(Boolean)

  for (const candidate of argCandidates) {
    const exact = nodes.find(node => (
      node.id === candidate ||
      node.path === candidate ||
      node.title === candidate
    ))
    if (exact) return exact.id
  }

  const resultPaths = Array.from((event.result || '').matchAll(/(?:path=|children of\s+|\[)(\d+(?:\.\d+)*)/gi))
    .map(match => match[1])
  for (const path of resultPaths) {
    const exact = nodes.find(node => node.id === path || node.path === path)
    if (exact) return exact.id
  }

  const haystack = argCandidates.join(' ').toLowerCase()
  const byPath = [...nodes]
    .sort((a, b) => b.path.length - a.path.length)
    .find(node => haystack.includes(node.path.toLowerCase()))
  if (byPath) return byPath.id

  return nodes.find(node => haystack.includes(node.title.toLowerCase()))?.id
}

function stepFromPart(message: ChatMessage, part: ChatMessagePart, index: number): ReplayStep | null {
  if (part.type === 'text') {
    if (!part.content.trim()) return null
    return {
      id: `${message.id}-${part.id}-${index}`,
      type: 'message',
      role: message.role,
      content: part.content,
      sourceRef: message.sourceRef,
    }
  }

  return {
    id: `${message.id}-${part.id}-${index}`,
    type: 'tool',
    role: 'ai',
    toolEvent: part.toolEvent,
    nodeId: findNodeForTool(part.toolEvent),
  }
}

const steps = computed<ReplayStep[]>(() => chat.messages.flatMap(message => {
  if (message.parts?.length) {
    return message.parts
      .map((part, index) => stepFromPart(message, part, index))
      .filter((step): step is ReplayStep => Boolean(step))
  }

  if (!message.content.trim()) return []
  return [{
    id: message.id,
    type: 'message',
    role: message.role,
    content: message.content,
    sourceRef: message.sourceRef,
  }]
}))

const visibleSteps = computed(() => steps.value.slice(0, activeIndex.value + 1))
const activeNodeId = computed(() => {
  let nodeId: string | undefined
  for (const step of visibleSteps.value) {
    if (step.type === 'tool' && step.nodeId) nodeId = step.nodeId
  }
  return nodeId
})

const activePathIds = computed(() => {
  const ids = new Set<string>()
  let currentId = activeNodeId.value

  while (currentId) {
    ids.add(currentId)
    const current = tree.buildFlatNodes.find(node => node.id === currentId)
    currentId = current?.parentId || ''
  }

  return ids
})

const replayTrees = computed(() => tree.buildTrees)

const progress = computed(() => {
  if (!steps.value.length) return 0
  return ((activeIndex.value + 1) / steps.value.length) * 100
})

function close() {
  stopPlayback()
  emit('close')
}

function goPrev() {
  activeIndex.value = Math.max(0, activeIndex.value - 1)
}

function goNext() {
  activeIndex.value = Math.min(Math.max(steps.value.length - 1, 0), activeIndex.value + 1)
}

async function scrollActiveStepIntoView() {
  await nextTick()
  const container = replayChatEl.value
  const activeStepEl = container?.querySelector<HTMLElement>('.replay-step.active')
  activeStepEl?.scrollIntoView({ block: 'end', behavior: 'smooth' })
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback()
    return
  }

  isPlaying.value = true
  timer = setInterval(() => {
    if (activeIndex.value >= steps.value.length - 1) {
      stopPlayback()
      return
    }
    activeIndex.value += 1
  }, 950)
}

watch(() => props.open, open => {
  if (open) {
    activeIndex.value = 0
  } else {
    stopPlayback()
  }
})

watch(() => steps.value.length, length => {
  activeIndex.value = Math.min(activeIndex.value, Math.max(length - 1, 0))
})

watch(activeIndex, () => {
  void scrollActiveStepIntoView()
})

watch(visibleSteps, () => {
  void scrollActiveStepIntoView()
}, { flush: 'post' })

onBeforeUnmount(stopPlayback)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="replay-backdrop" :class="`theme-${ui.themeMode}`" @click.self="close">
      <section class="replay-modal" role="dialog" aria-modal="true" aria-label="对话回放播放器">
        <button class="replay-close" type="button" aria-label="关闭回放" @click="close">
          <X :size="16" :stroke-width="2.2" aria-hidden="true" />
        </button>

        <div class="replay-progress" aria-hidden="true">
          <span :style="{ width: `${progress}%` }"></span>
        </div>

        <div class="replay-body">
          <div class="replay-chat" ref="replayChatEl">
            <div v-if="!visibleSteps.length" class="replay-empty">暂无可回放的对话。</div>
            <template v-else>
              <div
                v-for="(step, index) in visibleSteps"
                :key="step.id"
                class="replay-step"
                :class="[step.type, step.type === 'message' ? step.role : 'tool', { active: index === activeIndex }]"
              >
                <div v-if="step.type === 'message'" class="replay-bubble">
                  <div v-html="renderMarkdown(step.content)"></div>
                  <small v-if="step.sourceRef">{{ step.sourceRef }}</small>
                </div>
                <details v-else class="tool-events" aria-label="Agent tool calls">
                  <summary class="tool-event" :class="step.toolEvent.status">
                    <div class="tool-icon">
                      <LoaderCircle v-if="step.toolEvent.status === 'running'" class="spin" :size="13" :stroke-width="2.2" aria-hidden="true" />
                      <CheckCircle2 v-else-if="step.toolEvent.status === 'done'" :size="13" :stroke-width="2.2" aria-hidden="true" />
                      <CircleX v-else :size="13" :stroke-width="2.2" aria-hidden="true" />
                    </div>
                    <div class="tool-body">
                      <div class="tool-title">
                        <Search :size="13" :stroke-width="2.1" aria-hidden="true" />
                        <span>
                          {{ step.toolEvent.status === 'running' ? 'Agent 正在使用检索工具' : step.toolEvent.status === 'done' ? '检索工具调用完成' : '检索工具调用失败' }}
                        </span>
                        <code>{{ step.toolEvent.name }}</code>
                      </div>
                    </div>
                  </summary>
                  <div class="tool-details">
                    <div v-if="step.toolEvent.arguments" class="tool-detail">
                      参数: {{ compactText(step.toolEvent.arguments) }}
                    </div>
                    <div v-if="step.toolEvent.result" class="tool-detail">
                      结果: {{ compactText(step.toolEvent.result) }}
                    </div>
                    <div v-if="!step.toolEvent.arguments && !step.toolEvent.result" class="tool-detail muted">
                      暂无更多工具详情。
                    </div>
                  </div>
                </details>
              </div>
            </template>
          </div>

          <aside class="replay-tree">
            <div v-if="replayTrees.length" class="tree-canvas">
              <ChatReplayBuildGraph
                :trees="replayTrees"
                :active-node-id="activeNodeId"
                :active-path-ids="activePathIds"
              />
            </div>
            <div v-else class="tree-empty">
              当前没有可视化知识树；普通聊天会只回放对话气泡。
            </div>
          </aside>
        </div>

        <footer class="replay-controls">
          <button type="button" aria-label="上一帧" @click="goPrev" :disabled="activeIndex === 0">
            <ChevronLeft :size="16" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button class="play-btn" type="button" :aria-label="isPlaying ? '暂停回放' : '播放回放'" @click="togglePlayback" :disabled="!steps.length">
            <Pause v-if="isPlaying" :size="16" :stroke-width="2.2" aria-hidden="true" />
            <Play v-else :size="16" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button type="button" aria-label="下一帧" @click="goNext" :disabled="activeIndex >= steps.length - 1">
            <ChevronRight :size="16" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <span>{{ steps.length ? activeIndex + 1 : 0 }} / {{ steps.length }}</span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.replay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(10, 10, 15, 0.42);
  backdrop-filter: blur(10px);
}

.replay-modal {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: min(1240px, 96vw);
  height: min(820px, 92vh);
  overflow: hidden;
  border: 1px solid rgba($color-border, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 28px 80px rgba(24, 24, 27, 0.22);
}

.replay-close,
.replay-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.06);
  color: $color-text;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }
}

.replay-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  width: 32px;
  height: 32px;
  backdrop-filter: blur(8px);
}

.replay-progress {
  height: 3px;
  background: rgba($color-primary, 0.1);

  span {
    display: block;
    height: 100%;
    background: $color-primary;
    transition: width $transition-normal;
  }
}

.replay-body {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(460px, 1.28fr);
  min-height: 0;
}

.replay-chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding: 18px;
  border-right: 1px solid rgba($color-border, 0.8);
  background: rgba($color-surface-bg, 0.74);
}

.replay-step {
  display: flex;
  max-width: 88%;
  min-width: 0;
  opacity: 0.68;
  transform: scale(0.96);
  transform-origin: left center;
  transition: opacity $transition-fast, transform $transition-fast;

  &.active {
    opacity: 1;
    transform: scale(1);
  }

  &.user {
    align-self: flex-end;
    transform-origin: right center;

    .replay-bubble {
      background: $color-primary;
      color: #fff;
    }
  }

  &.ai {
    align-self: flex-start;
  }

  &.system {
    align-self: center;
  }

  &.tool {
    align-self: flex-start;
    width: 88%;
  }
}

.replay-bubble,
.tool-events {
  width: 100%;
  box-sizing: border-box;
}

.replay-bubble {
  min-width: 0;
  overflow: hidden;
  padding: 8px 10px;
  border: 1px solid rgba($color-border, 0.72);
  border-radius: $radius-panel;
  background: rgba(255, 255, 255, 0.82);
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
  overflow-wrap: anywhere;

  :deep(*) {
    max-width: 100%;
  }

  :deep(p) {
    margin: 0;
  }

  :deep(p + p),
  :deep(p + ul),
  :deep(p + ol),
  :deep(ul + p),
  :deep(ol + p),
  :deep(pre + p),
  :deep(p + pre),
  :deep(blockquote + p),
  :deep(p + blockquote),
  :deep(hr + h2),
  :deep(hr + h3) {
    margin-top: 7px;
  }

  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 8px 0 5px;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    line-height: $line-height-tight;
    overflow-wrap: anywhere;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0;
    padding-left: 16px;
  }

  :deep(li + li) {
    margin-top: 3px;
  }

  :deep(blockquote) {
    margin: 7px 0;
    padding-left: 9px;
    border-left: 2px solid rgba($color-primary, 0.22);
    color: $color-text-light;
  }

  :deep(hr) {
    height: 1px;
    margin: 9px 0;
    border: 0;
    background: rgba($color-border, 0.85);
  }

  :deep(code) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  :deep(pre) {
    max-width: 100%;
    margin: 8px 0 0;
    padding: 8px 9px;
    overflow-x: auto;
    border-radius: $radius-control;
    background: rgba(0, 0, 0, 0.06);
    white-space: pre-wrap;
  }

  :deep(.md-table-wrap) {
    max-width: 100%;
    overflow-x: auto;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }

  :deep(th),
  :deep(td) {
    padding: 3px 4px;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  small {
    display: block;
    margin-top: 5px;
    opacity: 0.62;
  }
}

.tool-events {
  display: block;
  margin: 0;
}

.tool-event {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
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

.tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  color: $color-primary;

  .running & { color: $color-info; }
  .error & { color: $color-error; }
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

.spin {
  animation: spin 900ms linear infinite;
}

.replay-empty,
.tree-empty {
  margin: auto;
  color: $color-text-light;
  font-size: $font-size-sm;
  text-align: center;
}

.replay-tree {
  min-width: 0;
  min-height: 0;
  padding: 18px;
}

.tree-canvas {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.replay-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba($color-border, 0.78);

  button {
    width: 32px;
    height: 32px;
  }

  .play-btn {
    width: 38px;
    height: 38px;
    background: $color-primary;
    color: #fff;
  }

  span {
    margin-left: 4px;
    color: $color-text-light;
    font-size: $font-size-xs;
  }
}

.theme-dark {
  background: rgba(0, 0, 0, 0.62);

  .replay-modal {
    border-color: #2a2a2a;
    background: rgba(18, 18, 18, 0.96);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.46);
  }

  .tool-title,
  .tool-title code {
    color: #f4f4f5;
  }

  .replay-close,
  .replay-controls button {
    background: rgba(255, 255, 255, 0.08);
    color: #f4f4f5;
  }

  .replay-chat {
    border-color: #2a2a2a;
    background: rgba(10, 10, 15, 0.55);
  }

  .replay-bubble {
    border-color: #2a2a2a;
    background: rgba(24, 24, 24, 0.82);
    color: #f4f4f5;
  }

  .tool-event {
    border-color: rgba(59, 130, 246, 0.28);
    background: rgba(59, 130, 246, 0.1);
    color: #f4f4f5;
  }

  .tool-event.done {
    border-color: rgba(22, 163, 74, 0.28);
    background: rgba(22, 163, 74, 0.1);
  }

  .tool-event.error {
    border-color: rgba(230, 57, 70, 0.3);
    background: rgba(230, 57, 70, 0.1);
  }

  .tool-icon {
    background: rgba(255, 255, 255, 0.08);
  }

  .tool-details {
    border-color: #2a2a2a;
    background: rgba(24, 24, 24, 0.72);
  }

  .tool-title code {
    background: rgba(255, 255, 255, 0.08);
  }

  .tool-detail {
    color: #a1a1aa;
  }

  .replay-bubble :deep(th),
  .replay-bubble :deep(td) {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .replay-bubble :deep(th) {
    background: rgba(255, 255, 255, 0.08);
  }

  .replay-controls {
    border-color: #2a2a2a;
  }

  .replay-empty,
  .tree-empty,
  .replay-controls span {
    color: #a1a1aa;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
