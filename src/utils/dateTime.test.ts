import { describe, expect, it } from 'vitest'
import { formatUiDateTime } from './dateTime'

describe('formatUiDateTime', () => {
  const value = '2026-06-27T05:08:09.984309+00:00'

  it('formats compact date time', () => {
    expect(formatUiDateTime(value, { preset: 'compact', timeZone: 'UTC' })).toBe('2026-06-27 05:08')
  })

  it('formats month-day time for list views', () => {
    expect(formatUiDateTime(value, { preset: 'monthDayTime', timeZone: 'UTC' })).toBe('06-27 05:08')
  })

  it('formats detail date time when seconds are needed', () => {
    expect(formatUiDateTime(value, { preset: 'detail', timeZone: 'UTC' })).toBe('2026-06-27 05:08:09')
  })

  it('returns fallback for invalid values', () => {
    expect(formatUiDateTime('', { fallback: '--' })).toBe('--')
    expect(formatUiDateTime('not-a-date', { fallback: '--' })).toBe('--')
  })
})
