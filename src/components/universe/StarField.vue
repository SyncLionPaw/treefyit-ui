<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let animId = 0

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  vx: number
  vy: number
}

let stars: Star[] = []

function initStars(w: number, h: number) {
  stars = Array.from({ length: 200 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.3 + 0.1,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
  }))
}

function draw() {
  const c = canvas.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  const w = c.width
  const h = c.height

  ctx.clearRect(0, 0, w, h)

  // Nebula patches
  const grad1 = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.4)
  grad1.addColorStop(0, 'rgba(26, 10, 46, 0.15)')
  grad1.addColorStop(1, 'transparent')
  ctx.fillStyle = grad1
  ctx.fillRect(0, 0, w, h)

  const grad2 = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.35)
  grad2.addColorStop(0, 'rgba(10, 26, 46, 0.15)')
  grad2.addColorStop(1, 'transparent')
  ctx.fillStyle = grad2
  ctx.fillRect(0, 0, w, h)

  // Stars
  for (const s of stars) {
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`
    ctx.fill()

    s.x += s.vx
    s.y += s.vy
    if (s.x < 0) s.x = w
    if (s.x > w) s.x = 0
    if (s.y < 0) s.y = h
    if (s.y > h) s.y = 0
  }

  animId = requestAnimationFrame(draw)
}

function resize() {
  const c = canvas.value
  if (!c) return
  c.width = window.innerWidth
  c.height = window.innerHeight
  if (stars.length === 0) initStars(c.width, c.height)
}

onMounted(() => {
  resize()
  draw()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="starfield"></canvas>
</template>

<style lang="scss" scoped>
@use '../../assets/styles/variables' as *;

.starfield {
  position: absolute;
  inset: 0;
  z-index: $z-starfield;
  pointer-events: none;
}
</style>
