type LoaderProps = {
  message?: string
  overlay?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ size = 'md' }: { size?: LoaderProps['size'] }) {
  return <span className={`spinner spinner-${size}`} aria-hidden="true" />
}

export function Loader({ message = 'Working…', overlay = false, size = 'md' }: LoaderProps) {
  const content = (
    <div className="loader-content">
      <Spinner size={size} />
      {message && <p className="loader-message">{message}</p>}
    </div>
  )

  if (overlay) {
    return (
      <div className="loader-overlay" role="status" aria-live="polite">
        {content}
      </div>
    )
  }

  return (
    <div className="loader-inline" role="status" aria-live="polite">
      {content}
    </div>
  )
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="progress-block">
      {label && <p className="progress-label">{label}</p>}
      <div className="progress-track" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="progress-percent">{percent}%</p>
    </div>
  )
}
