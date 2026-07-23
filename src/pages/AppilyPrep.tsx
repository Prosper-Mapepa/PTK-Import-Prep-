import { useMemo, useRef, useState } from 'react'
import { BeforeAfter, ChangeLegend } from '../components/BeforeAfter'
import { Loader } from '../components/Loader'
import { StatCard } from '../components/StatCard'
import { StepProgress } from '../components/StepProgress'
import { TablePagination } from '../components/TablePagination'
import { WelcomeModal, FRESHMAN_WELCOME_KEY, isWelcomeDismissed } from '../appily/components/WelcomeModal'
import { cleanAddresses, findAddressIssues, getAddressPreview } from '../appily/lib/addressClean'
import { resolveColumns, validateAppilyFreshmanHeaders } from '../appily/lib/columns'
import { cleanEmails } from '../appily/lib/emailClean'
import {
  downloadTextFile,
  isCappexFileName,
  parseImportFile,
  rowsToCsv,
} from '../appily/lib/fileUtils'
import { cleanNames } from '../appily/lib/nameClean'
import { buildChangeGroups, paginateItems } from '../appily/lib/pagination'
import { applyPredictedStartTerms } from '../appily/lib/startTerm'
import type { AddressIssue, AppilyRow, ColumnMap, FieldChange } from '../appily/types'
import { ToolHeader } from '../components/ToolHeader'

type StepId = 'upload' | 'format' | 'start-term' | 'export'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'format', label: 'Format scan' },
  { id: 'start-term', label: 'Start term' },
  { id: 'export', label: 'Export' },
]

const FILE_RE = /\.csv$/i

function isAppilyFile(file: File) {
  return FILE_RE.test(file.name)
}

export default function App() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<AppilyRow[]>([])
  const [columns, setColumns] = useState<ColumnMap | null>(null)
  const [formatChanges, setFormatChanges] = useState<FieldChange[]>([])
  const [addressIssues, setAddressIssues] = useState<AddressIssue[]>([])
  const [termChanges, setTermChanges] = useState<FieldChange[]>([])
  const [formatPage, setFormatPage] = useState(1)
  const [issuesPage, setIssuesPage] = useState(1)
  const [termPage, setTermPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !isWelcomeDismissed(FRESHMAN_WELCOME_KEY))
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const stepIndex = STEPS.findIndex((item) => item.id === step)

  const exportFileName = useMemo(() => {
    if (!fileName) return 'appily-prepared.csv'
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
  const termGroups = useMemo(
    () => buildChangeGroups(termChanges, termPage),
    [termChanges, termPage],
  )

  async function handleUpload(file: File) {
    if (!isAppilyFile(file)) {
      setError('Please upload a Cappex CSV file (.csv).')
      return
    }

    setLoading(true)
    setError('')

    try {
      const parsed = await parseImportFile(file)
      const mapped = resolveColumns(parsed.headers)
      validateAppilyFreshmanHeaders(mapped)

      if (!isCappexFileName(file.name)) {
        // Soft warning only — still allow upload
        console.warn('File name does not match the usual Cappex pattern.')
      }

      const named = cleanNames(parsed.rows, mapped)
      const emailed = cleanEmails(named.rows, mapped)
      const addressed = cleanAddresses(emailed.rows, mapped)
      const termed = applyPredictedStartTerms(addressed.rows, mapped)
      const issues = findAddressIssues(termed.rows, mapped)

      const allChanges = [...named.changes, ...emailed.changes, ...addressed.changes]

      setFileName(file.name)
      setHeaders(parsed.headers)
      setColumns(mapped)
      setRows(termed.rows)
      setFormatChanges(allChanges)
      setAddressIssues(issues)
      setTermChanges(termed.changes)
      setFormatPage(1)
      setIssuesPage(1)
      setTermPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.')
      setFileName('')
      setHeaders([])
      setRows([])
      setColumns(null)
    } finally {
      setLoading(false)
    }
  }

  function handleContinue() {
    if (step === 'upload') {
      if (!fileName || rows.length === 0) {
        setError('Upload a Cappex CSV before continuing.')
        return
      }
      setError('')
      setStep('format')
      return
    }

    if (step === 'format') {
      setStep('start-term')
      return
    }

    if (step === 'start-term') {
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
    setFormatChanges([])
    setAddressIssues([])
    setTermChanges([])
    setFormatPage(1)
    setIssuesPage(1)
    setTermPage(1)
    setError('')
  }

  function handleExport() {
    const csv = rowsToCsv(headers, rows)
    downloadTextFile(csv, exportFileName, 'text/csv;charset=utf-8')
  }

  return (
    <div className="app-shell">
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        storageKey={FRESHMAN_WELCOME_KEY}
        title="Appily Freshman Inquiries"
        lead="Prepare Cappex freshmen inquiry files for Slate in a few guided steps."
        steps={[
          'Upload the Cappex CSV from Appily.',
          'Review cleaned names, addresses, and emails.',
          'Set predicted_start_term to Fall of each student’s HS grad date year (e.g. 6/1/2027 → Fall 2027).',
          'Export the CSV and upload it manually in Slate.',
        ]}
        note="Expected file name pattern: Central_Michigan_University_169248_YYYY_MM_DD_##_##_##_cappex.csv"
      />

      <ToolHeader
        title="Appily Freshman Inquiries"
        description="Prepare Cappex freshmen inquiry files for Slate — clean names, addresses, and emails, then set predicted start term from HS graduation year."
        onHelp={() => setWelcomeOpen(true)}
      />

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload Cappex file</h2>
              <p>
                Upload the Appily Freshmen Inquiries CSV. Expected name pattern:{' '}
                <code>Central_Michigan_University_169248_YYYY_MM_DD_##_##_##_cappex.csv</code>
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Replace uploaded file"
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
                      {rows.length.toLocaleString()} rows
                    </span>
                    <span className="upload-meta-tag">{headers.length} columns</span>
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`upload-zone${dragActive ? ' upload-zone-drag' : ''}${loading ? ' upload-result-busy' : ''}`}
                onClick={() => fileInputRef.current?.click()}
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
                  const file = event.dataTransfer.files?.[0]
                  if (file) void handleUpload(file)
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload Cappex CSV"
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
                <p className="upload-title">Drop Cappex CSV here, or click to browse</p>
                <p className="upload-hint">Appily – Freshmen Inquiries (Cappex) · .csv only</p>
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
                Improper formatting in names, addresses, and emails was cleaned automatically.
                Review changes below before continuing.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students" />
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

        {step === 'start-term' && columns && (
          <>
            <div className="card-header">
              <h2>Predicted start term</h2>
              <p>
                <code>predicted_start_term</code> is set to the next fall from each student&apos;s{' '}
                <code>high_school_grad_date</code> (e.g. <strong>6/1/2027 → Fall 2027</strong>).
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students" />
              <StatCard
                value={termChanges.length}
                label="Start terms updated"
                highlight={termChanges.length ? 'resolved' : 'none'}
              />
              <StatCard
                value={rows.length - termChanges.length}
                label="Already correct / skipped"
              />
            </div>

            {termChanges.length > 0 ? (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">Start term updates</h3>
                  <ChangeLegend />
                </div>
                <div className="table-wrap">
                  <table className="data-table changes-table">
                    <thead>
                      <tr>
                        <th className="col-id">ID</th>
                        <th className="col-name">Name</th>
                        <th className="col-change">Change</th>
                        <th className="col-action">Source</th>
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
                All predicted start terms already match Fall of the HS grad year, or no valid
                grad years were found.
              </p>
            )}
          </>
        )}

        {step === 'export' && (
          <>
            <div className="card-header">
              <h2>Export for Slate</h2>
              <p>
                Download the prepared Cappex CSV, then upload it manually in Slate using the
                Appily Freshmen Inquiries source format.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students ready" highlight="resolved" />
              <StatCard
                value={formatChanges.length}
                label="Format fixes"
                highlight={formatChanges.length ? 'resolved' : 'none'}
              />
              <StatCard
                value={termChanges.length}
                label="Start terms set"
                highlight={termChanges.length ? 'resolved' : 'none'}
              />
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
              disabled={stepIndex === 0 || loading}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleContinue}
              disabled={loading || (step === 'upload' && !fileName)}
            >
              Continue
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
