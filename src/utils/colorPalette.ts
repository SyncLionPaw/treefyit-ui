export const PALETTE_12 = [
  '#16A34A', // saturated leaf
  '#22C55E', // vivid green
  '#34D399', // mint tech
  '#10B981', // emerald
  '#65A30D', // lime moss
  '#84CC16', // lime
  '#059669', // deep emerald
  '#2DD4BF', // teal highlight
  '#14B8A6', // teal shadow
  '#A3E635', // electric leaf
  '#15803D', // forest
  '#4ADE80', // fresh leaf
]

export const UNIVERSE_DEPTH_PALETTE = [
  '#16A34A', // root leaf
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EF4444', // coral
  '#A3E635', // lime
  '#06B6D4', // cyan
]

export function sourceToColor(source: string): string {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE_12[Math.abs(hash) % PALETTE_12.length]
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized, 16)
  if (Number.isNaN(value)) return { r: 22, g: 163, b: 74 }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function mixHex(base: string, tint: string, tintWeight: number) {
  const baseRgb = hexToRgb(base)
  const tintRgb = hexToRgb(tint)
  const baseWeight = 1 - tintWeight
  return rgbToHex({
    r: baseRgb.r * baseWeight + tintRgb.r * tintWeight,
    g: baseRgb.g * baseWeight + tintRgb.g * tintWeight,
    b: baseRgb.b * baseWeight + tintRgb.b * tintWeight,
  })
}

export function universeNodeColor(node: { depth: number; color?: string }) {
  const depthColor = UNIVERSE_DEPTH_PALETTE[Math.abs(node.depth) % UNIVERSE_DEPTH_PALETTE.length]
  return mixHex(depthColor, node.color || depthColor, 0.28)
}
