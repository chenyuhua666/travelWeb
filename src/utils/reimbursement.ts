import type { City } from '@/types/master'
import type { SubsidyDaySavePayload } from '@/types/reimbursement'

export function money(value: number | null | undefined) {
  return Number(value || 0).toFixed(2)
}

export function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

export function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`
}

export function dateRange(start: string, end: string) {
  if (!start || !end) {
    return [] as string[]
  }
  const cursor = new Date(`${start}T00:00:00`)
  const finalDate = new Date(`${end}T00:00:00`)
  const values: string[] = []
  while (cursor <= finalDate) {
    values.push(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return values
}

export function disabledFutureDate(date: Date) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date.getTime() > today.getTime()
}

export function mealStandard(city?: City) {
  if (city?.cityType === 1) {
    return 100
  }
  if (city?.cityType === 2) {
    return 80
  }
  return 50
}

export function createSubsidyDays(start: string, end: string, city?: City): SubsidyDaySavePayload[] {
  const mealAmount = mealStandard(city)
  return dateRange(start, end).map((subsidyDate) => ({
    subsidyDate,
    mealSelected: false,
    mealAmount,
    transportationSelected: false,
    transportationAmount: 40,
    phoneSelected: false,
    phoneAmount: 40,
  }))
}

export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createRowKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
