import { useMemo, useRef, useState } from 'react'
import { WelcomeModal, isWelcomeDismissed } from '../appily/components/WelcomeModal'
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
  validateNicheProspectsHeaders,
} from '../niche/lib/columns'
import {
  applyNicheHighSchoolCeeb,
  padExistingNicheCeebAndZip,
  type NicheCeebChange,
  type NicheCeebMissing,
} from '../niche/lib/nicheCeeb'
import { applyNicheProspectsAoi } from '../niche/lib/prospectsAoi'
import type { NicheColumnMap, NicheFieldChange, NicheRow } from '../niche/types'
import { ToolHeader } from '../components/ToolHeader'

const NICHE_PROSPECTS_WELCOME_KEY = 'niche-freshman-prospects-welcome-dismissed'

type StepId = 'upload' | 'format' | 'aoi' | 'ceeb' | 'export'

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'format', label: 'Format scan' },
  { id: 'aoi', label: 'CMU AOI' },
  { id: 'ceeb', label: 'CEEB codes' },
  { id: 'export', label: 'Export' },
]

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

export default function NicheFreshmanProspectsPrep() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<NicheRow[]>([])
  const [columns, setColumns] = useState<NicheColumnMap | null>(null)
  const [formatChanges, setFormatChanges] = useState<NicheFieldChange[]>([])
  const [addressIssues, setAddressIssues] = useState<AddressIssue[]>([])
  const [aoiChanges, setAoiChanges] = useState<NicheFieldChange[]>([])
  const [aoiMapped, setAoiMapped] = useState(0)
  const [aoiUnmapped, setAoiUnmapped] = useState(0)
  const [ceebChanges, setCeebChanges] = useState<NicheCeebChange[]>([])
  const [ceebMissing, setCeebMissing] = useState<NicheCeebMissing[]>([])
  const [formatPage, setFormatPage] = useState(1)
  const [issuesPage, setIssuesPage] = useState(1)
  const [aoiPage, setAoiPage] = useState(1)
  const [ceebPage, setCeebPage] = useState(1)
  const [missingPage, setMissingPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [aoiBusy, setAoiBusy] = useState(false)
  const [ceebBusy, setCeebBusy] = useState(false)
  const [ceebProgress, setCeebProgress] = useState({ done: 0, total: 0 })
  const [welcomeOpen, setWelcomeOpen] = useState(
    () => !isWelcomeDismissed(NICHE_PROSPECTS_WELCOME_KEY),
  )
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const aoiRan = useRef(false)
  const ceebRan = useRef(false)

  const stepIndex = STEPS.findIndex((item) => item.id === step)
  const appilyColumns = columns ? toAppilyColumnMap(columns) : null

  const exportName = useMemo(() => {
    if (!fileName) return 'niche-freshman-prospects-prepared.csv'
    return fileName.replace(/\.csv$/i, '') + '_prepared.csv'
  }, [fileName])

  const formatGroups = useMemo(
    () => buildChangeGroups(formatChanges, formatPage),
    [formatChanges, formatPage],
  )
  const pagedIssues = useMemo(
    () => paginateItems(addressIssues, issuesPage),
    [addressIssues, issuesPage],
  )
  const aoiGroups = useMemo(() => buildChangeGroups(aoiChanges, aoiPage), [aoiChanges, aoiPage])
  const pagedCeeb = useMemo(() => paginateItems(ceebChanges, ceebPage), [ceebChanges, ceebPage])
  const pagedMissing = useMemo(
    () => paginateItems(ceebMissing, missingPage),
    [ceebMissing, missingPage],
  )

  async function handleUpload(file: File) {
    if (!/\.csv$/i.test(file.name)) {
      setError('Please upload a Niche Freshman Prospects CSV file (.csv).')
      return
    }

    setLoading(true)
    setError('')
    aoiRan.current = false
    ceebRan.current = false

    try {
      const parsed = await parseImportFile(file)
      const mapped = resolveNicheColumns(parsed.headers)
      validateNicheProspectsHeaders(mapped)

      const appilyMap = toAppilyColumnMap(mapped)
      const named = cleanNames(parsed.rows, appilyMap)
      const emailed = cleanEmails(named.rows, appilyMap)
      const addressed = cleanAddresses(emailed.rows, appilyMap)
      const padded = padExistingNicheCeebAndZip(addressed.rows, mapped)
      const issues = findAddressIssues(padded.rows, appilyMap)

      setFileName(file.name)
      setHeaders(parsed.headers)
      setColumns(mapped)
      setRows(padded.rows)
      setFormatChanges([
        ...toFieldChanges(named.changes),
        ...toFieldChanges(emailed.changes),
        ...toFieldChanges(addressed.changes),
        ...padded.changes,
      ])
      setAddressIssues(issues)
      setAoiChanges([])
      setAoiMapped(0)
      setAoiUnmapped(0)
      setCeebChanges([])
      setCeebMissing([])
      setFormatPage(1)
      setIssuesPage(1)
      setAoiPage(1)
      setCeebPage(1)
      setMissingPage(1)
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

  async function runAoiStep() {
    if (!columns || aoiRan.current) return
    setAoiBusy(true)
    setError('')
    try {
      const result = await applyNicheProspectsAoi(headers, rows, columns)
      setHeaders(result.headers)
      setRows(result.rows)
      setColumns(result.columns)
      setAoiChanges(result.changes)
      setAoiMapped(result.mapped)
      setAoiUnmapped(result.unmapped)
      aoiRan.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AOI mapping failed.')
    } finally {
      setAoiBusy(false)
    }
  }

  async function runCeebStep() {
    if (!columns || ceebRan.current) return
    setCeebBusy(true)
    setCeebProgress({ done: 0, total: 0 })
    try {
      const result = await applyNicheHighSchoolCeeb(rows, columns, {
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
      if (!fileName) {
        setError('Upload a Niche Freshman Prospects CSV before continuing.')
        return
      }
      setError('')
      setStep('format')
      return
    }
    if (step === 'format') {
      setStep('aoi')
      void runAoiStep()
      return
    }
    if (step === 'aoi') {
      if (aoiBusy) return
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
    setRows([])
    setColumns(null)
    setFormatChanges([])
    setAddressIssues([])
    setAoiChanges([])
    setAoiMapped(0)
    setAoiUnmapped(0)
    setCeebChanges([])
    setCeebMissing([])
    setError('')
    aoiRan.current = false
    ceebRan.current = false
  }

  function handleExport() {
    downloadTextFile(rowsToCsv(headers, rows), exportName, 'text/csv;charset=utf-8')
  }

  const busy = loading || aoiBusy || ceebBusy

  return (
    <div className="app-shell">
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        storageKey={NICHE_PROSPECTS_WELCOME_KEY}
        title="Niche Freshman Prospects"
        lead="Prepare weekly Niche freshman prospect files for Slate in a few guided steps."
        steps={[
          'Download the latest file from SFTP incoming/Niche/Prospects (Prospects_Bulk or Prospects_Bulk_Cross_Interest / Cross_Interest).',
          'Clean names, addresses, and emails; pad ZIP and HighSchoolCEEB leading zeros.',
          'Add CMU AOI after MajorCIP using the 2025 MajorCIP → AOI crosswalk.',
          'Fill missing HighSchoolCEEB codes (CEEB reference first, then College Board).',
          'Export CSV, upload in Slate, then Remap → Value Mappings (Retroactive Refresh if needed).',
        ]}
        note="Upload is manual/weekly. Both Bulk and Cross Interest files share the same layout."
      />

      <ToolHeader
        title="Niche Freshman Prospects"
        description="Prepare Niche freshman prospect files — clean formatting, map CMU AOI from MajorCIP, and fill HighSchoolCEEB."
        onHelp={() => setWelcomeOpen(true)}
      />

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload Niche Prospects file</h2>
              <p>
                SFTP: <code>incoming/Niche/Prospects</code> · Wednesdays · Patterns:{' '}
                <code>…_Prospects_Bulk_YYYY_MM_DD.csv</code> or{' '}
                <code>…_Prospects_Bulk_Cross_Interest_YYYY_MM_DD.csv</code> (same layout)
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
                    <span className="upload-meta-tag upload-meta-campus main">{rows.length} rows</span>
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
                <p className="upload-title">Drop Niche Prospects CSV here, or click to browse</p>
                <p className="upload-hint">Niche Freshman Prospects · .csv only</p>
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

        {step === 'format' && columns && appilyColumns && (
          <>
            <div className="card-header">
              <h2>Format scan</h2>
              <p>
                Names, addresses, emails, ZIP zeros, and existing HighSchoolCEEB padding were
                cleaned. Spot-check anything still flagged below.
              </p>
            </div>
            <div className="stats-grid">
              <StatCard value={rows.length} label="Prospects" />
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
                            {getAddressPreview(rows[issue.rowIndex], appilyColumns)}
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

        {step === 'aoi' && columns && (
          <>
            <div className="card-header">
              <h2>CMU AOI</h2>
              <p>
                Inserts <code>CMU AOI</code> after <code>MajorCIP</code> using the 2025 MajorCIP →
                AOI crosswalk (same VLOOKUP as the ticket).
              </p>
            </div>

            {aoiBusy && (
              <div className="section-block">
                <Loader message="Mapping MajorCIP to CMU AOI…" variant="banner" />
              </div>
            )}

            <div className="stats-grid">
              <StatCard value={rows.length} label="Prospects" />
              <StatCard value={aoiMapped} label="AOI matched" highlight="resolved" />
              <StatCard
                value={aoiUnmapped}
                label="Unmapped CIP"
                highlight={aoiUnmapped ? 'flagged' : 'none'}
              />
              <StatCard
                value={aoiChanges.length}
                label="AOI filled"
                highlight={aoiChanges.length ? 'resolved' : 'none'}
              />
            </div>

            {aoiChanges.length > 0 ? (
              <div className="section-block">
                <div className="section-heading">
                  <h3 className="section-title">AOI updates</h3>
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
                        <th className="col-action">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aoiGroups.map(({ change, groupIndex }) => (
                        <tr
                          key={`${change.rowIndex}-${change.after}`}
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
                  page={aoiPage}
                  total={aoiChanges.length}
                  onPageChange={setAoiPage}
                  noun="updates"
                />
              </div>
            ) : (
              !aoiBusy && <p className="empty-state">No new AOI values were filled.</p>
            )}
          </>
        )}

        {step === 'ceeb' && columns && (
          <>
            <div className="card-header">
              <h2>High school CEEB codes</h2>
              <p>
                Missing <code>HighSchoolCEEB</code> values are filled from the bundled CEEB
                reference first, then College Board online. Leading zeros are padded to 6 digits.
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
              <StatCard value={rows.length} label="Prospects" />
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
                Upload manually/weekly. After upload: <strong>Remap → Value Mappings</strong>,
                refresh, and run a <strong>Retroactive Refresh</strong> if needed.
              </p>
            </div>
            <div className="stats-grid">
              <StatCard value={rows.length} label="Prospects ready" highlight="resolved" />
              <StatCard value={aoiMapped} label="AOI matched" highlight="resolved" />
              <StatCard value={ceebChanges.length} label="CEEB updates" highlight="resolved" />
              <StatCard
                value={ceebMissing.length}
                label="CEEB still missing"
                highlight={ceebMissing.length ? 'flagged' : 'none'}
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
              disabled={stepIndex === 0 || busy}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleContinue()}
              disabled={busy || (step === 'upload' && !fileName)}
            >
              {aoiBusy ? 'Mapping AOI…' : ceebBusy ? 'Looking up CEEB…' : 'Continue'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
