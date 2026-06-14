import { ref, onMounted, onUnmounted } from 'vue'

export function useScrollCapture(
  onEnterUniverse: () => void,
  onExitUniverse: () => void,
  isInUniverse: () => boolean
) {
  const accumulated = ref(0)
  const THRESHOLD = 180
  let rafId = 0
  const wheelOptions = { passive: false, capture: true } as const

  function handleWheel(e: WheelEvent) {
    accumulated.value += e.deltaY

    if (!isInUniverse() && accumulated.value > THRESHOLD) {
      accumulated.value = 0
      e.preventDefault()
      e.stopImmediatePropagation()
      onEnterUniverse()
    } else if (isInUniverse() && accumulated.value < -THRESHOLD) {
      accumulated.value = 0
      e.preventDefault()
      e.stopImmediatePropagation()
      onExitUniverse()
    }
  }

  function handleBlur() {
    accumulated.value = 0
  }

  function reset() {
    accumulated.value = 0
  }

  // Decay accumulated scroll over time
  function decayLoop() {
    accumulated.value *= 0.9
    if (Math.abs(accumulated.value) < 1) accumulated.value = 0
    rafId = requestAnimationFrame(decayLoop)
  }

  onMounted(() => {
    window.addEventListener('wheel', handleWheel, wheelOptions)
    window.addEventListener('blur', handleBlur)
    rafId = requestAnimationFrame(decayLoop)
  })

  onUnmounted(() => {
    window.removeEventListener('wheel', handleWheel, wheelOptions)
    window.removeEventListener('blur', handleBlur)
    cancelAnimationFrame(rafId)
  })

  return { reset }
}
