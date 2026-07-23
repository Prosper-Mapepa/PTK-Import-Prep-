import { useEffect, useMemo, useRef, useState } from 'react'
import { BeforeAfter, ChangeLegend } from '../components/BeforeAfter'
import { TablePagination } from '../components/TablePagination'
import { buildAddressChangeGroups, getPageCount, paginateItems } from '../lib/pagination'
import { Loader, ProgressBar, Spinner } from '../components/Loader'
import { SourceBadge } from '../components/SourceBadge'
import { StatCard } from '../components/StatCard'
import { StepProgress } from '../components/StepProgress'
import type { AddressCleanChange, CampusType, PrepSession } from '../types'
import {
  COLLEGE_CEEB_URL,
  COL_CURRENT_MAJOR_CODE,
  COL_EXPECTED_GRAD,
  COL_START_TERM,
  HIGH_SCHOOL_CEEB_URL,
} from '../types'
import { applyAoiColumn, buildAoiLookup, loadCrosswalk } from '../lib/aoiPrep'
import { findAddressIssues, getAddressPreview } from '../lib/addressCheck'
import { applySmartyStandardization, cleanAddresses } from '../lib/addressClean'
import { cleanEmails } from '../lib/emailClean'
import { cleanNames } from '../lib/nameClean'
import { applyCeebPrep, loadBundledCeebLookup, resetCeebCaches } from '../lib/ceebPrep'
import {
  validateAddressesBatch,
  type SmartyValidationResult,
} from '../lib/smartyValidation'
import { ToolHeader } from '../components/ToolHeader'
import {
  detectCampusType,
  downloadTextFile,
  extractStartTerm,
  insertColumnAfter,
  parseImportFile,
  rowsToCsv,
  validatePtkHeaders,
} from '../lib/fileUtils'

type StepId =
  | 'upload'
  | 'addresses'
  | 'ceeb'
  | 'aoi'
  | 'start-term'
  | 'export'

const MAIN_STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'ceeb', label: 'CEEB Codes' },
  { id: 'aoi', label: 'CMU AOI' },
  { id: 'start-term', label: 'Start Term' },
  { id: 'export', label: 'Export' },
]

const ONLINE_STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'ceeb', label: 'CEEB Codes' },
  { id: 'export', label: 'Export' },
]

function campusLabel(type: CampusType) {
  return type === 'main' ? 'Main Campus' : 'Global Campus (Online)'
}

const PTK_FILE_RE = /\.(csv|xlsx|xls)$/i

function isPtkFile(file: File) {
  return PTK_FILE_RE.test(file.name)
}

export default function App() {
  const [step, setStep] = useState<StepId>('upload')
  const [fileName, setFileName] = useState('')
  const [campusType, setCampusType] = useState<CampusType | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<PrepSession['rows']>([])
  const [startTerm, setStartTerm] = useState('')
  const [addressIssues, setAddressIssues] = useState<PrepSession['addressIssues']>([])
  const [addressChanges, setAddressChanges] = useState<AddressCleanChange[]>([])
  const [ceebChanges, setCeebChanges] = useState<PrepSession['ceebChanges']>([])
  const [ceebStillMissing, setCeebStillMissing] = useState<PrepSession['ceebStillMissing']>([])
  const [aoiMapped, setAoiMapped] = useState(0)
  const [aoiUnmapped, setAoiUnmapped] = useState(0)
  const [ceebKeyColumn, setCeebKeyColumn] = useState('')
  const [ceebValueColumn, setCeebValueColumn] = useState('')
  const [loadingMessage, setLoadingMessage] = useState('')
  const [ceebBusy, setCeebBusy] = useState(false)
  const [ceebProgress, setCeebProgress] = useState({ done: 0, total: 0 })
  const [smartyResults, setSmartyResults] = useState<SmartyValidationResult[]>([])
  const [smartyConfigured, setSmartyConfigured] = useState<boolean | null>(null)
  const [addressValidationProgress, setAddressValidationProgress] = useState({ done: 0, total: 0 })
  const [validatingAddresses, setValidatingAddresses] = useState(false)
  const addressValidationRan = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [addressChangesPage, setAddressChangesPage] = useState(1)
  const [ceebChangesPage, setCeebChangesPage] = useState(1)
  const [ceebStillMissingPage, setCeebStillMissingPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const stepBusy = loading || ceebBusy || validatingAddresses
  const showStepStatus =
    (step === 'ceeb' && ceebBusy) || (step === 'addresses' && validatingAddresses)

  function continueLabel() {
    if (loading) return 'Reading file…'
    if (ceebBusy) return 'Searching CEEB codes…'
    if (validatingAddresses) return 'Validating addresses…'
    return 'Continue'
  }

  const steps = campusType === 'online' ? ONLINE_STEPS : MAIN_STEPS
  const stepIndex = steps.findIndex((item) => item.id === step)

  const exportFileName = useMemo(() => {
    if (!fileName) return 'ptk-prepared.csv'
    const base = fileName.replace(/\.(csv|xlsx|xls)$/i, '')
    return `${base}_prepared.csv`
  }, [fileName])

  const displayedAddressChanges = useMemo(
    () => buildAddressChangeGroups(addressChanges, addressChangesPage),
    [addressChanges, addressChangesPage],
  )

  const displayedCeebChanges = useMemo(
    () => paginateItems(ceebChanges, ceebChangesPage),
    [ceebChanges, ceebChangesPage],
  )

  const displayedCeebStillMissing = useMemo(
    () => paginateItems(ceebStillMissing, ceebStillMissingPage),
    [ceebStillMissing, ceebStillMissingPage],
  )

  useEffect(() => {
    const pageCount = getPageCount(addressChanges.length)
    if (addressChangesPage > pageCount) {
      setAddressChangesPage(pageCount)
    }
  }, [addressChanges.length, addressChangesPage])

  useEffect(() => {
    const pageCount = getPageCount(ceebChanges.length)
    if (ceebChangesPage > pageCount) {
      setCeebChangesPage(pageCount)
    }
  }, [ceebChanges.length, ceebChangesPage])

  useEffect(() => {
    const pageCount = getPageCount(ceebStillMissing.length)
    if (ceebStillMissingPage > pageCount) {
      setCeebStillMissingPage(pageCount)
    }
  }, [ceebStillMissing.length, ceebStillMissingPage])

  useEffect(() => {
    if (step !== 'addresses') {
      addressValidationRan.current = false
      return
    }
    if (addressValidationRan.current || !rows.length) return

    const indexesToValidate = addressIssues
      .map((issue) => issue.rowIndex)
      .filter((rowIndex) => (rows[rowIndex]['Address 1'] ?? '').trim())

    if (indexesToValidate.length === 0) return

    addressValidationRan.current = true
    let cancelled = false

    setValidatingAddresses(true)
    setAddressValidationProgress({ done: 0, total: indexesToValidate.length })

    void validateAddressesBatch(rows, indexesToValidate, (done, total) => {
      if (!cancelled) setAddressValidationProgress({ done, total })
    })
      .then((results) => {
        if (cancelled || !results.length) return

        setSmartyConfigured(results[0].configured)
        setSmartyResults(results)

        if (results[0].configured) {
          const { rows: updated, changes } = applySmartyStandardization(rows, results)
          setRows(updated)
          if (changes.length) setAddressChanges((prev) => [...prev, ...changes])
          setAddressIssues(findAddressIssues(updated))
        }
      })
      .finally(() => {
        if (!cancelled) setValidatingAddresses(false)
      })

    return () => {
      cancelled = true
    }
  }, [step, addressIssues, rows])

  async function handlePtkUpload(file: File) {
    setError('')
    setLoading(true)
    setLoadingMessage('Reading and cleaning addresses…')
    try {
      const detected = detectCampusType(file.name)
      if (!detected) {
        throw new Error(
          'Could not detect campus type from the file name. Include "MAIN CAMPUS" or "ONLINE" in the filename.',
        )
      }

      const parsed = await parseImportFile(file)
      validatePtkHeaders(parsed.headers, detected)
      const named = cleanNames(parsed.rows, parsed.headers)
      const emailed = cleanEmails(named.rows, parsed.headers)
      const cleaned = cleanAddresses(emailed.rows)
      setFileName(file.name)
      setCampusType(detected)
      setHeaders(parsed.headers)
      setRows(cleaned.rows)
      setAddressChanges([...named.changes, ...emailed.changes, ...cleaned.changes])
      setAddressChangesPage(1)
      setCeebChangesPage(1)
      setCeebStillMissingPage(1)
      setStartTerm(extractStartTerm(file.name))
      setAddressIssues([])
      setCeebChanges([])
      setCeebStillMissing([])
      setAoiMapped(0)
      setAoiUnmapped(0)
      setCeebKeyColumn('')
      setCeebValueColumn('')
      setSmartyResults([])
      setSmartyConfigured(null)
      addressValidationRan.current = false
      setStep('upload')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to read file.')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  function pickPtkFile(file: File | undefined) {
    if (!file || loading) return
    if (!isPtkFile(file)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls).')
      return
    }
    void handlePtkUpload(file)
  }

  function onUploadDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (loading) return
    dragCounter.current += 1
    setDragActive(true)
  }

  function onUploadDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragActive(false)
    }
  }

  function onUploadDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
  }

  function onUploadDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current = 0
    setDragActive(false)
    pickPtkFile(event.dataTransfer.files?.[0])
  }

  async function applyBundledCeebPrep(
    currentRows: PrepSession['rows'],
    options: { useOnlineSearch?: boolean; forceRefresh?: boolean } = {},
  ) {
    if (options.forceRefresh) {
      resetCeebCaches()
    }

    setLoadingMessage('Loading CEEB reference file…')
    const { lookup, keyColumn, valueColumn, allSchools } = await loadBundledCeebLookup()

    if (options.useOnlineSearch) {
      setLoadingMessage('Searching Excel reference and College Board…')
    } else {
      setLoadingMessage('Searching Excel reference…')
    }
    setCeebProgress({ done: 0, total: 0 })

    const result = await applyCeebPrep(currentRows, lookup, allSchools, {
      useOnlineSearch: options.useOnlineSearch,
      onProgress: (done, total) => {
        setCeebProgress({ done, total })
        setLoadingMessage(`Searching online references — ${done} of ${total} colleges`)
      },
    })

    setRows(result.rows)
    setCeebChanges(result.changes)
    setCeebChangesPage(1)
    setCeebStillMissingPage(1)
    setCeebStillMissing(result.stillMissing)
    setCeebKeyColumn(keyColumn)
    setCeebValueColumn(valueColumn)
    setCeebProgress({ done: 0, total: 0 })
    setLoadingMessage('')
    return result
  }

  async function rerunCeebSearch() {
    setError('')
    setCeebBusy(true)
    try {
      await applyBundledCeebPrep(rows, { useOnlineSearch: true, forceRefresh: true })
    } catch (ceebError) {
      setError(ceebError instanceof Error ? ceebError.message : 'Failed to rerun CEEB search.')
    } finally {
      setCeebBusy(false)
      setLoadingMessage('')
    }
  }

  async function applyAoiStep() {
    setError('')
    setLoading(true)
    setLoadingMessage('Mapping CMU AOI from crosswalk…')
    try {
      const crosswalk = await loadCrosswalk()
      const lookup = buildAoiLookup(crosswalk)
      const result = applyAoiColumn(headers, rows, lookup)
      setHeaders(result.headers)
      setRows(result.rows)
      setAoiMapped(result.mapped)
      setAoiUnmapped(result.unmapped)
    } catch (aoiError) {
      setError(aoiError instanceof Error ? aoiError.message : 'Failed to map AOI values.')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  function applyStartTermStep() {
    setError('')
    try {
      const result = insertColumnAfter(
        headers,
        rows,
        COL_EXPECTED_GRAD,
        COL_START_TERM,
        () => startTerm,
      )
      setHeaders(result.headers)
      setRows(result.rows)
    } catch (termError) {
      setError(termError instanceof Error ? termError.message : 'Failed to add Start Term.')
    }
  }

  function goNext() {
    setError('')
    if (step === 'upload') {
      if (!rows.length || !campusType) {
        setError('Upload a PTK import file to continue.')
        return
      }
      setAddressIssues(findAddressIssues(rows))
      setStep('addresses')
      return
    }

    if (step === 'addresses') {
      setStep('ceeb')
      setCeebBusy(true)
      setLoadingMessage('Loading CEEB reference file…')
      void applyBundledCeebPrep(rows, { useOnlineSearch: true })
        .catch((ceebError) => {
          setError(
            ceebError instanceof Error ? ceebError.message : 'Failed to apply CEEB lookup.',
          )
        })
        .finally(() => {
          setCeebBusy(false)
          setLoadingMessage('')
        })
      return
    }

    if (step === 'ceeb') {
      if (campusType === 'online') {
        setStep('export')
        return
      }
      setLoading(true)
      void applyAoiStep().then(() => {
        setLoading(false)
        setStep('aoi')
      })
      return
    }

    if (step === 'aoi') {
      setStep('start-term')
      return
    }

    if (step === 'start-term') {
      applyStartTermStep()
      setStep('export')
    }
  }

  function goBack() {
    setError('')
    const prev = steps[stepIndex - 1]
    if (prev) setStep(prev.id)
  }

  function handleExport() {
    const csv = rowsToCsv(headers, rows)
    downloadTextFile(csv, exportFileName, 'text/csv;charset=utf-8')
  }

  function reset() {
    setStep('upload')
    setFileName('')
    setCampusType(null)
    setHeaders([])
    setRows([])
    setStartTerm('')
    setAddressIssues([])
    setAddressChanges([])
    setAddressChangesPage(1)
    setCeebChangesPage(1)
    setCeebStillMissingPage(1)
    setCeebChanges([])
    setCeebStillMissing([])
    setAoiMapped(0)
    setAoiUnmapped(0)
    setCeebKeyColumn('')
    setCeebValueColumn('')
    setCeebProgress({ done: 0, total: 0 })
    setCeebBusy(false)
    setSmartyResults([])
    setSmartyConfigured(null)
    addressValidationRan.current = false
    setLoadingMessage('')
    resetCeebCaches()
    setError('')
  }

  return (
    <div className="app-shell">
      <ToolHeader
        title="PTK Import Prep"
        description="Prepare monthly Phi Theta Kappa files for Slate — clean addresses, fill CEEB codes, and export a ready-to-upload CSV in minutes."
      />

      <StepProgress steps={steps} currentIndex={stepIndex} />

      <section className="card">
        {step === 'upload' && (
          <>
            <div className="card-header">
              <h2>Upload your file</h2>
              <p>
                Upload the monthly PTK import from Team Dynamix. Campus type and start
                term are detected from the file name.
              </p>
            </div>
            {fileName && campusType ? (
              <div className={`upload-result${loading ? ' upload-result-busy' : ''}`}>
                {loading && (
                  <Loader message={loadingMessage || 'Reading file…'} variant="overlay" size="sm" />
                )}
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
                    <span className={`upload-meta-tag upload-meta-campus ${campusType}`}>
                      {campusLabel(campusType)}
                    </span>
                    <span className="upload-meta-tag upload-meta-rows">
                      {rows.length.toLocaleString()} rows
                    </span>
                    {startTerm && (
                      <span className="upload-meta-tag upload-meta-term">{startTerm}</span>
                    )}
                    {addressChanges.length > 0 && (
                      <span className="upload-meta-tag upload-meta-cleaned">
                        {addressChanges.length.toLocaleString()} Addresses cleaned
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`upload-zone${dragActive ? ' upload-zone-drag' : ''}${loading ? ' upload-zone-busy' : ''}`}
                onDragEnter={onUploadDragEnter}
                onDragLeave={onUploadDragLeave}
                onDragOver={onUploadDragOver}
                onDrop={onUploadDrop}
                onClick={() => {
                  if (!loading) fileInputRef.current?.click()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    if (!loading) fileInputRef.current?.click()
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload PTK import file"
              >
                {loading && (
                  <Loader message={loadingMessage || 'Reading file…'} variant="overlay" size="sm" />
                )}
                <svg className="upload-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path
                    d="M24 32V16M24 16L18 22M24 16L30 22"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 32V36C8 38.2 9.8 40 12 40H36C38.2 40 40 38.2 40 36V32"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="upload-title">PTK import file</p>
                <p className="upload-hint">Drag and drop here, or click to browse</p>
                <p className="upload-filename-hint">
                  CSV or Excel · include
                  <span className="upload-hint-tag">MAIN CAMPUS</span>
                  or
                  <span className="upload-hint-tag">ONLINE</span>
                  in the filename
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="ptk-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(event) => {
                pickPtkFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </>
        )}

        {step === 'addresses' && (
          <>
            <div className="card-header">
              <h2>Spot check addresses</h2>
              <p>
                Apartments and units moved to Address 2. City, state, and zip extracted
                from Address 1. Review any flagged rows below.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard value={addressChanges.length} label="Fields cleaned" highlight="resolved" />
              <StatCard value={addressIssues.length} label="Rows flagged" highlight="flagged" />
              <StatCard value={rows.length - addressIssues.length} label="Rows complete" />
            </div>

            {validatingAddresses && (
              <div className="status-panel" role="status" aria-live="polite">
                <Spinner size="sm" />
                <div className="status-panel-text">
                  <p className="status-panel-message">
                    Validating flagged addresses with Smarty…
                  </p>
                  <div className="status-panel-progress">
                    <ProgressBar
                      value={addressValidationProgress.done}
                      max={addressValidationProgress.total}
                    />
                  </div>
                </div>
              </div>
            )}

            {smartyConfigured === false && (
              <div className="alert alert-muted">
                Smarty API Tokens are required to validate addresses.
              </div>
            )}

            {smartyConfigured && smartyResults.some((r) => r.valid) && (
              <div className="alert alert-success">
                Smarty verified {smartyResults.filter((r) => r.valid).length} address
                {smartyResults.filter((r) => r.valid).length === 1 ? '' : 'es'} against USPS data.
              </div>
            )}

            {addressChanges.length > 0 && (
              <div className="section-block">
                <p className="section-title">Address changes</p>
                <ChangeLegend />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PTK ID</th>
                        <th>Field</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAddressChanges.map(({ change, groupIndex }, index) => (
                        <tr
                          key={`${change.ptkId}-${change.field}-${index}`}
                          className={groupIndex % 2 === 1 ? 'row-group-alt' : undefined}
                        >
                          <td>{change.ptkId}</td>
                          <td>
                            <span className="field-tag">{change.field}</span>
                          </td>
                          <td>
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={addressChangesPage}
                  total={addressChanges.length}
                  onPageChange={setAddressChangesPage}
                  noun="changes"
                />
              </div>
            )}

            {addressIssues.length > 0 && (
              <div className="section-block">
                <p className="section-title">Flagged for review</p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PTK ID</th>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addressIssues.slice(0, 100).map((issue) => (
                        <tr key={issue.ptkId}>
                          <td>{issue.ptkId}</td>
                          <td>{issue.name}</td>
                          <td>{getAddressPreview(rows[issue.rowIndex])}</td>
                          <td>
                            {issue.issues.map((item) => (
                              <span key={item} className="status-flagged" style={{ display: 'block' }}>
                                {item}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {addressIssues.length > 100 && (
                  <p className="truncate-note">Showing first 100 flagged rows</p>
                )}
              </div>
            )}

            {addressIssues.length === 0 && addressChanges.length === 0 && (
              <p className="empty-state">All addresses look good — nothing to review.</p>
            )}
          </>
        )}

        {step === 'ceeb' && (
          <>
            <div className="card-header">
              <h2>CEEB codes</h2>
              <p>
                Missing codes are filled from the Excel reference, then searched online
                (College Board, Excel fuzzy match, and supplements). All codes are padded to four digits.
              </p>
            </div>

            {ceebBusy ? (
              <div className="status-panel" role="status" aria-live="polite">
                <Spinner size="sm" />
                <div className="status-panel-text">
                  <p className="status-panel-message">
                    {loadingMessage || 'Applying CEEB lookup…'}
                  </p>
                  {ceebProgress.total > 0 && (
                    <div className="status-panel-progress">
                      <ProgressBar value={ceebProgress.done} max={ceebProgress.total} />
                    </div>
                  )}
                </div>
              </div>
            ) : ceebKeyColumn ? (
              <div className="alert alert-success">
                <span className="alert-icon">✓</span>
                <span>
                  Lookup applied: <strong>{ceebKeyColumn}</strong> →{' '}
                  <strong>{ceebValueColumn}</strong>
                </span>
              </div>
            ) : null}

            <div className="toolbar">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void rerunCeebSearch()}
                disabled={ceebBusy}
              >
                Rerun search (Excel + online)
              </button>
            </div>

            <div className="stats-grid">
              <StatCard value={ceebChanges.length} label="Codes updated" highlight="resolved" />
              <StatCard value={ceebStillMissing.length} label="Still missing" highlight="flagged" />
            </div>

            {ceebChanges.length > 0 && (
              <div className="section-block">
                <p className="section-title">CEEB changes</p>
                <ChangeLegend />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>College</th>
                        <th>Change</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCeebChanges.map((change) => (
                        <tr key={`${change.ptkId}-${change.rowIndex}`}>
                          <td>{change.college}</td>
                          <td>
                            <BeforeAfter before={change.before} after={change.after} />
                          </td>
                          <td>
                            <SourceBadge source={change.source} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={ceebChangesPage}
                  total={ceebChanges.length}
                  onPageChange={setCeebChangesPage}
                  noun="updates"
                />
              </div>
            )}

            {ceebStillMissing.length > 0 && (
              <div className="section-block">
                <p className="section-title">Still missing</p>
                <div className="alert alert-warning">
                  <span className="alert-icon">!</span>
                  <div>
                    <strong>{ceebStillMissing.length} colleges</strong> still need CEEB codes.
                    Search on SUNY, then add verified codes to{' '}
                    <code>public/reference/ceeb-supplements.json</code> for future imports.
                    <ul className="link-list">
                      <li>
                        <a href={COLLEGE_CEEB_URL} target="_blank" rel="noreferrer">
                          College CEEB search (SUNY)
                        </a>
                      </li>
                      <li>
                        <a href={HIGH_SCHOOL_CEEB_URL} target="_blank" rel="noreferrer">
                          High school code search (College Board)
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PTK ID</th>
                        <th>College</th>
                        <th>IPEDS ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCeebStillMissing.map((item) => (
                        <tr key={`${item.ptkId}-${item.rowIndex}`}>
                          <td>{item.ptkId}</td>
                          <td>{item.college}</td>
                          <td>{item.ipedsId || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={ceebStillMissingPage}
                  total={ceebStillMissing.length}
                  onPageChange={setCeebStillMissingPage}
                  noun="colleges"
                />
              </div>
            )}
          </>
        )}

        {step === 'aoi' && campusType === 'main' && (
          <>
            <div className="card-header">
              <h2>CMU AOI column</h2>
              <p>
                <strong>CMU AOI</strong> inserted after <strong>{COL_CURRENT_MAJOR_CODE}</strong>{' '}
                using the 2025 MajorCIP to AOI crosswalk.
              </p>
            </div>
            <div className="stats-grid">
              <StatCard value={aoiMapped} label="Major codes mapped" highlight="resolved" />
              <StatCard value={aoiUnmapped} label="Without AOI match" highlight="flagged" />
            </div>
            {headers.includes('CMU AOI') ? (
              <div className="alert alert-success">
                <span className="alert-icon">✓</span>
                CMU AOI column has been added to your file.
              </div>
            ) : (
              <div className="status-panel" role="status" aria-live="polite">
                <Spinner size="sm" />
                <p className="status-panel-message">Applying AOI mapping…</p>
              </div>
            )}
          </>
        )}

        {step === 'start-term' && campusType === 'main' && (
          <>
            <div className="card-header">
              <h2>Start Term column</h2>
              <p>
                <strong>{COL_START_TERM}</strong> is added after{' '}
                <strong>{COL_EXPECTED_GRAD}</strong>. Confirm the term detected from your file name.
              </p>
            </div>
            <label className="field-label" htmlFor="start-term-input">
              Start Term
            </label>
            <input
              id="start-term-input"
              className="text-input"
              value={startTerm}
              onChange={(event) => setStartTerm(event.target.value)}
            />
            <div className="alert alert-warning" style={{ marginTop: '1.25rem' }}>
              <span className="alert-icon">→</span>
              This value will be added to every row when you continue.
            </div>
          </>
        )}

        {step === 'export' && (
          <>
            <div className="export-ready">
              <div className="export-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path
                    d="M8 20V24C8 25.1 8.9 26 10 26H22C23.1 26 24 25.1 24 24V20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 6V20M16 20L11 15M16 20L21 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="card-header" style={{ marginBottom: 0 }}>
                <h2>Ready to export</h2>
                <p>
                  Upload to Slate using{' '}
                  <strong>
                    PTK Import – {campusType === 'main' ? 'Main Campus' : 'Global Campus'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard value={rows.length.toLocaleString()} label="Rows ready" highlight="resolved" />
              <StatCard value={headers.length} label="Columns" />
              {campusType === 'main' && (
                <>
                  <StatCard
                    value={headers.includes('CMU AOI') ? '✓' : '—'}
                    label="CMU AOI added"
                    highlight={headers.includes('CMU AOI') ? 'resolved' : 'none'}
                  />
                  <StatCard
                    value={headers.includes(COL_START_TERM) ? startTerm : '—'}
                    label="Start Term"
                  />
                </>
              )}
            </div>

            <div className="card-footer card-footer-export">
              <button type="button" className="btn btn-secondary" onClick={goBack}>
                Back
              </button>
              <div className="export-actions">
                <button type="button" className="btn btn-primary" onClick={handleExport}>
                  Download {exportFileName}
                </button>
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  Start over
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">✕</span>
            {error}
          </div>
        )}

        {step !== 'export' && (
          <div className="card-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goBack}
              disabled={stepIndex === 0 || loading || ceebBusy}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={stepBusy || (step === 'upload' && !rows.length)}
            >
              {stepBusy && !showStepStatus ? <Spinner size="sm" /> : null}
              {continueLabel()}
            </button>
          </div>
        )}
      </section>

      <footer className="app-footer">
        PTK Slate Import Prep · Automates monthly Phi Theta Kappa file preparation
      </footer>
    </div>
  )
}
