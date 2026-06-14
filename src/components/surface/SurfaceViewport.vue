<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import ChatScreen from './ChatScreen.vue'
import BuildScreen from './BuildScreen.vue'
import QueryScreen from './QueryScreen.vue'

const ui = useUiStore()
const isSnapping = ref(false)
let snapTimer = 0

const translateX = computed(() => {
  switch (ui.activeScreen) {
    case 'build': return 0
    case 'chat': return -100
    case 'query': return -200
  }
})

function forceSnapAfterTransition() {
  window.clearTimeout(snapTimer)
  isSnapping.value = false
  snapTimer = window.setTimeout(() => {
    isSnapping.value = true
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSnapping.value = false
        })
      })
    })
  }, 680)
}

function handleTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== 'transform') return
  window.clearTimeout(snapTimer)
}

watch(() => ui.activeScreen, forceSnapAfterTransition, { flush: 'post' })

onBeforeUnmount(() => {
  window.clearTimeout(snapTimer)
})
</script>

<template>
  <div
    class="surface-viewport"
    :class="{ snapping: isSnapping }"
    :style="{ transform: `translate3d(${translateX}vw, 0, 0)` }"
    @transitionend="handleTransitionEnd"
  >
    <div class="surface-screen" :class="{ active: ui.activeScreen === 'build' }">
      <BuildScreen />
    </div>
    <div class="surface-screen" :class="{ active: ui.activeScreen === 'chat' }">
      <ChatScreen />
    </div>
    <div class="surface-screen" :class="{ active: ui.activeScreen === 'query' }">
      <QueryScreen />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.surface-viewport {
  position: absolute;
  top: $nav-height;
  left: 0;
  display: flex;
  width: 300vw;
  height: calc(100vh - #{$nav-height});
  transition: transform $transition-screen;
  will-change: transform;
  transform-style: preserve-3d;

  &.snapping {
    transition: none;
  }
}

.surface-screen {
  flex: 0 0 100vw;
  width: 100vw;
  min-width: 100vw;
  height: calc(100vh - $nav-height);
  overflow: hidden;
  opacity: 0.68;
  transform: scale(0.985);
  transition:
    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
  pointer-events: none;

  &.active {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }
}
</style>
