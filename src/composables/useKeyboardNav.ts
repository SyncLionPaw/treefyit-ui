import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from '../stores/uiStore'

export function useKeyboardNav() {
  const ui = useUiStore()

  function isEditableTarget(target: EventTarget | null) {
    const element = target as HTMLElement | null
    if (!element) return false
    return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
  }

  function handleKey(e: KeyboardEvent) {
    if (isEditableTarget(e.target) && e.key !== 'Escape') return

    if (e.key === 'ArrowDown' && !ui.isUniverseMode) {
      e.preventDefault()
      ui.enterUniverse()
      return
    }

    if ((e.key === 'Escape' || e.key === 'ArrowUp') && ui.isUniverseMode) {
      e.preventDefault()
      ui.exitUniverse()
      return
    }

    // Switch screens (only on surface)
    if (!ui.isUniverseMode) {
      if (e.key === 'ArrowLeft') {
        const order: Array<'build' | 'chat' | 'query'> = ['build', 'chat', 'query']
        const idx = order.indexOf(ui.activeScreen)
        if (idx > 0) ui.setScreen(order[idx - 1])
      }
      if (e.key === 'ArrowRight') {
        const order: Array<'build' | 'chat' | 'query'> = ['build', 'chat', 'query']
        const idx = order.indexOf(ui.activeScreen)
        if (idx < 2) ui.setScreen(order[idx + 1])
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKey))
  onUnmounted(() => window.removeEventListener('keydown', handleKey))
}
