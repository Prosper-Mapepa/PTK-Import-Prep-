import { useEffect, useRef } from 'react'

type WelcomeModalProps = {
  open: boolean
  onClose: () => void
  storageKey: string
  title: string
  lead: string
  steps: string[]
  note: string
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

export function WelcomeModal({
  open,
  onClose,
  storageKey,
  title,
  lead,
  steps,
  note,
}: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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

        <p className="welcome-modal-note">{note}</p>

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
