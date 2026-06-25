<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, Braces, ClipboardList, Copy, Database, FlaskConical, LoaderCircle, Search, SlidersHorizontal } from 'lucide-vue-next'
import { useQueryStore } from '../../stores/queryStore'
import { useTreeStore } from '../../stores/treeStore'
import JsonRenderer from '../common/JsonRenderer.vue'

const query = useQueryStore()
const tree = useTreeStore()

const toolOptions = [
  { value: 'overview_forest', label: 'Forest Overview' },
  { value: 'search_trees', label: 'Search Trees' },
  { value: 'search_nodes', label: 'Search Nodes' },
  { value: 'overview', label: 'Tree Overview' },
  { value: 'children', label: 'Children' },
  { value: 'inspect', label: 'Inspect' },
] as const

const toolSchema = computed(() => {
  const tool = query.params.tool
  if (tool === 'overview_forest') {
    return {
      name: 'overview_forest',
      description: 'Return an overview of the forest across all indexed trees.',
      inputSchema: { type: 'object', properties: {} },
    }
  }
  if (tool === 'search_trees') {
    return {
      name: 'search_trees',
      description: 'Search the forest and return the most relevant trees.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text used to rank trees.' },
        },
        required: ['query'],
      },
    }
  }
  if (tool === 'search_nodes') {
    return {
      name: 'search_nodes',
      description: 'Search the forest and return the most relevant nodes.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text used to rank nodes.' },
        },
        required: ['query'],
      },
    }
  }
  if (tool === 'overview') {
    return {
      name: 'overview',
      description: 'Return the overview of a single tree.',
      inputSchema: {
        type: 'object',
        properties: {
          tree_id: { type: 'string', description: 'Tree id returned by build or list APIs.' },
        },
        required: ['tree_id'],
      },
    }
  }
  if (tool === 'children') {
    return {
      name: 'children',
      description: 'Return direct children of a node in a single tree.',
      inputSchema: {
        type: 'object',
        properties: {
          tree_id: { type: 'string', description: 'Tree id returned by build or list APIs.' },
          path: { type: 'string', description: 'Dot path such as 0, 0.1, 0.1.2.' },
        },
        required: ['tree_id', 'path'],
      },
    }
  }
  return {
    name: 'inspect',
    description: 'Return detailed content for a node in a single tree.',
    inputSchema: {
      type: 'object',
      properties: {
        tree_id: { type: 'string', description: 'Tree id returned by build or list APIs.' },
        path: { type: 'string', description: 'Dot path such as 0, 0.1, 0.1.2.' },
      },
      required: ['tree_id', 'path'],
    },
  }
})

function execute() {
  query.executeQuery()
}

function selectKnowledgeBase(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (id) tree.setActiveKnowledgeBase(id)
}
</script>

<template>
  <div class="query-screen">
    <aside class="query-controls">
      <div class="panel-heading">
        <span class="section-kicker">
          <SlidersHorizontal :size="14" :stroke-width="2" aria-hidden="true" />
          Query Controls
        </span>
        <h2>结构化检索</h2>
        <p>面向 Agent 和开发者的稳定读取接口，支持 forest 与单 tree 查询。</p>
      </div>

      <div v-if="query.requiresTree(query.params.tool)" class="meta-card">
        <span>
          <Database :size="13" :stroke-width="2" aria-hidden="true" />
          Tree
        </span>
        <select class="select-input" :value="tree.activeKnowledgeBaseId" @change="selectKnowledgeBase">
          <option v-if="!tree.hasKnowledgeBases" value="">{{ tree.historyGuard.title }}</option>
          <option
            v-for="kb in tree.knowledgeBases"
            :key="kb.id"
            :value="kb.id"
          >
            {{ kb.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <span>Tool</span>
        <div class="segmented tools-grid">
          <label
            v-for="toolOption in toolOptions"
            :key="toolOption.value"
            :class="{ active: query.params.tool === toolOption.value }"
          >
            <input type="radio" :value="toolOption.value" v-model="query.params.tool" />
            {{ toolOption.label }}
          </label>
        </div>
      </div>

      <label v-if="query.requiresSearchQuery(query.params.tool)" class="field">
        <span>Query</span>
        <input
          v-model="query.params.query"
          type="text"
          class="text-input"
          placeholder="Enter search text"
        />
      </label>

      <label v-if="query.requiresPath(query.params.tool)" class="field">
        <span>Path</span>
        <input
          v-model="query.params.path"
          type="text"
          class="text-input"
          placeholder="0 or 0.1.2"
        />
      </label>

      <button class="query-btn" :disabled="query.isLoading" @click="execute">
        <LoaderCircle v-if="query.isLoading" class="spin" :size="15" :stroke-width="2" aria-hidden="true" />
        <Search v-else :size="15" :stroke-width="2" aria-hidden="true" />
        {{ query.isLoading ? 'Running...' : 'Run Query' }}
      </button>

      <div v-if="query.error" class="query-error">
        <AlertCircle :size="13" :stroke-width="2" aria-hidden="true" />
        {{ query.error }}
      </div>
    </aside>

    <main class="query-result">
      <section class="result-card primary" :class="{ collapsed: !query.result }">
        <div class="result-head">
          <span class="section-kicker">
            <Braces :size="14" :stroke-width="2" aria-hidden="true" />
            Result JSON
          </span>
          <button v-if="query.result" class="ghost-btn">
            <Copy :size="14" :stroke-width="2" aria-hidden="true" />
            Copy
          </button>
        </div>
        <div v-if="query.result" class="json-view">
          <JsonRenderer :value="query.result" raw />
        </div>
        <div v-else class="collapsed-json">
          <strong>{{ query.requiresTree(query.params.tool) && !tree.hasActiveBuild ? tree.buildGuard.title : 'No Query Result' }}</strong>
          <span>{{ query.requiresTree(query.params.tool) && !tree.hasActiveBuild ? tree.buildGuard.description : 'Run a tool to inspect the current forest or tree.' }}</span>
        </div>
      </section>

      <section class="result-card schema">
        <div class="result-head">
          <span class="section-kicker">
            <ClipboardList :size="14" :stroke-width="2" aria-hidden="true" />
            MCP Tool Schema
          </span>
          <div class="schema-actions">
            <button class="ghost-btn">
              <Copy :size="14" :stroke-width="2" aria-hidden="true" />
              Copy Schema
            </button>
            <button class="ghost-btn">
              <FlaskConical :size="14" :stroke-width="2" aria-hidden="true" />
              Test
            </button>
          </div>
        </div>
        <div class="json-view compact">
          <JsonRenderer :value="toolSchema" raw />
        </div>
      </section>
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.query-screen {
  display: grid;
  grid-template-columns: minmax(0, 1fr) $query-sidebar-width;
  gap: $space-screen;
  width: 100%;
  height: 100%;
  padding: $space-screen;
  background: $color-surface-bg;
  color: $color-text;
  overflow: hidden;
}

.query-controls,
.result-card {
  border: 1px solid $color-border;
  border-radius: $radius-panel;
  background: #fff;
  box-shadow: $shadow-control;
}

.query-controls {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  overflow: auto;
}

.panel-heading {
  padding-bottom: 4px;

  h2 {
    margin-top: 8px;
    color: $color-text;
    font-size: $font-size-title;
    font-weight: $font-weight-semibold;
    line-height: $line-height-tight;
  }

  p {
    margin-top: 8px;
    color: $color-text-light;
    font-size: $font-size-sm;
    line-height: $line-height-base;
  }
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: $color-text-light;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.meta-card {
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: $color-surface-bg;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: $color-text-light;
    font-size: $font-size-sm;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;

  > span {
    color: $color-text-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
}

.select-input,
.text-input {
  width: 100%;
  min-width: 0;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text;
  outline: none;
  transition: border-color $transition-fast, box-shadow $transition-fast;

  &:focus {
    border-color: rgba($color-primary, 0.45);
    box-shadow: 0 0 0 3px rgba($color-primary, 0.08);
  }
}

.select-input {
  height: 32px;
  padding: 0 10px;
  font-size: $font-size-sm;
}

.text-input {
  height: 36px;
  padding: 0 12px;
  font-family: $font-mono;
  font-size: $font-size-sm;
}

.segmented {
  display: grid;
  gap: 3px;
  padding: 3px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: $color-surface-bg;

  &.tools-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  label {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    border: 1px solid transparent;
    border-radius: $radius-small;
    color: $color-text-light;
    cursor: pointer;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    transition: all $transition-fast;
  }

  input { display: none; }

  .active {
    border-color: rgba($color-primary, 0.18);
    background: #fff;
    color: $color-primary;
    box-shadow: $shadow-control;
  }
}

.query-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  margin-top: 2px;
  border: none;
  border-radius: $radius-control;
  background: $color-primary;
  color: #fff;
  cursor: pointer;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  transition: background $transition-fast, transform $transition-fast;

  &:hover:not(:disabled) {
    background: $color-secondary;
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.48;
    transform: none;
  }
}

.query-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid $color-border;
  color: $color-error;
  font-size: $font-size-sm;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.spin {
  animation: spin 900ms linear infinite;
}

.query-result {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: $space-screen;
  min-width: 0;
  min-height: 0;
}

.result-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  &.primary { box-shadow: $shadow-panel; }

  &.primary:not(.collapsed) {
    min-height: 0;
  }

  &.collapsed {
    min-height: 0;
    box-shadow: $shadow-control;
  }
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 46px;
  padding: 10px 14px;
  border-bottom: 1px solid $color-border;
  background: #fff;
}

.schema-actions {
  display: flex;
  gap: 8px;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid $color-border;
  border-radius: $radius-control;
  background: #fff;
  color: $color-text-light;
  cursor: pointer;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  transition: all $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.28);
    background: $color-accent;
    color: $color-primary;
  }
}

.json-view {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border: none;
  background: #fff;
  color: $color-text;

  &.compact {
    padding: 14px 16px;
  }
}

.collapsed-json {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px 12px;
  color: $color-text-light;
  font-size: $font-size-xs;

  strong {
    color: $color-text;
    font-weight: $font-weight-semibold;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .query-screen {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .query-controls {
    grid-column: 1;
    grid-row: 1;
    max-height: 330px;
  }

  .query-result {
    grid-column: 1;
    grid-row: 2;
  }
}
</style>
