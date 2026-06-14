<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Check,
  Layers3,
  MessageCircle,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { useChatStore } from '../../stores/chatStore'
import { useTreeStore } from '../../stores/treeStore'

const tree = useTreeStore()
const chat = useChatStore()
const activeTab = ref<'knowledge' | 'history'>('knowledge')
const historyListEl = ref<HTMLElement | null>(null)

const sessionRows = computed(() => chat.sessions.map(session => ({
  ...session,
  title: compactText(session.title || 'Untitled chat'),
  time: formatSessionTime(session.updated_at || session.created_at),
  model: compactText(session.model || 'unknown model', 28),
})))

function compactText(text: string, maxLength = 92) {
  const compacted = text.replace(/\s+/g, ' ').trim()
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}...` : compacted
}

function formatSessionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '--'
  return date.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function refreshSessions() {
  void chat.loadSessions({ bid: tree.currentBuild?.id, limit: 50 })
}

function openSession(session: typeof chat.sessions[number]) {
  void chat.loadSessionTurns(session)
}

function removeSession(sessionId: string) {
  void chat.deleteSession(sessionId)
}

const historyScrollSignature = computed(() => sessionRows.value.map(record => `${record.id}:${record.title}:${record.time}`).join('|'))

async function scrollHistoryToBottom() {
  await nextTick()
  if (activeTab.value !== 'history') return
  requestAnimationFrame(() => {
    if (historyListEl.value) historyListEl.value.scrollTop = historyListEl.value.scrollHeight
  })
}

watch([historyScrollSignature, activeTab], () => {
  void scrollHistoryToBottom()
}, { flush: 'post' })

watch([activeTab, () => tree.currentBuild?.id], () => {
  if (activeTab.value === 'history') refreshSessions()
}, { immediate: true })

defineProps<{
  docked?: boolean
}>()
defineEmits<{
  expand: []
}>()
</script>

<template>
  <aside class="chat-sidebar" :class="{ docked }">
    <div class="sidebar-header">
      <div class="sidebar-tabs" role="tablist" aria-label="Chat sidebar tabs">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'knowledge'"
          :class="{ active: activeTab === 'knowledge' }"
          @click="activeTab = 'knowledge'"
        >
          知识库
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'history'"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          聊天记录
        </button>
      </div>
    </div>

    <template v-if="activeTab === 'knowledge'">
      <div class="kb-current">
        <span class="current-kicker">当前知识库</span>
        <strong>{{ tree.activeBuildTitle }}</strong>
        <p>{{ tree.activeBuildDescription }}</p>
        <div class="current-meta">
          <span>{{ tree.hasActiveBuild ? 1 : 0 }} docs</span>
          <span>{{ tree.activeBuildNodeCount }} nodes</span>
        </div>
      </div>

      <div class="kb-list" aria-label="切换知识库">
        <button
          v-for="kb in tree.knowledgeBases"
          :key="kb.id"
          class="kb-item"
          :class="{ active: tree.activeKnowledgeBaseId === kb.id }"
          @click="tree.setActiveKnowledgeBase(kb.id)"
        >
          <span class="kb-icon">
            <Layers3 :size="14" :stroke-width="2" aria-hidden="true" />
          </span>
          <span class="kb-info">
            <strong>{{ kb.name }}</strong>
            <small>{{ kb.updatedAt }} · {{ kb.documentCount }} docs</small>
          </span>
          <Check v-if="tree.activeKnowledgeBaseId === kb.id" class="kb-check" :size="14" :stroke-width="2.2" aria-hidden="true" />
        </button>
        <p v-if="tree.historyGuard.status !== 'ready'" class="kb-empty">
          <strong>{{ tree.historyGuard.title }}</strong>
          <span>{{ tree.historyGuard.description }}</span>
        </p>
      </div>
    </template>

    <div v-else ref="historyListEl" class="history-list" aria-label="查看聊天记录">
      <div class="history-summary">
        <span>{{ chat.sessionsGuard.description }}</span>
        <button class="history-refresh" type="button" :disabled="chat.sessionsLoading" @click="refreshSessions">
          <RefreshCw :size="12" :stroke-width="2.2" aria-hidden="true" />
          <small>{{ chat.sessionsLoading ? 'Loading' : 'Refresh' }}</small>
        </button>
      </div>
      <div
        v-for="record in sessionRows"
        :key="record.id"
        class="history-item"
        :class="{ active: chat.selectedSessionId === record.id }"
        role="button"
        tabindex="0"
        @click="openSession(record)"
        @keydown.enter="openSession(record)"
        @keydown.space.prevent="openSession(record)"
      >
        <p class="history-title">
          <span class="history-dot">{{ record.turn_count }}</span>
          <span>{{ record.title || 'Untitled chat' }}</span>
        </p>
        <small>{{ record.time }} · {{ record.model }}</small>
        <button class="history-delete" type="button" aria-label="删除对话" @click.stop="removeSession(record.id)">
          <Trash2 :size="12" :stroke-width="2.2" aria-hidden="true" />
        </button>
      </div>
      <p v-if="chat.sessionsGuard.status !== 'ready'" class="kb-empty">
        <strong>{{ chat.sessionsGuard.title }}</strong>
        <span>{{ chat.sessionsGuard.description }}</span>
      </p>
      <p v-if="chat.turnsLoading" class="kb-empty">正在加载对话消息...</p>
    </div>

    <div class="sidebar-note">
      <MessageCircle :size="14" :stroke-width="2" aria-hidden="true" />
      <span>{{ activeTab === 'knowledge' ? 'Chat 可直接对话，也可绑定当前知识库提问。上传和构建请切到 Build。' : '这里展示后端保存的对话列表；点击会话可载入完整消息并 Replay。' }}</span>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.chat-sidebar {
  position: absolute;
  left: $space-screen;
  top: $space-screen;
  z-index: 2;
  width: $sidebar-width;
  height: calc(100% - #{$space-screen * 2});
  margin: 0;
  border: 1px solid $color-border;
  border-radius: $radius-panel;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-shadow: $shadow-control;
  flex-shrink: 0;
  overflow: hidden;
  transition:
    left 620ms cubic-bezier(0.22, 1, 0.36, 1),
    top 620ms cubic-bezier(0.22, 1, 0.36, 1),
    width 620ms cubic-bezier(0.22, 1, 0.36, 1),
    height 620ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 620ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 420ms ease,
    opacity 220ms ease;

  &.docked {
    box-sizing: border-box;
    left: 32px;
    top: calc(100% - 72px);
    z-index: 0;
    width: 0;
    height: 0;
    border-color: transparent;
    border-radius: 999px;
    background: transparent;
    box-shadow: none;
    opacity: 0;
    pointer-events: none;

    .sidebar-header,
    .sidebar-tabs,
    .kb-current,
    .kb-list,
    .history-list,
    .sidebar-note {
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px) scale(0.94);
    }
  }
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 12px 14px 10px;
  border-bottom: 1px solid $color-border;
  transition: opacity 180ms ease, transform 260ms ease;
}

.sidebar-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border: 1px solid rgba($color-border, 0.86);
  border-radius: $radius-control;
  background: $color-surface-bg;
  transition: opacity 180ms ease, transform 260ms ease;

  button {
    height: 28px;
    border-radius: calc(#{$radius-control} - 3px);
    background: transparent;
    color: $color-text-light;
    cursor: pointer;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    transition: background $transition-fast, color $transition-fast, box-shadow $transition-fast;

    &.active {
      background: #fff;
      color: $color-text;
      box-shadow: $shadow-control;
    }
  }
}

.kb-current {
  margin: 14px;
  padding: 14px;
  border: 1px solid $color-border;
  border-radius: $radius-panel;
  background: $color-surface-bg;
  min-width: 0;
  overflow: hidden;
  transition: opacity 180ms ease, transform 260ms ease;

  strong {
    display: block;
    overflow: hidden;
    margin-top: 7px;
    color: $color-text;
    font-size: $font-size-title;
    font-weight: $font-weight-semibold;
    line-height: $line-height-tight;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    overflow: hidden;
    margin-top: 8px;
    color: $color-text-light;
    font-size: $font-size-sm;
    line-height: $line-height-base;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.current-kicker {
  color: $color-text-light;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.current-meta {
  display: flex;
  gap: 8px;
  min-width: 0;
  margin-top: 12px;
  overflow: hidden;

  span {
    min-width: 0;
    overflow: hidden;
    padding: 4px 8px;
    border: 1px solid rgba($color-primary, 0.16);
    border-radius: 999px;
    background: #fff;
    color: $color-primary;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.kb-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding: 0 14px 14px;
  transition: opacity 180ms ease, transform 260ms ease;
}

.history-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  transition: opacity 180ms ease, transform 260ms ease;
}

.history-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba($color-primary, 0.16);
  border-radius: $radius-control;
  background: $color-accent;

  span {
    color: $color-primary;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }

  small {
    color: $color-text-light;
    font-size: $font-size-xs;
  }
}

.history-refresh,
.history-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba($color-border, 0.9);
  border-radius: 999px;
  background: #fff;
  color: $color-text-light;
  cursor: pointer;
  transition: border-color $transition-fast, color $transition-fast, background $transition-fast;

  &:hover:not(:disabled) {
    border-color: rgba($color-primary, 0.28);
    color: $color-primary;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }
}

.history-refresh {
  gap: 5px;
  min-width: 0;
  padding: 4px 7px;
  flex-shrink: 0;
}

.history-item {
  position: relative;
  display: grid;
  gap: 5px;
  padding: 10px 34px 10px 10px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color $transition-fast, background $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.26);
    background: $color-surface-bg;
    transform: translateY(-1px);
  }

  &.active {
    border-color: rgba($color-primary, 0.38);
    background: $color-accent;
  }

  &.user {
    border-color: rgba($color-primary, 0.28);
    background: rgba($color-primary, 0.06);
  }

  &.system {
    border-color: rgba($color-warning, 0.22);
    background: rgba($color-warning, 0.07);
  }

  p {
    overflow: hidden;
    color: $color-text;
    font-size: $font-size-sm;
    line-height: $line-height-base;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: $color-text-light;
    font-size: $font-size-xs;
  }
}

.history-delete {
  position: absolute;
  top: 9px;
  right: 8px;
  width: 24px;
  height: 24px;
  padding: 0;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;

  span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.history-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border: 1px solid rgba($color-primary, 0.2);
  border-radius: 999px;
  background: rgba($color-primary, 0.09);
  color: $color-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  line-height: 1;
  flex-shrink: 0;
}

.kb-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text;
  cursor: pointer;
  text-align: left;
  transition: border-color $transition-fast, background $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.26);
    background: $color-surface-bg;
    transform: translateY(-1px);
  }

  &.active {
    border-color: rgba($color-primary, 0.38);
    background: $color-accent;
  }
}

.kb-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text-light;
  font-size: $font-size-sm;
  line-height: $line-height-base;

  strong {
    color: $color-text;
    font-weight: $font-weight-semibold;
  }
}

.kb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: $radius-control;
  background: $color-surface-bg;
  color: $color-primary;
  flex-shrink: 0;
}

.kb-info {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;

  strong {
    overflow: hidden;
    color: $color-text;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    overflow: hidden;
    color: $color-text-light;
    font-size: $font-size-xs;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.kb-check {
  color: $color-primary;
  flex-shrink: 0;
}

.sidebar-note {
  display: flex;
  gap: 8px;
  margin: 0 14px 14px;
  padding: 11px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text-light;
  font-size: $font-size-sm;
  line-height: $line-height-base;
  transition: opacity 180ms ease, transform 260ms ease;
}
</style>
