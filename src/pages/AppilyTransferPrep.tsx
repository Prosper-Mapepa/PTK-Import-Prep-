import { useMemo, useRef, useState } from 'react'
import { BeforeAfter, ChangeLegend } from '../components/BeforeAfter'
import { Loader } from '../components/Loader'
import { StatCard } from '../components/StatCard'
import { StepProgress } from '../components/StepProgress'
import { TablePagination } from '../components/TablePagination'
import {
  WelcomeModal,
  TRANSFER_WELCOME_KEY,
  isWelcomeDismissed,
} from '../appily/components/WelcomeModal'
import { cleanAddresses, findAddressIssues, getAddressPreview } from '../appily/lib/addressClean'
import {
  resolveColumns,
  resolveTransferTermColumn,
  validateAppilyTransferHeaders,
} from '../appily/lib/columns'
import { cleanEmails } from '../appily/lib/emailClean'
import { downloadTextFile, parseImportFile, rowsToCsv } from '../appily/lib/fileUtils'
import { cleanNames } from '../appily/lib/nameClean'
import { buildChangeGroups, paginateItems } from '../appily/lib/pagination'
import {
  applyExpectedTransferTerms,
  getNextUpcomingFallTerm,
} from '../appily/lib/startTerm'
import type { AddressIssue, AppilyRow, ColumnMap, FieldChange } from '../appily/types'
import { ToolHeader } from '../components/ToolHeader'

type StepId = 'upload' | 'format' | 'transfer-term' | 'export'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'format', label: 'Format scan' },
  { id: 'transfer-term', label: 'Transfer term' },
  { id: 'export', label: 'Export' },
]

const FILE_RE = /\.csv$/i
const NEXT_FALL = getNextUpcomingFallTerm()

function isTransferFile(file: File) {
  return FILE_RE.test(file.name)
}

export default function AppilyTransferPrep() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<AppilyRow[]>([])
  const [columns, setColumns] = useState<ColumnMap | null>(null)
  const [formatChanges, setFormatChanges] = useState<FieldChange[]>([])
  const [addressIssues, setAddressIssues] = useState<AddressIssue[]>([])
  const [termChanges, setTermChanges] = useState<FieldChange[]>([])
  const [appliedTerm, setAppliedTerm] = useState(NEXT_FALL)
  const [formatPage, setFormatPage] = useState(1)
  const [issuesPage, setIssuesPage] = useState(1)
  const [termPage, setTermPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(() => !isWelcomeDismissed(TRANSFER_WELCOME_KEY))
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const stepIndex = STEPS.findIndex((item) => item.id === step)

  const exportFileName = useMemo(() => {
    if (!fileName) return 'appily-transfer-prepared.csv'
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
    if (!isTransferFile(file)) {
      setError('Please upload a Cappex transfer CSV file (.csv).')
      return
    }

    setLoading(true)
    setError('')

    try {
      const parsed = await parseImportFile(file)
      let mapped = resolveColumns(parsed.headers)
      mapped = resolveTransferTermColumn(parsed.headers, mapped)
      validateAppilyTransferHeaders(mapped)

      const named = cleanNames(parsed.rows, mapped)
      const emailed = cleanEmails(named.rows, mapped)
      const addressed = cleanAddresses(emailed.rows, mapped)
      const termed = applyExpectedTransferTerms(addressed.rows, mapped, NEXT_FALL)
      const issues = findAddressIssues(termed.rows, mapped)

      const allChanges = [...named.changes, ...emailed.changes, ...addressed.changes]

      setFileName(file.name)
      setHeaders(parsed.headers)
      setColumns(mapped)
      setRows(termed.rows)
      setFormatChanges(allChanges)
      setAddressIssues(issues)
      setTermChanges(termed.changes)
      setAppliedTerm(termed.term)
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
        setError('Upload a Cappex transfer CSV before continuing.')
        return
      }
      setError('')
      setStep('format')
      return
    }

    if (step === 'format') {
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
    setFormatChanges([])
    setAddressIssues([])
    setTermChanges([])
    setAppliedTerm(NEXT_FALL)
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
        storageKey={TRANSFER_WELCOME_KEY}
        title="Appily Transfer Inquiries"
        lead="Prepare Cappex transfer inquiry files for Slate in a few guided steps."
        steps={[
          'Upload the weekly Cappex CSV from Slate SFTP (/incoming/appily/inquiries).',
          'Review cleaned names, addresses, and emails.',
          `Fill expected_transfer_term (column O) with the next upcoming Fall (${NEXT_FALL}).`,
          'Export the CSV, upload in Slate, then Remap → Prompt Value Mappings.',
        ]}
        note="Contract note: files paused after Nov 2025; deliveries resume July 2026. Upload manually/weekly."
      />

      <ToolHeader
        title="Appily Transfer Inquiries"
        description="Prepare Cappex transfer inquiry files for Slate — clean names, addresses, and emails, then fill <code>expected_transfer_term</code> with the next Fall."
        onHelp={() => setWelcomeOpen(true)}
      />

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload Cappex transfer file</h2>
              <p>
                Source: Slate SFTP <code>/incoming/appily/inquiries</code> (weekly). Format:{' '}
                <strong>Appily - Transfer Inquiries (Cappex)</strong>.
              </p>
            </div>

            <p className="alert alert-muted">
              Contract note: maximum reached Nov 2025 — no new files until July 2026.
            </p>

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
                    <span className="upload-meta-tag">{appliedTerm}</span>
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
                aria-label="Upload Cappex transfer CSV"
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
                <p className="upload-title">Drop Cappex transfer CSV here, or click to browse</p>
                <p className="upload-hint">Appily – Transfer Inquiries (Cappex) · .csv only</p>
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

        {step === 'transfer-term' && columns && (
          <>
            <div className="card-header">
              <h2>Expected transfer term</h2>
              <p>
                The entire <code>expected_transfer_term</code> column (column O) is filled with
                the next upcoming Fall: <strong>{appliedTerm}</strong>.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students" />
              <StatCard value={appliedTerm} label="Applied term" highlight="resolved" />
              <StatCard
                value={termChanges.length}
                label="Rows updated"
                highlight={termChanges.length ? 'resolved' : 'none'}
              />
            </div>

            {termChanges.length > 0 ? (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">Transfer term updates</h3>
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
                Every row already had <strong>{appliedTerm}</strong> in{' '}
                <code>expected_transfer_term</code>.
              </p>
            )}
          </>
        )}

        {step === 'export' && (
          <>
            <div className="card-header">
              <h2>Export for Slate</h2>
              <p>
                Download the prepared CSV, upload it manually in Slate (weekly), then click{' '}
                <strong>Remap → Prompt Value Mappings</strong> and refresh for new mappings.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length} label="Students ready" highlight="resolved" />
              <StatCard
                value={formatChanges.length}
                label="Format fixes"
                highlight={formatChanges.length ? 'resolved' : 'none'}
              />
              <StatCard value={appliedTerm} label="Transfer term" highlight="resolved" />
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
