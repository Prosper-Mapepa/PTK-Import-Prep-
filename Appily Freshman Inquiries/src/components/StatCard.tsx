type StatCardProps = {
  value: string | number
  label: string
  highlight?: 'none' | 'resolved' | 'flagged'
}

export function StatCard({ value, label, highlight = 'none' }: StatCardProps) {
  return (
    <div className={`stat-card ${highlight !== 'none' ? `stat-${highlight}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
