export type MentionDirection = 'next' | 'previous'

export function getInitialMentionActiveIndex(optionCount: number): number {
  if (optionCount <= 0) return -1
  return 0
}

export function normalizeMentionActiveIndex(currentIndex: number, optionCount: number): number {
  if (optionCount <= 0) return -1
  if (currentIndex < 0 || currentIndex >= optionCount) return 0
  return currentIndex
}

export function getNextMentionActiveIndex(
  currentIndex: number,
  optionCount: number,
  direction: MentionDirection,
): number {
  if (optionCount <= 0) return -1
  if (optionCount === 1) return 0

  const safeIndex = normalizeMentionActiveIndex(currentIndex, optionCount)
  if (direction === 'next') {
    return (safeIndex + 1) % optionCount
  }

  return (safeIndex - 1 + optionCount) % optionCount
}
