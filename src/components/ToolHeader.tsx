import { Link } from 'react-router-dom'

type ToolHeaderProps = {
  title: string
  description: string
  onHelp?: () => void
}

export function ToolHeader({ title, description, onHelp }: ToolHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-top">
        <div className="brand-pill">CMU · Slate Import</div>
        <div className="app-header-actions">
          <Link to="/" className="back-home">
            ← All categories
          </Link>
          {onHelp && (
            <button
              type="button"
              className="btn-help"
              onClick={onHelp}
              aria-label="How this app works"
            >
              How it works
            </button>
          )}
        </div>
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}
