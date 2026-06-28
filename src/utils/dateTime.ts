export type UiDateTimePreset = 'compact' | 'detail' | 'monthDayTime'

interface FormatUiDateTimeOptions {
  preset?: UiDateTimePreset
  fallback?: string
  timeZone?: string
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function normalizeDate(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function getDateTimeParts(date: Date, timeZone?: string) {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => (
    Number(parts.find(part => part.type === type)?.value || 0)
  )

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  }
}

export function formatUiDateTime(value: string, options: FormatUiDateTimeOptions = {}) {
  const {
    preset = 'compact',
    fallback = value || '--',
    timeZone,
  } = options

  const date = normalizeDate(value)
  if (!date) return fallback

  const parts = getDateTimeParts(date, timeZone)
  const year = parts.year
  const month = pad(parts.month)
  const day = pad(parts.day)
  const hour = pad(parts.hour)
  const minute = pad(parts.minute)
  const second = pad(parts.second)

  if (preset === 'monthDayTime') {
    return `${month}-${day} ${hour}:${minute}`
  }

  if (preset === 'detail') {
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  return `${year}-${month}-${day} ${hour}:${minute}`
}
