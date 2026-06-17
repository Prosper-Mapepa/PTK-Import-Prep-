import type { AddressCleanChange } from '../types'

export const TABLE_PAGE_SIZE = 50

export function paginateItems<T>(items: T[], page: number, pageSize = TABLE_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function getPageCount(total: number, pageSize = TABLE_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function buildAddressChangeGroups(
  changes: AddressCleanChange[],
  page: number,
  pageSize = TABLE_PAGE_SIZE,
): { change: AddressCleanChange; groupIndex: number }[] {
  const ptkGroupMap = new Map<string, number>()
  let groupCounter = -1

  for (const change of changes) {
    if (!ptkGroupMap.has(change.ptkId)) {
      groupCounter += 1
      ptkGroupMap.set(change.ptkId, groupCounter)
    }
  }

  return paginateItems(changes, page, pageSize).map((change) => ({
    change,
    groupIndex: ptkGroupMap.get(change.ptkId) ?? 0,
  }))
}
