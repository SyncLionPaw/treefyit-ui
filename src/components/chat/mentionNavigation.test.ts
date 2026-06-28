import { describe, expect, it } from 'vitest'
import {
  getInitialMentionActiveIndex,
  getNextMentionActiveIndex,
  normalizeMentionActiveIndex,
} from './mentionNavigation'

describe('mentionNavigation', () => {
  it('returns -1 for empty options', () => {
    expect(getInitialMentionActiveIndex(0)).toBe(-1)
    expect(normalizeMentionActiveIndex(0, 0)).toBe(-1)
    expect(getNextMentionActiveIndex(0, 0, 'next')).toBe(-1)
    expect(getNextMentionActiveIndex(0, 0, 'previous')).toBe(-1)
  })

  it('keeps the only option selected for single-option lists', () => {
    expect(getInitialMentionActiveIndex(1)).toBe(0)
    expect(normalizeMentionActiveIndex(-1, 1)).toBe(0)
    expect(getNextMentionActiveIndex(0, 1, 'next')).toBe(0)
    expect(getNextMentionActiveIndex(0, 1, 'previous')).toBe(0)
  })

  it('cycles forward for multi-option lists', () => {
    expect(getNextMentionActiveIndex(0, 3, 'next')).toBe(1)
    expect(getNextMentionActiveIndex(1, 3, 'next')).toBe(2)
    expect(getNextMentionActiveIndex(2, 3, 'next')).toBe(0)
  })

  it('cycles backward for multi-option lists', () => {
    expect(getNextMentionActiveIndex(2, 3, 'previous')).toBe(1)
    expect(getNextMentionActiveIndex(1, 3, 'previous')).toBe(0)
    expect(getNextMentionActiveIndex(0, 3, 'previous')).toBe(2)
  })

  it('falls back to the first option for invalid indexes', () => {
    expect(normalizeMentionActiveIndex(-1, 3)).toBe(0)
    expect(normalizeMentionActiveIndex(4, 3)).toBe(0)
    expect(getNextMentionActiveIndex(-1, 3, 'next')).toBe(1)
    expect(getNextMentionActiveIndex(8, 3, 'previous')).toBe(2)
  })
})
