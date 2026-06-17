import { getPageCount, TABLE_PAGE_SIZE } from '../lib/pagination'

type TablePaginationProps = {
  page: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
  noun?: string
}

export function TablePagination({
  page,
  total,
  pageSize = TABLE_PAGE_SIZE,
  onPageChange,
  noun = 'records',
}: TablePaginationProps) {
  if (total <= pageSize) return null

  const pageCount = getPageCount(total, pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="table-pagination">
      <p className="table-pagination-summary">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()} {noun}
      </p>
      <div className="table-pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="table-pagination-page">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </div>
  )
}
