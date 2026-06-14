import { ref } from 'vue'
import { useMouse } from '@vueuse/core'

export function useParallax() {
  const { x, y } = useMouse({ type: 'client' })

  const foregroundOffset = ref({ x: 0, y: 0 })
  const nearBlockOffset = ref({ x: 0, y: 0 })
  const farBlockOffset = ref({ x: 0, y: 0 })

  function update(width: number, height: number) {
    const nx = (x.value / width - 0.5) * 2  // -1 to 1
    const ny = (y.value / height - 0.5) * 2

    foregroundOffset.value = { x: nx * 20, y: ny * 15 }
    nearBlockOffset.value = { x: nx * 8, y: ny * 6 }
    farBlockOffset.value = { x: nx * 3, y: ny * 2 }
  }

  return { foregroundOffset, nearBlockOffset, farBlockOffset, update }
}
