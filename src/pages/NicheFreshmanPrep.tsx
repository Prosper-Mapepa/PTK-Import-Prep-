import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  WelcomeModal,
  isWelcomeDismissed,
} from '../appily/components/WelcomeModal'
import { cleanAddresses, findAddressIssues, getAddressPreview } from '../appily/lib/addressClean'
import { cleanEmails } from '../appily/lib/emailClean'
import { downloadTextFile, parseImportFile, rowsToCsv } from '../appily/lib/fileUtils'
import { cleanNames } from '../appily/lib/nameClean'
import { buildChangeGroups, paginateItems } from '../appily/lib/pagination'
import type { AddressIssue, FieldChange } from '../appily/types'
import { BeforeAfter, ChangeLegend } from '../components/BeforeAfter'
import { Loader, ProgressBar } from '../components/Loader'
import { SourceBadge } from '../components/SourceBadge'
import { StatCard } from '../components/StatCard'
import { StepProgress } from '../components/StepProgress'
import { TablePagination } from '../components/TablePagination'
import {
  resolveNicheColumns,
  toAppilyColumnMap,
  validateNicheFreshmanHeaders,
} from '../niche/lib/columns'
import {
  applyNicheHighSchoolCeeb,
  padExistingNicheCeebAndZip,
  type NicheCeebChange,
  type NicheCeebMissing,
} from '../niche/lib/nicheCeeb'
import { splitNicheByProspectiveType } from '../niche/lib/nichePrep'
import type { NicheColumnMap, NicheFieldChange, NicheRow } from '../niche/types'

const NICHE_FRESHMAN_WELCOME_KEY = 'niche-freshman-welcome-dismissed'

type StepId = 'upload' | 'split' | 'format' | 'ceeb' | 'export'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'split', label: 'Split transfers' },
  { id: 'format', label: 'Format scan' },
  { id: 'ceeb', label: 'CEEB codes' },
  { id: 'export', label: 'Export' },
]

const FILE_RE = /\.csv$/i

function toFieldChanges(changes: FieldChange[]): NicheFieldChange[] {
  return changes.map((change) => ({
    rowIndex: change.rowIndex,
    rowId: change.rowId,
    name: change.name,
    field: change.field,
    before: change.before,
    after: change.after,
    action: change.action || 'Cleaned',
  }))
}

export default function NicheFreshmanPrep() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [freshmanRows, setFreshmanRows] = useState<NicheRow[]>([])
  const [transferRows, setTransferRows] = useState<NicheRow[]>([])
  const [columns, setColumns] = useState<NicheColumnMap | null>(null)
  const [formatChanges, setFormatChanges] = useState<NicheFieldChange[]>([])
  const [addressIssues, setAddressIssues] = useState<AddressIssue[]>([])
  const [ceebChanges, setCeebChanges] = useState<NicheCeebChange[]>([])
  const [ceebMissing, setCeebMissing] = useState<NicheCeebMissing[]>([])
  const [formatPage, setFormatPage] = useState(1)
  const [issuesPage, setIssuesPage] = useState(1)
  const [ceebPage, setCeebPage] = useState(1)
  const [missingPage, setMissingPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ceebBusy, setCeebBusy] = useState(false)
  const [ceebProgress, setCeebProgress] = useState({ done: 0, total: 0 })
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => !isWelcomeDismissed(NICHE_FRESHMAN_WELCOME_KEY),
  )
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const ceebRan = useRef(false)

  const stepIndex = STEPS.findIndex((item) => item.id === step)
  const appilyColumns = columns ? toAppilyColumnMap(columns) : null

  const freshmanExportName = useMemo(() => {
    if (!fileName) return 'niche-freshman-prepared.csv'
    return fileName.replace(/\.csv$/i, '') + '_freshman_prepared.csv'
  }, [fileName])

  const transferExportName = useMemo(() => {
    if (!fileName) return 'niche-transfer-split.csv'
    return fileName.replace(/\.csv$/i, '') + '_transfer_split.csv'
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

  async function handleUpload(file: File) {
    if (!FILE_RE.test(file.name)) {
      setError('Please upload a Niche inquiries CSV file (.csv).')
      return
    }

    setLoading(true)
    setError('')
    ceebRan.current = false

    try {
      const parsed = await parseImportFile(file)
      const mapped = resolveNicheColumns(parsed.headers)
      validateNicheFreshmanHeaders(mapped)

      const split = splitNicheByProspectiveType(parsed.rows, mapped)
      const appilyMap = toAppilyColumnMap(mapped)

      const named = cleanNames(split.freshmen, appilyMap)
      const emailed = cleanEmails(named.rows, appilyMap)
      const addressed = cleanAddresses(emailed.rows, appilyMap)
      const padded = padExistingNicheCeebAndZip(addressed.rows, mapped)
      const issues = findAddressIssues(padded.rows, appilyMap)

      // Light-clean transfers for the split file too
      const tNamed = cleanNames(split.transfers, appilyMap)
      const tEmailed = cleanEmails(tNamed.rows, appilyMap)
      const tAddressed = cleanAddresses(tEmailed.rows, appilyMap)
      const tPadded = padExistingNicheCeebAndZip(tAddressed.rows, mapped)

      setFileName(file.name)
      setHeaders(parsed.headers)
      setColumns(mapped)
      setFreshmanRows(padded.rows)
      setTransferRows(tPadded.rows)
      setFormatChanges([
        ...toFieldChanges(named.changes),
        ...toFieldChanges(emailed.changes),
        ...toFieldChanges(addressed.changes),
        ...padded.changes,
      ])
      setAddressIssues(issues)
      setCeebChanges([])
      setCeebMissing([])
      setFormatPage(1)
      setIssuesPage(1)
      setCeebPage(1)
      setMissingPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.')
      setFileName('')
      setHeaders([])
      setFreshmanRows([])
      setTransferRows([])
      setColumns(null)
    } finally {
      setLoading(false)
    }
  }

  async function runCeebStep() {
    if (!columns || ceebRan.current) return
    setCeebBusy(true)
    setCeebProgress({ done: 0, total: 0 })
    try {
      const result = await applyNicheHighSchoolCeeb(freshmanRows, columns, {
        useOnlineSearch: true,
        onProgress: (done, total) => setCeebProgress({ done, total }),
      })
      setFreshmanRows(result.rows)
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
      if (!fileName || freshmanRows.length === 0) {
        setError('Upload a Niche inquiries CSV before continuing.')
        return
      }
      setError('')
      setStep('split')
      return
    }
    if (step === 'split') {
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
    setFreshmanRows([])
    setTransferRows([])
    setColumns(null)
    setFormatChanges([])
    setAddressIssues([])
    setCeebChanges([])
    setCeebMissing([])
    setError('')
    ceebRan.current = false
  }

  function exportFreshman() {
    downloadTextFile(
      rowsToCsv(headers, freshmanRows),
      freshmanExportName,
      'text/csv;charset=utf-8',
    )
  }

  function exportTransfers() {
    downloadTextFile(
      rowsToCsv(headers, transferRows),
      transferExportName,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="app-shell">
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        storageKey={NICHE_FRESHMAN_WELCOME_KEY}
        title="Niche Freshman Inquiries"
        lead="Prepare weekly Niche freshman inquiry files for Slate in a few guided steps."
        steps={[
          'Download the latest file from SFTP incoming/niche (Central_Michigan_University_inquiries_YYYY_MM_DD.csv).',
          'Remove Transfer Students (ProspectiveType) into a separate file for Niche Transfer.',
          'Clean names, addresses, and emails; pad ZIP and CEEB leading zeros.',
          'Fill missing HighSchoolCEEB codes (reference file, then College Board).',
          'Export freshman CSV, upload in Slate, then Remap → Value Mappings (Retroactive Refresh if needed).',
        ]}
        note="Upload is manual/weekly. Transfer rows are exported separately for the Niche Transfer Inquiries source."
      />

      <header className="app-header">
        <div className="app-header-top">
          <div>
            <Link to="/" className="back-home">
              ← All categories
            </Link>
            <div className="brand-pill">CMU · Slate Import</div>
          </div>
          <button type="button" className="btn-help" onClick={() => setWelcomeOpen(true)}>
            How it works
          </button>
        </div>
        <h1>Niche Freshman Inquiries</h1>
        <p>
          Prepare Niche freshman inquiry files — split out transfers, clean formatting, pad ZIP/CEEB
          zeros, and fill missing high school CEEB codes.
        </p>
      </header>

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload Niche inquiries file</h2>
              <p>
                SFTP: <code>incoming/niche</code> · File pattern:{' '}
                <code>Central_Michigan_University_inquiries_YYYY_MM_DD.csv</code>
              </p>
            </div>

            {fileName ? (
              <div className={`upload-result${loading ? ' upload-result-busy' : ''}`}>
                {loading && <Loader message="Reading file…" variant="overlay" size="sm" />}
                <div
                  className="upload-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => !loading && fileInputRef.current?.click()}
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
                      {freshmanRows.length} freshmen
                    </span>
                    <span className="upload-meta-tag">{transferRows.length} transfers</span>
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`upload-zone${dragActive ? ' upload-zone-drag' : ''}${loading ? ' upload-result-busy' : ''}`}
                role="button"
                tabIndex={0}
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
                <p className="upload-title">Drop Niche inquiries CSV here, or click to browse</p>
                <p className="upload-hint">Niche Freshman Inquiries · .csv only</p>
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

        {step === 'split' && (
          <>
            <div className="card-header">
              <h2>Split transfer students</h2>
              <p>
                Rows with <code>ProspectiveType</code> = Transfer Student are moved to a separate
                file for the <strong>Niche Transfer Inquiries</strong> source format.
              </p>
            </div>
            <div className="stats-grid">
              <StatCard value={freshmanRows.length} label="Freshmen kept" highlight="resolved" />
              <StatCard
                value={transferRows.length}
                label="Transfers split out"
                highlight={transferRows.length ? 'flagged' : 'none'}
              />
            </div>
            {transferRows.length === 0 ? (
              <p className="empty-state">No transfer students found in this file.</p>
            ) : (
              <p className="empty-state">
                You can download the transfer split file on the Export step.
              </p>
            )}
          </>
        )}

        {step === 'format' && columns && appilyColumns && (
          <>
            <div className="card-header">
              <h2>Format scan</h2>
              <p>
                Names, addresses, emails, ZIP leading zeros, and existing CEEB padding were cleaned
                for freshman rows.
              </p>
            </div>
            <div className="stats-grid">
              <StatCard value={freshmanRows.length} label="Freshmen" />
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
              <p className="empty-state">No formatting issues found.</p>
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
                            {getAddressPreview(freshmanRows[issue.rowIndex], appilyColumns)}
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
              <h2>High school CEEB codes</h2>
              <p>
                Missing <code>HighSchoolCEEB</code> values are filled from the bundled reference,
                then College Board online. Leading zeros are padded to 6 digits.
              </p>
            </div>

            {ceebBusy && (
              <div className="section-block">
                <Loader message="Looking up high school CEEB codes…" variant="banner" />
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
              <StatCard value={freshmanRows.length} label="Freshmen" />
              <StatCard
                value={ceebChanges.length}
                label="CEEB updates"
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
                        <th className="col-change">High school</th>
                        <th className="col-field">CEEB</th>
                        <th className="col-action">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCeeb.map((change) => (
                        <tr key={`${change.rowIndex}-${change.after}`}>
                          <td className="col-id">{change.rowId}</td>
                          <td className="col-name">{change.name || '—'}</td>
                          <td className="col-change">{change.school || '—'}</td>
                          <td className="col-field">
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                          <td className="col-action">
                            <SourceBadge source={change.source} />
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
                        <th className="col-change">High school</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMissing.map((item) => (
                        <tr key={item.rowIndex}>
                          <td className="col-id">{item.rowId}</td>
                          <td className="col-name">{item.name || '—'}</td>
                          <td className="col-change">{item.school}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={missingPage}
                  total={ceebMissing.length}
                  onPageChange={setMissingPage}
                  noun="schools"
                />
              </div>
            )}
          </>
        )}

        {step === 'export' && (
          <>
            <div className="card-header">
              <h2>Export for Slate</h2>
              <p>
                Upload the freshman file manually/weekly. After upload: <strong>Remap → Value
                Mappings</strong>, refresh, and run a <strong>Retroactive Refresh</strong> if needed.
                Use the transfer split with the Niche Transfer Inquiries source.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard
                value={freshmanRows.length}
                label="Freshmen ready"
                highlight="resolved"
              />
              <StatCard value={transferRows.length} label="Transfers split" />
              <StatCard value={ceebChanges.length} label="CEEB updates" highlight="resolved" />
            </div>

            <div className="export-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={exportFreshman}>
                Download freshman CSV
              </button>
              {transferRows.length > 0 && (
                <button type="button" className="btn btn-secondary" onClick={exportTransfers}>
                  Download transfer split
                </button>
              )}
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
