import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNextUpcomingFallTerm } from '../appily/lib/startTerm'

const NEXT_FALL = getNextUpcomingFallTerm()

type ToolCard = {
  to: string
  title: string
  description: string
  steps: string[]
  source: string
  note: string | null
}

type CategoryGroup = {
  id: string
  label: string
  summary: string
  tools: ToolCard[]
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'ptk',
    label: 'PTK',
    summary: 'Phi Theta Kappa monthly imports for Main Campus and Global Campus.',
    tools: [
      {
        to: '/ptk',
        title: 'PTK Import Prep',
        description:
          'Prepare monthly PTK files for Slate — clean addresses, fill CEEB codes, map AOI, and export CSV.',
        steps: ['Addresses', 'CEEB codes', 'CMU AOI', 'Start term', 'Export'],
        source: 'Team Dynamix · Main Campus & Global Campus',
        note: null,
      },
    ],
  },
  {
    id: 'appily',
    label: 'Appily',
    summary: 'Cappex freshman and transfer inquiry and prospect files from Appily SFTP.',
    tools: [
      {
        to: '/appily',
        title: 'Freshman Inquiries',
        description:
          'Prepare Cappex freshmen inquiry files — scan names, addresses, and emails, then set predicted start term.',
        steps: ['Format scan', 'Start term', 'Export'],
        source: 'Appily – Freshmen Inquiries (Cappex)',
        note: null,
      },
      {
        to: '/appily-transfer',
        title: 'Transfer Inquiries',
        description: `Prepare Cappex transfer inquiry files — format scan, then fill expected_transfer_term with ${NEXT_FALL}.`,
        steps: ['Format scan', 'Transfer term', 'Export'],
        source: 'Appily – Transfer Inquiries (Cappex) · SFTP weekly',
        note: 'Files paused Nov 2025 – Jul 2026',
      },
      {
        to: '/appily-prospects',
        title: 'Transfer Prospects',
        description: `Prepare Cappex transfer prospects — remove CMU students, clean data, add CEEB codes, fix past/blank terms to ${NEXT_FALL}.`,
        steps: ['Filter CMU', 'Format scan', 'CEEB', 'Transfer term', 'Export'],
        source: 'Appily – Transfer Prospects (Cappex) · SFTP monthly',
        note: null,
      },
    ],
  },
  {
    id: 'niche',
    label: 'Niche',
    summary: 'Niche inquiry and prospect files from SFTP incoming/niche and Niche/Prospects.',
    tools: [
      {
        to: '/niche-freshman',
        title: 'Freshman Inquiries',
        description:
          'Prepare Niche freshman files — split transfers, clean formatting, pad ZIP/CEEB zeros, fill missing HighSchoolCEEB.',
        steps: ['Split transfers', 'Format scan', 'CEEB', 'Export'],
        source: 'Niche · SFTP incoming/niche · weekly Monday',
        note: null,
      },
      {
        to: '/niche-transfer',
        title: 'Transfer Inquiries',
        description:
          'Prepare Niche transfer files — remove CMU students, clean data, fill CollegeCEEB, fix TransferEnrollmentDate.',
        steps: ['Filter CMU', 'Format scan', 'CEEB', 'Enrollment date', 'Export'],
        source: 'Niche · SFTP incoming/niche · weekly Monday',
        note: null,
      },
      {
        to: '/niche-prospects',
        title: 'Freshman Prospects',
        description:
          'Prepare Niche freshman prospect files — clean data, add CMU AOI from MajorCIP, fill HighSchoolCEEB.',
        steps: ['Format scan', 'CMU AOI', 'CEEB', 'Export'],
        source: 'Niche · SFTP incoming/Niche/Prospects · Wednesdays',
        note: null,
      },
      {
        to: '/niche-transfer-prospects',
        title: 'Transfer Prospects',
        description: `Prepare Niche transfer prospects — map CMU AOI, fill CollegeCEEB, fix past IntendedTransferDate to ${NEXT_FALL}.`,
        steps: ['Format scan', 'CMU AOI', 'CEEB', 'Transfer date', 'Export'],
        source: 'Niche · SFTP incoming/Niche/Prospects · Wednesdays',
        note: null,
      },
    ],
  },
  {
    id: 'greenlight',
    label: 'Greenlight',
    summary: 'College Greenlight inquiry files from Appily Cappex SFTP.',
    tools: [
      {
        to: '/appily-greenlight',
        title: 'College Greenlight',
        description:
          'Prepare Cappex College Greenlight inquiry files — scan names, addresses, and emails for weekly Slate upload.',
        steps: ['Format scan', 'Export'],
        source: 'Appily – College Greenlight Inquiries (Cappex) · SFTP weekly',
        note: 'Files paused Aug 2025 – Jul 2026',
      },
    ],
  },
]

function readInitialTab(): string {
  const hash = window.location.hash.replace(/^#/, '')
  if (CATEGORY_GROUPS.some((group) => group.id === hash)) return hash
  return CATEGORY_GROUPS[0].id
}

export default function LandingPage() {
  const [activeId, setActiveId] = useState(readInitialTab)
  const active = useMemo(
    () => CATEGORY_GROUPS.find((group) => group.id === activeId) ?? CATEGORY_GROUPS[0],
    [activeId],
  )

  function selectTab(id: string) {
    setActiveId(id)
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="landing-page">
      <div className="landing">
        <header className="landing-hero">
          <p className="landing-brand">CMU · Slate Import</p>
          <h1>File Prep</h1>
          <p className="landing-lead">
            Choose a source, then open the tool you need for Slate upload.
          </p>
        </header>

        <div className="landing-tabs" role="tablist" aria-label="Source categories">
          {CATEGORY_GROUPS.map((group) => {
            const selected = group.id === active.id
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                id={`tab-${group.id}`}
                aria-selected={selected}
                aria-controls={`panel-${group.id}`}
                tabIndex={selected ? 0 : -1}
                className={`landing-tab${selected ? ' is-active' : ''}`}
                onClick={() => selectTab(group.id)}
                onKeyDown={(event) => {
                  const index = CATEGORY_GROUPS.findIndex((item) => item.id === group.id)
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    const next = CATEGORY_GROUPS[(index + 1) % CATEGORY_GROUPS.length]
                    selectTab(next.id)
                    document.getElementById(`tab-${next.id}`)?.focus()
                  }
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    const prev =
                      CATEGORY_GROUPS[(index - 1 + CATEGORY_GROUPS.length) % CATEGORY_GROUPS.length]
                    selectTab(prev.id)
                    document.getElementById(`tab-${prev.id}`)?.focus()
                  }
                }}
              >
                {group.label}
              </button>
            )
          })}
        </div>

        <section
          className="landing-panel"
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
        >
          <p className="landing-panel-summary">{active.summary}</p>

          <div
            className={`category-grid${active.tools.length === 1 ? ' category-grid-single' : ''}`}
          >
            {active.tools.map((tool) => (
              <Link key={tool.to} to={tool.to} className="category-card">
                <div className="category-card-top">
                  <h2>{tool.title}</h2>
                  {tool.note && <span className="category-badge">Paused</span>}
                </div>
                <p className="category-desc">{tool.description}</p>
                <ul className="category-steps">
                  {tool.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="category-card-foot">
                  <p className="category-source">{tool.source}</p>
                  <span className="category-cta">
                    Open
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                {tool.note && <p className="category-note">{tool.note}</p>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
