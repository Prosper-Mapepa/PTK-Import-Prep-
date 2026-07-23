export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const beforeValue = before.trim()
  const afterValue = after.trim()
  const cleared = beforeValue && !afterValue

  return (
    <div className="before-after-pair">
      <span className="change-cell change-before" title="Before">
        {beforeValue || '—'}
      </span>
      <span className="change-arrow" aria-hidden="true">
        →
      </span>
      <span
        className={`change-cell ${cleared ? 'change-cleared' : 'change-after'}`}
        title="After"
      >
        {afterValue || (cleared ? 'Removed' : '—')}
      </span>
    </div>
  )
}

export function ChangeLegend() {
  return (
    <div className="change-legend" aria-label="Color legend">
      <span className="legend-item">
        <span className="legend-swatch legend-before" /> Before
      </span>
      <span className="legend-item">
        <span className="legend-swatch legend-after" /> After
      </span>
    </div>
  )
}
