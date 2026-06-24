<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, BookOpenText, Cloud, Github, Hammer, HardDrive, MessageCircle, Moon, Search, Settings, Sun, X } from 'lucide-vue-next'
import { useUiStore } from '../../stores/uiStore'
import { useApiConfigStore } from '../../stores/apiConfigStore'
import type { ApiMode } from '../../stores/apiConfigStore'
import type { ScreenName } from '../../types'
import { renderMarkdown } from '../../utils/markdown'

const ui = useUiStore()
const apiConfig = useApiConfigStore()

const tabs = [
  { key: 'build' as const, icon: Hammer, label: 'Build' },
  { key: 'chat' as const, icon: MessageCircle, label: 'Chat' },
  { key: 'query' as const, icon: Search, label: 'Query' },
]

const activeIndex = computed(() => tabs.findIndex(tab => tab.key === ui.activeScreen))
const isJelly = ref(false)
const duangTab = ref<ScreenName | null>(null)
const isApiSettingsOpen = ref(false)
const isDocsOpen = ref(false)
const activeDocKey = ref('api')
const docContents = ref<Record<string, string>>({})
const isDocLoading = ref(false)
const draftApiMode = ref<ApiMode>(apiConfig.mode)
const docs = [
  { key: 'api', label: 'API', title: 'Build Service API', path: '/docs/build-service-api.md' },
  { key: 'agents', label: 'Agents', title: 'Agent Readme', path: '/docs/AGENTS.md' },
  { key: 'mcp', label: 'MCP', title: 'MCP / Skill Integration', path: '/docs/MCP.md' },
]
const activeDoc = computed(() => docs.find(doc => doc.key === activeDocKey.value) || docs[0])
const activeDocContent = computed(() => docContents.value[activeDoc.value.key] || (isDocLoading.value ? 'Loading docs...' : 'Docs not loaded.'))
const activeDocHtml = computed(() => renderMarkdown(activeDocContent.value))
const apiSettingsTitle = computed(() => `TreefyIt API: ${apiConfig.displayBaseUrl}`)
let jellyTimer = 0
let duangTimer = 0

function triggerJelly() {
  isJelly.value = false
  window.clearTimeout(jellyTimer)
  requestAnimationFrame(() => {
    isJelly.value = true
    jellyTimer = window.setTimeout(() => {
      isJelly.value = false
    }, 420)
  })
}

function selectTab(screen: ScreenName) {
  duangTab.value = screen
  window.clearTimeout(duangTimer)
  duangTimer = window.setTimeout(() => {
    duangTab.value = null
  }, 300)

  if (screen === ui.activeScreen) triggerJelly()
  ui.setScreen(screen)
}

function openApiSettings() {
  draftApiMode.value = apiConfig.mode
  isApiSettingsOpen.value = true
}

function openDocs() {
  isDocsOpen.value = true
  void loadActiveDoc()
}

function closeDocs() {
  isDocsOpen.value = false
}

async function loadActiveDoc() {
  const doc = activeDoc.value
  if (docContents.value[doc.key]) return

  isDocLoading.value = true
  try {
    const response = await fetch(doc.path)
    if (!response.ok) throw new Error(`Docs request failed: ${response.status}`)
    docContents.value = {
      ...docContents.value,
      [doc.key]: await response.text(),
    }
  } catch (err) {
    docContents.value = {
      ...docContents.value,
      [doc.key]: `# ${doc.title}\n\n无法加载文档：${err instanceof Error ? err.message : String(err)}\n\n路径：\`${doc.path}\``,
    }
  } finally {
    isDocLoading.value = false
  }
}

function closeApiSettings() {
  isApiSettingsOpen.value = false
}

function saveApiSettings() {
  apiConfig.setMode(draftApiMode.value)
  closeApiSettings()
}

watch(() => ui.activeScreen, () => {
  triggerJelly()
})

watch(activeDocKey, () => {
  if (isDocsOpen.value) void loadActiveDoc()
})
</script>

<template>
  <nav class="topnav" :class="{ 'universe-mode': ui.isUniverseMode }">
    <div class="left">
      <span class="logo" @click="ui.setScreen('chat')">
        <img src="/logo-removebg-preview.png" alt="TreefyIt" class="logo-image" />
      </span>
    </div>

    <div
      class="center tabs-center"
      v-if="!ui.isUniverseMode"
      :style="{ '--active-index': activeIndex }"
    >
      <span class="tab-blob" :class="{ jelly: isJelly }" aria-hidden="true"></span>
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: ui.activeScreen === tab.key, duang: duangTab === tab.key }"
        @click="selectTab(tab.key)"
      >
        <component :is="tab.icon" class="tab-icon" :size="15" :stroke-width="2" aria-hidden="true" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div class="center" v-else>
      <button class="back-btn" type="button" aria-label="返回表层工作区" title="返回表层工作区" @click="ui.exitUniverse()">
        <ArrowLeft :size="15" :stroke-width="2" aria-hidden="true" />
        <span>Surface</span>
      </button>
    </div>

    <div class="right">
      <button class="nav-action nav-action-icon api-settings-btn" :title="apiSettingsTitle" aria-label="打开 API 设置" @click="openApiSettings">
        <Settings :size="14" :stroke-width="2" aria-hidden="true" />
      </button>
      <button class="nav-action nav-action-icon theme-btn" :aria-label="ui.themeMode === 'light' ? '切换到黑色主题' : '切换到白色主题'" @click="ui.toggleTheme()">
        <Moon v-if="ui.themeMode === 'light'" :size="14" :stroke-width="2" aria-hidden="true" />
        <Sun v-else :size="14" :stroke-width="2" aria-hidden="true" />
      </button>
      <a class="nav-action nav-action-icon link" href="#" title="GitHub" aria-label="GitHub">
        <Github :size="14" :stroke-width="2" aria-hidden="true" />
      </a>
      <button class="nav-action nav-action-icon link" type="button" title="Docs" aria-label="打开 Docs" @click="openDocs">
        <BookOpenText :size="14" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </nav>

  <Teleport to="body">
    <div v-if="isDocsOpen" class="modal-backdrop" @click.self="closeDocs">
      <section class="docs-modal" aria-label="TreefyIt Docs">
        <div class="modal-head">
          <div>
            <span class="section-kicker">Docs</span>
            <h2>{{ activeDoc.title }}</h2>
          </div>
          <button class="modal-close" type="button" aria-label="关闭 Docs" @click="closeDocs">
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>

        <div class="docs-layout">
          <aside class="docs-tabs" aria-label="Docs sections">
            <button
              v-for="doc in docs"
              :key="doc.key"
              type="button"
              :class="{ active: activeDocKey === doc.key }"
              @click="activeDocKey = doc.key"
            >
              {{ doc.label }}
            </button>
          </aside>
          <article class="docs-content markdown-body" v-html="activeDocHtml"></article>
        </div>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="isApiSettingsOpen" class="modal-backdrop" @click.self="closeApiSettings">
      <form class="api-modal" @submit.prevent="saveApiSettings">
        <div class="modal-head">
          <div>
            <span class="section-kicker">API Settings</span>
            <h2>请求环境</h2>
          </div>
          <button class="modal-close" type="button" aria-label="关闭 API 设置" @click="closeApiSettings">
            <X :size="16" :stroke-width="2" aria-hidden="true" />
          </button>
        </div>

        <div class="runtime-switch" role="radiogroup" aria-label="API 运行模式">
          <button
            type="button"
            class="runtime-option"
            :class="{ active: draftApiMode === 'local' }"
            @click="draftApiMode = 'local'"
          >
            <HardDrive :size="15" :stroke-width="2" aria-hidden="true" />
            <span>
              Local
              <small>连接本地 TreefyIt 服务</small>
            </span>
          </button>
          <button
            type="button"
            class="runtime-option"
            :class="{ active: draftApiMode === 'cloud' }"
            @click="draftApiMode = 'cloud'"
          >
            <Cloud :size="15" :stroke-width="2" aria-hidden="true" />
            <span>
              Cloud
              <small>连接托管 TreefyIt 服务</small>
            </span>
          </button>
        </div>

        <div class="cloud-note">
          <Cloud :size="16" :stroke-width="2" aria-hidden="true" />
          当前前端不再配置或展示 LLM，模型选择与凭证管理统一由后端负责。
        </div>

        <div class="modal-actions">
          <button class="secondary-btn" type="button" @click="closeApiSettings">取消</button>
          <button class="primary-btn" type="submit">保存设置</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.topnav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: $nav-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  z-index: $z-topnav;
  background: rgba(#fff, 0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid $color-border;
  transition: background 400ms, border-color 400ms;

  &.universe-mode {
    background: rgba($universe-bg, 0.9);
    border-bottom-color: rgba(255,255,255,0.06);
  }
}

.left {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.logo-image {
  display: block;
  height: 26px;
  width: auto;
}

.center {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: $color-surface-bg;

  .universe-mode & {
    border-color: transparent;
    background: transparent;
  }
}

.tabs-center {
  --tab-width: 92px;
  --tab-gap: 4px;
  position: relative;
}

.tab-blob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: var(--tab-width);
  height: calc(100% - 8px);
  border-radius: $radius-small;
  background: $color-primary;
  box-shadow: 0 5px 12px rgba($color-primary, 0.18);
  transform: translateX(calc(var(--active-index) * (var(--tab-width) + var(--tab-gap))));
  transform-origin: center;
  transition:
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 260ms ease,
    box-shadow 260ms ease;
  will-change: transform;

  &.jelly {
    animation: tabJelly 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

}

.tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 92px;
  padding: 6px 13px;
  border: none;
  border-radius: $radius-small;
  background: transparent;
  color: $color-text-light;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition:
    color $transition-normal,
    transform $transition-fast;

  &:hover {
    color: $color-text;
    transform: translateY(-1px);
  }

  &.active {
    color: #fff;
  }

  &.duang {
    animation: tabDuang 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.tab-icon { flex-shrink: 0; }

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.82);
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.1);
    color: #fff;
    transform: translateY(-1px);
  }
}

.right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: $color-text-light;
  cursor: pointer;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  line-height: 1;
  text-decoration: none;
  transition: background $transition-fast, color $transition-fast, transform $transition-fast;

  svg {
    flex-shrink: 0;
  }

  &:hover {
    background: rgba($color-primary, 0.08);
    color: $color-primary;
    transform: translateY(-1px);
  }

  .universe-mode & {
    background: transparent;
    color: rgba(255,255,255,0.72);

    &:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
  }
}

.nav-action-icon {
  width: 30px;
  padding: 0;
}

.nav-action-text {
  gap: 6px;
  padding: 0 10px;
}

.link {
  .universe-mode & { color: rgba(255,255,255,0.72); }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: $z-topnav + 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.28);
  backdrop-filter: blur(8px);
}

.docs-modal {
  display: flex;
  flex-direction: column;
  width: min(1040px, calc(100vw - 48px));
  height: min(760px, calc(100vh - 48px));
  padding: 18px;
  border: 1px solid $color-border;
  border-radius: $radius-panel;
  background: #fff;
  color: $color-text;
  box-shadow: 0 18px 50px rgba(24, 24, 27, 0.16);
}

.docs-layout {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  flex: 1;
}

.docs-tabs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: $color-surface-bg;

  button {
    padding: 8px 10px;
    border: none;
    border-radius: $radius-small;
    background: transparent;
    color: $color-text-light;
    cursor: pointer;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    text-align: left;

    &:hover {
      color: $color-primary;
    }

    &.active {
      background: #fff;
      color: $color-text;
      box-shadow: $shadow-control;
    }
  }
}

.docs-content {
  min-width: 0;
  overflow: auto;
  padding: 22px 26px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text;
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
}

.markdown-body {
  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 1.2em 0 0.55em;
    color: $color-text;
    line-height: $line-height-tight;
  }

  :deep(h1) {
    margin-top: 0;
    font-size: 26px;
  }

  :deep(h2) { font-size: 20px; }
  :deep(h3) { font-size: 16px; }

  :deep(p),
  :deep(ul),
  :deep(ol),
  :deep(pre),
  :deep(table) {
    margin: 0.75em 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.45em;
  }

  :deep(pre) {
    overflow: auto;
    padding: 12px;
    border: 1px solid $color-border;
    border-radius: $radius-control;
    background: $color-surface-bg;
  }

  :deep(code) {
    font-family: $font-mono;
    font-size: 0.92em;
  }

  :deep(:not(pre) > code) {
    padding: 2px 5px;
    border-radius: $radius-small;
    background: $color-surface-bg;
  }

  :deep(table) {
    display: block;
    max-width: 100%;
    overflow: auto;
    border-collapse: collapse;
  }

  :deep(th),
  :deep(td) {
    padding: 7px 9px;
    border: 1px solid $color-border;
    text-align: left;
    vertical-align: top;
  }
}

.api-modal {
  width: min(460px, 100%);
  height: 370px;
  display: flex;
  flex-direction: column;
  border: 1px solid $color-border;
  border-radius: $radius-panel;
  background: #fff;
  color: $color-text;
  box-shadow: 0 18px 50px rgba(24, 24, 27, 0.16);
  padding: 18px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    margin-top: 4px;
    font-size: $font-size-title;
    font-weight: $font-weight-semibold;
    line-height: $line-height-tight;
  }
}

.section-kicker {
  color: $color-text-light;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text-light;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, transform $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.28);
    color: $color-primary;
    transform: translateY(-1px);
  }
}

.runtime-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.runtime-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 72px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: $color-surface-bg;
  color: $color-text-light;
  cursor: pointer;
  text-align: left;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast, transform $transition-fast;

  span {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: $color-text;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
  }

  small {
    color: $color-text-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-regular;
    line-height: $line-height-base;
  }

  &:hover {
    border-color: rgba($color-primary, 0.28);
    transform: translateY(-1px);
  }

  &.active {
    border-color: rgba($color-primary, 0.32);
    background: $color-accent;
    color: $color-primary;
    box-shadow: $shadow-control;
  }
}

.local-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 126px;
}

.api-field {
  display: flex;
  flex-direction: column;
  gap: 7px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: $color-text-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  input {
    height: 38px;
    width: 100%;
    border: 1px solid $color-border;
    border-radius: $radius-control;
    background: #fff;
    color: $color-text;
    outline: none;
    padding: 0 12px;
    font-size: $font-size-sm;
    transition: border-color $transition-fast, box-shadow $transition-fast;

    &:focus {
      border-color: rgba($color-primary, 0.45);
      box-shadow: 0 0 0 3px rgba($color-primary, 0.08);
    }
  }
}

.cloud-note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  min-height: 126px;
  padding: 12px;
  border: 1px solid rgba($color-primary, 0.18);
  border-radius: $radius-control;
  background: $color-accent;
  color: $color-text-light;
  font-size: $font-size-sm;
  line-height: $line-height-base;

  svg {
    flex-shrink: 0;
    color: $color-primary;
    margin-top: 1px;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

.secondary-btn,
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border-radius: $radius-control;
  cursor: pointer;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast, transform $transition-fast;
}

.secondary-btn {
  border: 1px solid $color-border;
  background: #fff;
  color: $color-text-light;

  &:hover {
    border-color: rgba($color-primary, 0.28);
    color: $color-primary;
  }
}

.primary-btn {
  background: $color-primary;
  color: #fff;

  &:hover {
    background: $color-secondary;
    transform: translateY(-1px);
  }
}

@keyframes tabJelly {
  0% { scale: 1 1; border-radius: $radius-small; }
  34% { scale: 1.22 0.82; border-radius: 11px; }
  62% { scale: 0.92 1.1; border-radius: 7px; }
  100% { scale: 1 1; border-radius: $radius-small; }
}

@keyframes tabDuang {
  0% { transform: translateY(0) scale(1); }
  32% { transform: translateY(1px) scale(0.88, 1.12); }
  64% { transform: translateY(-2px) scale(1.12, 0.9); }
  100% { transform: translateY(0) scale(1); }
}
</style>
