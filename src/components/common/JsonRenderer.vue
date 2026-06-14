<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ name: 'JsonRenderer' })

const LONG_JSON_TOKEN_LENGTH = 140

const props = withDefaults(defineProps<{
  value: unknown
  name?: string
  depth?: number
  raw?: boolean
}>(), {
  depth: 0,
  raw: false,
})

const expandedRawTokens = ref<Set<string>>(new Set())

const isArray = computed(() => Array.isArray(props.value))
const isObject = computed(() => (
  props.value !== null &&
  typeof props.value === 'object' &&
  !Array.isArray(props.value)
))

const entries = computed(() => {
  if (isArray.value) {
    return (props.value as unknown[]).map((item, index) => [String(index), item] as const)
  }
  if (isObject.value) {
    return Object.entries(props.value as Record<string, unknown>)
  }
  return []
})

const label = computed(() => {
  if (isArray.value) return `Array(${entries.value.length})`
  if (isObject.value) return `Object(${entries.value.length})`
  if (props.value === null) return 'null'
  return typeof props.value
})

const rawJson = computed(() => {
  try {
    const formatted = JSON.stringify(props.value, null, 2)
    return formatted ?? 'null'
  } catch {
    return String(props.value)
  }
})

const rawLines = computed(() => rawJson.value.split('\n').map((line, lineIndex) => {
  const tokens: Array<{ id: string; text: string; type: string; collapsible?: boolean; preview?: string }> = []
  const pattern = /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\]:,])/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        id: `${lineIndex}-${tokens.length}`,
        text: line.slice(lastIndex, match.index),
        type: 'plain',
      })
    }

    const text = match[0]
    const type = text.startsWith('"') && line.slice(match.index + text.length).trimStart().startsWith(':')
      ? 'key'
      : text.startsWith('"')
        ? 'string'
        : /true|false/.test(text)
          ? 'boolean'
          : text === 'null'
            ? 'null'
            : /[{}\[\]:,]/.test(text)
              ? 'punctuation'
              : 'number'

    const collapsible = type === 'string' && text.length > LONG_JSON_TOKEN_LENGTH
    tokens.push({
      id: `${lineIndex}-${tokens.length}`,
      text,
      type,
      collapsible,
      preview: collapsible ? `${text.slice(0, 96)}"` : undefined,
    })
    lastIndex = match.index + text.length
  }

  if (lastIndex < line.length) {
    tokens.push({
      id: `${lineIndex}-${tokens.length}`,
      text: line.slice(lastIndex),
      type: 'plain',
    })
  }

  return tokens.length ? tokens : [{ id: `${lineIndex}-0`, text: '', type: 'plain' }]
}))

function isTokenExpanded(tokenId: string) {
  return expandedRawTokens.value.has(tokenId)
}

function toggleRawToken(tokenId: string) {
  const next = new Set(expandedRawTokens.value)
  if (next.has(tokenId)) {
    next.delete(tokenId)
  } else {
    next.add(tokenId)
  }
  expandedRawTokens.value = next
}

function shouldFoldToken(token: { id: string; collapsible?: boolean }) {
  return Boolean(token.collapsible && !isTokenExpanded(token.id))
}

function valueClass(value: unknown) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function formatPrimitive(value: unknown) {
  if (typeof value === 'string') return `"${value}"`
  if (value === null) return 'null'
  return String(value)
}
</script>

<template>
  <pre v-if="raw" class="json-raw" aria-label="Raw JSON"><code><span
    v-for="(line, lineIndex) in rawLines"
    :key="lineIndex"
    class="json-line"
  ><span
    v-for="(token, tokenIndex) in line"
    :key="token.id || tokenIndex"
    class="json-token"
    :class="token.type"
  ><template v-if="shouldFoldToken(token)">{{ token.preview }}<button
    class="json-fold"
    type="button"
    title="展开完整字段"
    aria-label="展开完整 JSON 字段"
    @click="toggleRawToken(token.id)"
  >...</button></template><template v-else>{{ token.text }}<button
    v-if="token.collapsible"
    class="json-fold collapse"
    type="button"
    title="折叠字段"
    aria-label="折叠 JSON 字段"
    @click="toggleRawToken(token.id)"
  >...</button></template></span><br v-if="lineIndex < rawLines.length - 1" /></span></code></pre>

  <details v-else-if="isObject || isArray" class="json-node" :open="depth < 2">
    <summary>
      <span class="json-chevron" aria-hidden="true"></span>
      <span v-if="name" class="json-key">{{ name }}</span>
      <span v-if="name" class="json-colon">:</span>
      <span class="json-type" :class="{ array: isArray }">{{ label }}</span>
    </summary>
    <div class="json-children">
      <JsonRenderer
        v-for="[entryKey, entryValue] in entries"
        :key="entryKey"
        :name="entryKey"
        :value="entryValue"
        :depth="depth + 1"
      />
    </div>
  </details>

  <div v-else class="json-leaf">
    <span v-if="name" class="json-key">{{ name }}</span>
    <span v-if="name" class="json-colon">:</span>
    <span class="json-value" :class="valueClass(value)">{{ formatPrimitive(value) }}</span>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.json-node,
.json-leaf {
  font-family: $font-mono;
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
}

.json-raw {
  margin: 0;
  color: $color-text;
  font-family: $font-mono;
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
  white-space: pre;

  code {
    display: block;
  }
}

.json-line {
  min-height: 1.45em;
}

.json-token {
  &.key { color: $color-primary; font-weight: $font-weight-medium; }
  &.string { color: #166534; }
  &.number { color: #2563eb; }
  &.boolean { color: #9333ea; }
  &.null { color: $color-text-light; }
  &.punctuation { color: $color-text-light; }
}

.json-fold {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 16px;
  margin: 0 2px;
  padding: 0 5px;
  border: 1px solid rgba($color-primary, 0.18);
  border-radius: 999px;
  background: rgba($color-primary, 0.08);
  color: $color-primary;
  cursor: pointer;
  font-family: $font-mono;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  line-height: 1;
  vertical-align: 1px;

  &:hover {
    background: rgba($color-primary, 0.14);
  }

  &.collapse {
    opacity: 0.72;
  }
}

.json-node {
  margin: 1px 0;

  summary {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    border-radius: $radius-small;
    color: $color-text;
    cursor: pointer;
    list-style: none;
    transition: background $transition-fast;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      background: $color-surface-bg;
    }
  }

  &[open] > summary .json-chevron {
    transform: rotate(90deg);
  }
}

.json-chevron {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid $color-text-light;
  transition: transform $transition-fast;
}

.json-children {
  margin-left: 18px;
  padding-left: 12px;
  border-left: 1px solid $color-border;
}

.json-leaf {
  display: flex;
  gap: 5px;
  min-height: 24px;
  align-items: center;
  padding-left: 18px;
}

.json-key {
  color: $color-primary;
  font-weight: $font-weight-medium;
}

.json-colon {
  color: $color-text-light;
}

.json-type {
  color: $color-text-light;
  font-size: $font-size-xs;

  &.array {
    color: $color-secondary;
  }
}

.json-value {
  &.string { color: #166534; }
  &.number { color: #2563eb; }
  &.boolean { color: #9333ea; }
  &.null { color: $color-text-light; }
}
</style>
