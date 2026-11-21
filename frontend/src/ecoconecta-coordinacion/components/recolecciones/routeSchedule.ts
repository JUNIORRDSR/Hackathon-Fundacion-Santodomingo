import type { RouteSchedule } from '../../types'

export const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function routeDays(days: number[]) {
  if (days.length === 7) return 'Todos los días'
  const labels = days.map((day) => weekdays[day].toLocaleLowerCase('es'))
  const text = new Intl.ListFormat('es').format(labels)
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

export const routeHours = ({ horaInicio, horaFin }: RouteSchedule) => horaInicio + '–' + horaFin
