import type { CeebChange } from '../types'

const LABELS: Record<CeebChange['source'], string> = {
  lookup: 'Excel lookup',
  online: 'College Board',
  supplement: 'Reference supplement',
  padding: 'Zero padding',
  unchanged: 'Unchanged',
}

export function SourceBadge({ source }: { source: CeebChange['source'] }) {
  return <span className={`source-badge source-${source}`}>{LABELS[source]}</span>
}
