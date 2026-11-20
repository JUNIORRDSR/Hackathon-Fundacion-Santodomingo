import { compareAssignments, timeMinutes } from '../../labels'
import type { Collector, Request } from '../../types'

export type PlannedRequest = Extract<Request, { asignacion: object }>
type TimedTask = { request: PlannedRequest; minute: number }

export function getPlannedRequests(requests: Request[]): PlannedRequest[] {
  return requests
    .filter((item): item is PlannedRequest => item.asignacion !== undefined)
    .sort((a, b) => compareAssignments(a.asignacion, b.asignacion))
}

export function getCollectorNames(collectors: Collector[], requests: PlannedRequest[]) {
  const names = new Map(collectors.map(({ id, nombre }) => [id, nombre]))
  for (const {
    asignacion: { recolectorId },
  } of requests) {
    if (!names.has(recolectorId)) names.set(recolectorId, recolectorId)
  }
  return names
}

export function getTimelineData(requests: PlannedRequest[]) {
  const tasks: TimedTask[] = []
  const withoutTime: PlannedRequest[] = []
  let start = 8 * 60
  let end = 19 * 60

  for (const request of requests) {
    const minute = timeMinutes(request.asignacion.hora)
    if (minute === undefined) {
      withoutTime.push(request)
    } else {
      tasks.push({ request, minute })
      start = Math.min(start, Math.floor(minute / 60) * 60)
      end = Math.max(end, Math.ceil(minute / 60) * 60)
    }
  }

  const range = end - start
  const step = range > 14 * 60 ? 180 : 120
  const ticks: number[] = []
  for (let tick = start; tick <= end; tick += step) ticks.push(tick)
  if (end - ticks[ticks.length - 1] >= 60) ticks.push(end)

  const byCollector = new Map<string, TimedTask[][]>()
  for (const task of tasks) {
    const id = task.request.asignacion.recolectorId
    const tracks = byCollector.get(id) ?? []
    // Separate overlapping labels while keeping each start time aligned with the axis.
    const track = tracks.find((items) => task.minute - items[items.length - 1].minute >= range * 0.33)
    if (track) track.push(task)
    else tracks.push([task])
    byCollector.set(id, tracks)
  }

  return { start, end, range, ticks, byCollector, withoutTime }
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('es-CO'))
    .join('')
}
