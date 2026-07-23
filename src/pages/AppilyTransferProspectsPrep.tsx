import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BeforeAfter, ChangeLegend } from '../components/BeforeAfter'
import { Loader, ProgressBar } from '../components/Loader'
import { SourceBadge } from '../components/SourceBadge'
import { StatCard } from '../components/StatCard'
import { StepProgress } from '../components/StepProgress'
import { TablePagination } from '../components/TablePagination'
import {
  WelcomeModal,
  PROSPECTS_WELCOME_KEY,
  isWelcomeDismissed,
} from '../appily/components/WelcomeModal'
import { cleanAddresses, findAddressIssues, getAddressPreview } from '../appily/lib/addressClean'
import {
  resolveColumns,
  validateAppilyTransferProspectsHeaders,
} from '../appily/lib/columns'
import { cleanEmails } from '../appily/lib/emailClean'
import { downloadTextFile, parseImportFile, rowsToCsv } from '../appily/lib/fileUtils'
import { cleanNames } from '../appily/lib/nameClean'
import { buildChangeGroups, paginateItems } from '../appily/lib/pagination'
import {
  applyProspectCeebCodes,
  type ProspectCeebChange,
  type ProspectCeebMissing,
} from '../appily/lib/prospectCeeb'
import {
  applyProspectTransferTerms,
  insertCeebColumnAfterCollege,
  removeCmuStudents,
} from '../appily/lib/prospectsPrep'
import { getNextUpcomingFallTerm } from '../appily/lib/startTerm'
import type { AddressIssue, AppilyRow, ColumnMap, FieldChange } from '../appily/types'

type StepId = 'upload' | 'format' | 'ceeb' | 'transfer-term' | 'export'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'format', label: 'Format scan' },
  { id: 'ceeb', label: 'CEEB codes' },
  { id: 'transfer-term', label: 'Transfer term' },
  { id: 'export', label: 'Export' },
]

const FILE_RE = /\.csv$/i
const NEXT_FALL = getNextUpcomingFallTerm()

export default function AppilyTransferProspectsPrep() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<AppilyRow[]>([])
  const [columns, setColumns] = useState<ColumnMap | null>(null)
  const [removedCmu, setRemovedCmu] = useState<AppilyRow[]>([])
  const [formatChanges, setFormatChanges] = useState<FieldChange[]>([])
  const [addressIssues, setAddressIssues] = useState<AddressIssue[]>([])
  const [ceebChanges, setCeebChanges] = useState<ProspectCeebChange[]>([])
  const [ceebMissing, setCeebMissing] = useState<ProspectCeebMissing[]>([])
  const [termChanges, setTermChanges] = useState<FieldChange[]>([])
  const [appliedTerm, setAppliedTerm] = useState(NEXT_FALL)
  const [formatPage, setFormatPage] = useState(1)
  const [issuesPage, setIssuesPage] = useState(1)
  const [ceebPage, setCeebPage] = useState(1)
  const [missingPage, setMissingPage] = useState(1)
  const [termPage, setTermPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ceebBusy, setCeebBusy] = useState(false)
  const [ceebProgress, setCeebProgress] = useState({ done: 0, total: 0 })
  const [welcomeOpen, setWelcomeOpen] = useState(() => !isWelcomeDismissed(PROSPECTS_WELCOME_KEY))
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const ceebRan = useRef(false)

  const stepIndex = STEPS.findIndex((item) => item.id === step)

  const exportFileName = useMemo(() => {
    if (!fileName) return 'transfer-prospects-prepared.csv'
    const base = fileName.replace(/\.csv$/i, '')
    return `${base}_prepared.csv`
  }, [fileName])

  const formatGroups = useMemo(
    () => buildChangeGroups(formatChanges, formatPage),
    [formatChanges, formatPage],
  )
  const pagedIssues = useMemo(
    () => paginateItems(addressIssues, issuesPage),
    [addressIssues, issuesPage],
  )
  const pagedCeeb = useMemo(() => paginateItems(ceebChanges, ceebPage), [ceebChanges, ceebPage])
  const pagedMissing = useMemo(
    () => paginateItems(ceebMissing, missingPage),
    [ceebMissing, missingPage],
  )
  const termGroups = useMemo(
    () => buildChangeGroups(termChanges, termPage),
    [termChanges, termPage],
  )

  async function handleUpload(file: File) {
    if (!FILE_RE.test(file.name)) {
      setError('Please upload a Transfer Prospects CSV file (.csv).')
      return
    }

    setLoading(true)
    setError('')
    ceebRan.current = false

    try {
      const parsed = await parseImportFile(file)
      let mapped = resolveColumns(parsed.headers)
      validateAppilyTransferProspectsHeaders(mapped)

      const filtered = removeCmuStudents(parsed.rows, mapped)
      const withCeebCol = insertCeebColumnAfterCollege(
        parsed.headers,
        filtered.rows,
        mapped,
      )
      mapped = withCeebCol.columns

      const named = cleanNames(withCeebCol.rows, mapped)
      const emailed = cleanEmails(named.rows, mapped)
      const addressed = cleanAddresses(emailed.rows, mapped)
      const termed = applyProspectTransferTerms(addressed.rows, mapped, NEXT_FALL)
      const issues = findAddressIssues(termed.rows, mapped)

      setFileName(file.name)
      setHeaders(withCeebCol.headers)
      setColumns(mapped)
      setRows(termed.rows)
      setRemovedCmu(filtered.removed)
      setFormatChanges([...named.changes, ...emailed.changes, ...addressed.changes])
      setAddressIssues(issues)
      setTermChanges(termed.changes)
      setAppliedTerm(termed.term)
      setCeebChanges([])
      setCeebMissing([])
      setFormatPage(1)
      setIssuesPage(1)
      setCeebPage(1)
      setMissingPage(1)
      setTermPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.')
      setFileName('')
      setHeaders([])
      setRows([])
      setColumns(null)
      setRemovedCmu([])
    } finally {
      setLoading(false)
    }
  }

  async function runCeebStep() {
    if (!columns || ceebRan.current) return
    setCeebBusy(true)
    setCeebProgress({ done: 0, total: 0 })
    try {
      const result = await applyProspectCeebCodes(rows, columns, {
        useOnlineSearch: true,
        onProgress: (done, total) => setCeebProgress({ done, total }),
      })
      setRows(result.rows)
      setCeebChanges(result.changes)
      setCeebMissing(result.stillMissing)
      ceebRan.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CEEB lookup failed.')
    } finally {
      setCeebBusy(false)
    }
  }

  async function handleContinue() {
    if (step === 'upload') {
      if (!fileName || rows.length === 0) {
        setError('Upload a Transfer Prospects CSV before continuing.')
        return
      }
      setError('')
      setStep('format')
      return
    }

    if (step === 'format') {
      setStep('ceeb')
      void runCeebStep()
      return
    }

    if (step === 'ceeb') {
      if (ceebBusy) return
      setStep('transfer-term')
      return
    }

    if (step === 'transfer-term') {
      setStep('export')
    }
  }

  function handleBack() {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev.id)
  }

  function handleReset() {
    setStep('upload')
    setFileName('')
    setHeaders([])
    setRows([])
    setColumns(null)
    setRemovedCmu([])
    setFormatChanges([])
    setAddressIssues([])
    setCeebChanges([])
    setCeebMissing([])
    setTermChanges([])
    setAppliedTerm(NEXT_FALL)
    setError('')
    ceebRan.current = false
  }

  function handleExport() {
    downloadTextFile(rowsToCsv(headers, rows), exportFileName, 'text/csv;charset=utf-8')
  }

  return (
    <div className="app-shell">
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        storageKey={PROSPECTS_WELCOME_KEY}
        title="Appily Transfer Prospects"
        lead="Prepare Cappex transfer prospect files for Slate in a few guided steps."
        steps={[
          'Upload the monthly Cappex CSV from Slate SFTP (/incoming/appily/prospects).',
          'Remove students currently at Central Michigan University.',
          'Clean names, addresses, emails, and pad ZIP codes.',
          'Add ceeb_code after current_college_name and fill CEEB codes.',
          `Fix expected_transfer_term when blank or past → ${NEXT_FALL}.`,
          'Export and upload manually in Slate.',
        ]}
        note="Source format: Appily - Transfer Prospects (Cappex). Delivered monthly."
      />

      <header className="app-header">
        <div className="app-header-top">
          <div>
            <Link to="/" className="back-home">
              ← All categories
            </Link>
            <div className="brand-pill">CMU · Slate Import</div>
          </div>
          <button
            type="button"
            className="btn-help"
            onClick={() => setWelcomeOpen(true)}
            aria-label="How this app works"
          >
            How it works
          </button>
        </div>
        <h1>Appily Transfer Prospects</h1>
        <p>
          Prepare Cappex transfer prospect files — remove CMU students, clean formatting,
          add CEEB codes, and fix past/blank transfer terms.
        </p>
      </header>

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload Transfer Prospects file</h2>
              <p>
                Source: Slate SFTP <code>/incoming/appily/prospects</code> (monthly). Format:{' '}
                <strong>Appily - Transfer Prospects (Cappex)</strong>.
              </p>
            </div>

            {fileName ? (
              <div className={`upload-result${loading ? ' upload-result-busy' : ''}`}>
                {loading && <Loader message="Reading file…" variant="overlay" size="sm" />}
                <div
                  className="upload-card"
                  onClick={() => {
                    if (!loading) fileInputRef.current?.click()
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <div className="upload-card-top">
                    <span className="upload-file-check" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M16.5 5.5L8 14L3.5 9.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <p className="upload-file-name" title={fileName}>
                      {fileName}
                    </p>
                    <span className="upload-file-action">Replace</span>
                  </div>
                  <p className="upload-card-meta">
                    <span className="upload-meta-tag upload-meta-campus main">
                      {rows.length.toLocaleString()} kept
                    </span>
                    {removedCmu.length > 0 && (
                      <span className="upload-meta-tag">{removedCmu.length} CMU removed</span>
                    )}
                    <span className="upload-meta-tag">{headers.length} columns</span>
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`upload-zone${dragActive ? ' upload-zone-drag' : ''}${loading ? ' upload-result-busy' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  dragCounter.current += 1
                  setDragActive(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  dragCounter.current -= 1
                  if (dragCounter.current <= 0) {
                    dragCounter.current = 0
                    setDragActive(false)
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  dragCounter.current = 0
                  setDragActive(false)
                  const dropped = event.dataTransfer.files?.[0]
                  if (dropped) void handleUpload(dropped)
                }}
              >
                {loading && <Loader message="Reading file…" variant="overlay" size="sm" />}
                <svg className="upload-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <path
                    d="M20 28V12M20 12L14 18M20 12L26 18M10 28H30"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="upload-title">Drop Transfer Prospects CSV here, or click to browse</p>
                <p className="upload-hint">Appily – Transfer Prospects (Cappex) · .csv only</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleUpload(file)
                event.target.value = ''
              }}
            />
          </>
        )}

        {step === 'format' && columns && (
          <>
            <div className="card-header">
              <h2>Format scan</h2>
              <p>
                CMU students were removed. Names, addresses, emails, and ZIP leading zeros were
                cleaned automatically.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students kept" />
              <StatCard
                value={removedCmu.length}
                label="CMU rows removed"
                highlight={removedCmu.length ? 'flagged' : 'none'}
              />
              <StatCard
                value={formatChanges.length}
                label="Format fixes"
                highlight={formatChanges.length ? 'resolved' : 'none'}
              />
              <StatCard
                value={addressIssues.length}
                label="Addresses to review"
                highlight={addressIssues.length ? 'flagged' : 'none'}
              />
            </div>

            {formatChanges.length > 0 ? (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">Changes made</h3>
                  <ChangeLegend />
                </div>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-field">Field</th>
                        <th className="col-change">Change</th>
                        <th className="col-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formatGroups.map(({ change, groupIndex }) => (
                        <tr
                          key={`${change.rowIndex}-${change.field}-${change.before}`}
                          className={groupIndex % 2 ? 'row-group-alt' : ''}
                        >
                          <td className="col-id">{change.rowId}</td>
                          <td className="col-name">{change.name || '—'}</td>
                          <td className="col-field">
                            <span className="field-tag">{change.field}</span>
                          </td>
                          <td className="col-change">
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                          <td className="col-action">{change.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={formatPage}
                  total={formatChanges.length}
                  onPageChange={setFormatPage}
                  noun="changes"
                />
              </div>
            ) : (
              <p className="empty-state">No name, address, or email formatting issues found.</p>
            )}

            {addressIssues.length > 0 && (
              <div className="section-block">
                <h3 className="section-title">Addresses still needing review</h3>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-change">Address</th>
                        <th className="col-action">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedIssues.map((issue) => (
                        <tr key={issue.rowIndex}>
                          <td className="col-id">{issue.rowId}</td>
                          <td className="col-name">{issue.name || '—'}</td>
                          <td className="col-change">
                            {getAddressPreview(rows[issue.rowIndex], columns)}
                          </td>
                          <td className="col-action">{issue.issues.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={issuesPage}
                  total={addressIssues.length}
                  onPageChange={setIssuesPage}
                  noun="issues"
                />
              </div>
            )}
          </>
        )}

        {step === 'ceeb' && columns && (
          <>
            <div className="card-header">
              <h2>CEEB codes</h2>
              <p>
                A <code>ceeb_code</code> column was added after <code>current_college_name</code>.
                Codes are filled from the bundled reference, then College Board online.
              </p>
            </div>

            {ceebBusy && (
              <div className="section-block">
                <Loader message="Looking up CEEB codes…" variant="banner" />
                {ceebProgress.total > 0 && (
                  <ProgressBar
                    value={ceebProgress.done}
                    max={ceebProgress.total}
                    label="Online CEEB search"
                  />
                )}
              </div>
            )}

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students" />
              <StatCard
                value={ceebChanges.length}
                label="CEEB filled"
                highlight={ceebChanges.length ? 'resolved' : 'none'}
              />
              <StatCard
                value={ceebMissing.length}
                label="Still missing"
                highlight={ceebMissing.length ? 'flagged' : 'none'}
              />
            </div>

            {ceebChanges.length > 0 && (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">CEEB updates</h3>
                  <ChangeLegend />
                </div>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-change">College</th>
                        <th className="col-field">CEEB</th>
                        <th className="col-action">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCeeb.map((change) => (
                        <tr key={`${change.rowIndex}-${change.after}`}>
                          <td className="col-id">{change.rowId}</td>
                          <td className="col-name">{change.name || '—'}</td>
                          <td className="col-change">{change.college || '—'}</td>
                          <td className="col-field">
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                          <td className="col-action">
                            <SourceBadge source={change.source === 'lookup' ? 'lookup' : change.source === 'online' ? 'online' : change.source === 'supplement' ? 'supplement' : 'padding'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={ceebPage}
                  total={ceebChanges.length}
                  onPageChange={setCeebPage}
                  noun="updates"
                />
              </div>
            )}

            {ceebMissing.length > 0 && (
              <div className="section-block">
                <h3 className="section-title">Still missing CEEB</h3>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-change">College</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMissing.map((item) => (
                        <tr key={item.rowIndex}>
                          <td className="col-id">{item.rowId}</td>
                          <td className="col-name">{item.name || '—'}</td>
                          <td className="col-change">{item.college}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={missingPage}
                  total={ceebMissing.length}
                  onPageChange={setMissingPage}
                  noun="colleges"
                />
              </div>
            )}

            {!ceebBusy && ceebChanges.length === 0 && ceebMissing.length === 0 && (
              <p className="empty-state">
                No colleges needed CEEB lookup (empty college names), or lookup has not finished.
              </p>
            )}
          </>
        )}

        {step === 'transfer-term' && columns && (
          <>
            <div className="card-header">
              <h2>Expected transfer term</h2>
              <p>
                Blank or past values in <code>expected_transfer_term</code> are set to the next
                Fall: <strong>{appliedTerm}</strong>. Future terms are left unchanged.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students" />
              <StatCard value={appliedTerm} label="Fallback term" highlight="resolved" />
              <StatCard
                value={termChanges.length}
                label="Terms updated"
                highlight={termChanges.length ? 'resolved' : 'none'}
              />
            </div>

            {termChanges.length > 0 ? (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">Term updates</h3>
                  <ChangeLegend />
                </div>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-change">Change</th>
                        <th className="col-action">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termGroups.map(({ change, groupIndex }) => (
                        <tr
                          key={`${change.rowIndex}-${change.before}`}
                          className={groupIndex % 2 ? 'row-group-alt' : ''}
                        >
                          <td className="col-id">{change.rowId}</td>
                          <td className="col-name">{change.name || '—'}</td>
                          <td className="col-change">
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                          <td className="col-action">{change.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={termPage}
                  total={termChanges.length}
                  onPageChange={setTermPage}
                  noun="updates"
                />
              </div>
            ) : (
              <p className="empty-state">
                No blank or past transfer terms needed updating.
              </p>
            )}
          </>
        )}

        {step === 'export' && (
          <>
            <div className="card-header">
              <h2>Export for Slate</h2>
              <p>
                Download the prepared CSV and upload it manually in Slate using{' '}
                <strong>Appily - Transfer Prospects (Cappex)</strong>.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students ready" highlight="resolved" />
              <StatCard value={removedCmu.length} label="CMU removed" />
              <StatCard value={ceebChanges.length} label="CEEB filled" highlight="resolved" />
              <StatCard value={termChanges.length} label="Terms fixed" highlight="resolved" />
            </div>

            <div className="export-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={handleExport}>
                Download prepared CSV
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleReset}>
                Start over
              </button>
            </div>
          </>
        )}

        {error && <p className="alert alert-error">{error}</p>}

        {step !== 'export' && (
          <div className="card-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleBack}
              disabled={stepIndex === 0 || loading || ceebBusy}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleContinue()}
              disabled={loading || ceebBusy || (step === 'upload' && !fileName)}
            >
              {ceebBusy ? 'Looking up CEEB…' : 'Continue'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
