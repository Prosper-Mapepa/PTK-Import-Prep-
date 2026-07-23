import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'appily-welcome-dismissed'

type WelcomeModalProps = {
  open: boolean
  onClose: () => void
}

export function isWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissWelcome(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  function handleClose() {
    dismissWelcome()
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
        <h2 id="welcome-title">Appily Freshman Inquiries</h2>
        <p className="welcome-modal-lead">
          Prepare Cappex freshmen inquiry files for Slate in two steps.
        </p>

        <ol className="welcome-modal-steps">
          <li>Upload the Cappex CSV from Appily.</li>
          <li>Review cleaned names, addresses, and emails.</li>
          <li>
            Set <strong>predicted_start_term</strong> to Fall of each student&apos;s HS grad date
            year (e.g. 6/1/2027 → Fall 2027).
          </li>
          <li>Export the CSV and upload it manually in Slate.</li>
        </ol>

        <p className="welcome-modal-note">
          Expected file name pattern:
          Central_Michigan_University_169248_YYYY_MM_DD_##_##_##_cappex.csv
        </p>

        <div className="welcome-modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleClose}>
            Get started
          </button>
        </div>
      </div>
    </dialog>
  )
}
