type LoaderProps = {
  message?: string
  variant?: 'inline' | 'banner' | 'overlay'
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ size = 'md' }: { size?: LoaderProps['size'] }) {
  return <span className={`spinner spinner-${size}`} aria-hidden="true" />
}

export function Loader({
  message = 'Working…',
  variant = 'inline',
  size = 'md',
}: LoaderProps) {
  const content = (
    <div className="loader-content">
      <Spinner size={size} />
      {message && <p className="loader-message">{message}</p>}
    </div>
  )

  if (variant === 'overlay') {
    return (
      <div className="loader-overlay" role="status" aria-live="polite">
        {content}
      </div>
    )
  }

  if (variant === 'banner') {
    return (
      <div className="loader-banner" role="status" aria-live="polite">
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
    <div className={`progress-block${label ? '' : ' progress-block-compact'}`}>
      {label && <p className="progress-label">{label}</p>}
      <div className="progress-track" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {label && <p className="progress-percent">{percent}%</p>}
    </div>
  )
}
