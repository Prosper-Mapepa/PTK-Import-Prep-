import { useEffect, useRef } from 'react'

type WelcomeModalProps = {
  open: boolean
  onClose: () => void
  storageKey: string
  title: string
  lead: string
  steps: string[]
  note?: string
  filePattern?: string
}

export function isWelcomeDismissed(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

export function dismissWelcome(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, '1')
  } catch {
    // ignore
  }
}

function splitNote(note?: string, filePattern?: string): { text?: string; pattern?: string } {
  if (filePattern) return { text: note, pattern: filePattern }
  if (!note) return {}

  const direct = note.match(/^(?:Expected file name pattern|File pattern):\s*(.+)$/i)
  if (direct) return { pattern: direct[1].trim() }

  const embedded = note.match(/^(.*?)\s*File pattern:\s*(.+)$/i)
  if (embedded) {
    return {
      text: embedded[1].trim().replace(/\.$/, '') || undefined,
      pattern: embedded[2].trim(),
    }
  }

  return { text: note }
}

/** Prefer wrapping after underscores in long filenames. */
function formatFilePattern(pattern: string): string {
  return pattern.replace(/_/g, '_\u200b')
}

export function WelcomeModal({
  open,
  onClose,
  storageKey,
  title,
  lead,
  steps,
  note,
  filePattern,
}: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { text, pattern } = splitNote(note, filePattern)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  function handleClose() {
    dismissWelcome(storageKey)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="welcome-modal"
      aria-labelledby="welcome-title"
      onCancel={(event) => {
        event.preventDefault()
        handleClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) handleClose()
      }}
    >
      <div className="welcome-modal-panel">
        <p className="welcome-modal-eyebrow">CMU · Slate Import</p>
        <h2 id="welcome-title">{title}</h2>
        <p className="welcome-modal-lead">{lead}</p>

        <ol className="welcome-modal-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {(text || pattern) && (
          <div className="welcome-file-meta">
            {text && <p className="welcome-file-meta-note">{text}</p>}
            {pattern && (
              <>
                <span className="welcome-file-pattern-label">Expected file name pattern</span>
                <code className="welcome-file-pattern-value">{formatFilePattern(pattern)}</code>
              </>
            )}
          </div>
        )}

        <div className="welcome-modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleClose}>
            Get started
          </button>
        </div>
      </div>
    </dialog>
  )
}

export const FRESHMAN_WELCOME_KEY = 'appily-freshman-welcome-dismissed'
export const TRANSFER_WELCOME_KEY = 'appily-transfer-welcome-dismissed'
export const GREENLIGHT_WELCOME_KEY = 'appily-greenlight-welcome-dismissed'
export const PROSPECTS_WELCOME_KEY = 'appily-prospects-welcome-dismissed'
