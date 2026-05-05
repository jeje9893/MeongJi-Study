export function mergeHighlights(highlights) {
  if (!highlights.length) return []
  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const merged = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end) last.end = Math.max(last.end, sorted[i].end)
    else merged.push({ ...sorted[i] })
  }
  return merged
}

export function renderWithHighlights(text, highlights) {
  if (!highlights?.length) return text
  const merged = mergeHighlights(highlights)
  const segments = []
  let cursor = 0
  merged.forEach(({ start, end }, i) => {
    if (cursor < start) segments.push(<span key={`n${i}`}>{text.slice(cursor, start)}</span>)
    segments.push(
      <mark key={`h${i}`} style={{ background: 'rgba(251,191,36,0.3)', color: 'inherit', borderRadius: 3, padding: '1px 2px' }}>
        {text.slice(start, end)}
      </mark>
    )
    cursor = end
  })
  if (cursor < text.length) segments.push(<span key="n-last">{text.slice(cursor)}</span>)
  return segments
}

export function getSelectionOffsets(containerEl) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!containerEl.contains(range.commonAncestorContainer)) return null
  const preRange = range.cloneRange()
  preRange.selectNodeContents(containerEl)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const selected = range.toString()
  if (!selected) return null
  return { start, end: start + selected.length }
}
