import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ScreenName, UniverseTransition } from '../types'

export const useUiStore = defineStore('ui', () => {
  const activeScreen = ref<ScreenName>('chat')
  const themeMode = ref<'light' | 'dark'>('light')
  const isUniverseMode = ref(false)
  const isChatKnowledgeDocked = ref(false)
  const universeTransition = ref<UniverseTransition>('surface')
  const hoveredNodeId = ref<string | null>(null)
  const parallaxOffset = ref({ x: 0, y: 0 })
  const isUniverseHintDismissed = ref(false)
  const isUniverseLabelsVisible = ref(true)

  function setScreen(screen: ScreenName) {
    activeScreen.value = screen
  }

  function toggleTheme() {
    themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
  }

  function setChatKnowledgeDocked(docked: boolean) {
    isChatKnowledgeDocked.value = docked
  }

  function enterUniverse() {
    if (isUniverseMode.value) return
    universeTransition.value = 'entering'
    isUniverseMode.value = true
    setTimeout(() => { universeTransition.value = 'universe' }, 600)
  }

  function exitUniverse() {
    if (!isUniverseMode.value) return
    universeTransition.value = 'exiting'
    setTimeout(() => {
      isUniverseMode.value = false
      universeTransition.value = 'surface'
    }, 400)
  }

  function setHoveredNode(id: string | null) {
    hoveredNodeId.value = id
  }

  function setParallax(x: number, y: number) {
    parallaxOffset.value = { x, y }
  }

  function dismissUniverseHint() {
    isUniverseHintDismissed.value = true
  }

  function toggleUniverseLabels() {
    isUniverseLabelsVisible.value = !isUniverseLabelsVisible.value
  }

  return {
    activeScreen, themeMode, isUniverseMode, isChatKnowledgeDocked, universeTransition,
    hoveredNodeId, parallaxOffset, isUniverseHintDismissed, isUniverseLabelsVisible,
    setScreen, toggleTheme, setChatKnowledgeDocked, enterUniverse, exitUniverse, setHoveredNode, setParallax, dismissUniverseHint, toggleUniverseLabels,
  }
})
