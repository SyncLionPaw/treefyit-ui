export function mergeStreamingText(currentText: string, nextPatch: string) {
  if (!nextPatch) return currentText
  if (!currentText) return nextPatch
  if (nextPatch === currentText) return currentText
  if (isLikelyStaleCumulativePrefix(currentText, nextPatch)) return currentText
  if (nextPatch.startsWith(currentText)) return nextPatch
  if (currentText.endsWith(nextPatch)) return currentText

  const maxOverlap = Math.min(currentText.length, nextPatch.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (currentText.slice(-overlap) === nextPatch.slice(0, overlap)) {
      return `${currentText}${nextPatch.slice(overlap)}`
    }
  }

  return `${currentText}${nextPatch}`
}

function isLikelyStaleCumulativePrefix(currentText: string, nextPatch: string) {
  if (!currentText.startsWith(nextPatch)) return false
  if (nextPatch.length < 4) return false
  return nextPatch.length / currentText.length > 0.35
}
