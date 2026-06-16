type Step = { id: string; label: string }

type StepProgressProps = {
  steps: Step[]
  currentIndex: number
}

export function StepProgress({ steps, currentIndex }: StepProgressProps) {
  return (
    <nav className="step-progress" aria-label="Preparation steps">
      {steps.map((item, index) => {
        const status =
          index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'upcoming'
        return (
          <div key={item.id} className={`step-item step-${status}`}>
            <div className="step-marker">
              {status === 'done' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 7.2L5.5 10.2L11.5 3.8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className="step-label">{item.label}</span>
            {index < steps.length - 1 && <div className="step-connector" />}
          </div>
        )
      })}
    </nav>
  )
}
