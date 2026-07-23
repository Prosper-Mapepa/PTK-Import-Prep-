import type { FieldChange } from '../types'

export const TABLE_PAGE_SIZE = 50

export function paginateItems<T>(items: T[], page: number, pageSize = TABLE_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function getPageCount(total: number, pageSize = TABLE_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function buildChangeGroups(
  changes: FieldChange[],
  page: number,
  pageSize = TABLE_PAGE_SIZE,
): { change: FieldChange; groupIndex: number }[] {
  const idGroupMap = new Map<string, number>()
  let groupCounter = -1

  for (const change of changes) {
    if (!idGroupMap.has(change.rowId)) {
      groupCounter += 1
      idGroupMap.set(change.rowId, groupCounter)
    }
  }

  return paginateItems(changes, page, pageSize).map((change) => ({
    change,
    groupIndex: idGroupMap.get(change.rowId) ?? 0,
  }))
}
