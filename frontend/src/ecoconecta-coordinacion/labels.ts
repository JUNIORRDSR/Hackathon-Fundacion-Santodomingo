import type { Assignment, LocalDate, RequestStatus, WasteType } from './types'

export const wasteLabels: Record<WasteType, string> = {
  organico: 'Orgánicos',
  aprovechable: 'Aprovechables',
}

export const groupLabels: Record<WasteType, string> = {
  organico: 'Huerteros',
  aprovechable: 'Recicladores',
}

export const statusLabels: Record<RequestStatus, string> = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  recolectada: 'Recolectada',
  rechazada: 'Rechazada',
}

export const timeZone = 'America/Bogota'
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const shortDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
})
const longDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const dayLabel = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const clock = new Intl.DateTimeFormat('es-CO', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const numberFormat = new Intl.NumberFormat('es-CO', { maximumSignificantDigits: 15 })

export function localDate(offset = 0): LocalDate {
  const parts = dateParts.formatToParts(new Date())
  const year = Number(parts.find(({ type }) => type === 'year')?.value)
  const month = Number(parts.find(({ type }) => type === 'month')?.value)
  const day = Number(parts.find(({ type }) => type === 'day')?.value)
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function shiftDate(value: LocalDate, days: number): LocalDate {
  const date = new Date(value + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDay(value: LocalDate): string {
  const label = dayLabel.format(new Date(value + 'T00:00:00Z'))
  return label.charAt(0).toLocaleUpperCase('es-CO') + label.slice(1)
}

export function localTime(): string {
  return clock.format(new Date())
}

export function timeMinutes(value?: string): number | undefined {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined
  const [hour, minute] = value.split(':').map(Number)
  return 60 * hour + minute
}

export function compareAssignments(a: Assignment, b: Assignment): number {
  return a.fecha.localeCompare(b.fecha) || (timeMinutes(a.hora) ?? 1440) - (timeMinutes(b.hora) ?? 1440)
}

export function formatDate(value: LocalDate, full = false): string {
  const date = new Date(value + 'T00:00:00Z')
  if (full) return longDate.format(date)
  return shortDate
    .formatToParts(date)
    .filter(({ type }) => type !== 'literal')
    .map(({ value }) => value)
    .join(' ')
}

export function formatWeight(weight: number): string {
  return numberFormat.format(weight) + ' kg'
}

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
