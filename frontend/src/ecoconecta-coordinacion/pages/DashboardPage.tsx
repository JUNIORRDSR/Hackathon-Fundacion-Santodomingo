import { useEffect, useState } from 'react'
import { formatDay, groupLabels, localDate, localTime, timeMinutes } from '../labels'
import type { EcoLink, EcoPage } from '../routes'
import type { Collector, Coordinator, Request } from '../types'
import { getPlannedRequests } from '../components/recolecciones/timelineData'
import type { PlannedRequest } from '../components/recolecciones/timelineData'
import { Icon } from '../components/ui/Icon'
import type { IconName } from '../components/ui/Icon'

// Inicio para la tableta: lo que hay que hacer hoy, en verbos y con un solo toque (PRODUCT.md).
export interface DashboardCounts {
  canjes?: number
  habilitar?: number
}
interface Task {
  page: EcoPage
  filter?: string
  icon: IconName
  count: number
  action: string
  pending: (n: number) => string
  done: string
}

const hourLabel = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const readableHour = (value: string) => hourLabel.format(new Date('1970-01-01T' + value + ':00Z'))
// El número va grande al lado: la frase no lo repite.
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function greeting() {
  const hour = Number(localTime().slice(0, 2))
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function DashboardHeader({ coordinator, demo }: { coordinator: Coordinator; demo: boolean; href: EcoLink }) {
  const today = localDate()
  return (
    <div className="today-heading">
      <h1 tabIndex={-1}>
        {greeting()}, {coordinator.nombre}
      </h1>
      <p>
        <time dateTime={today}>{formatDay(today)}</time> · {groupLabels[coordinator.grupo]}
        {demo && ' · Datos de demostración'}
      </p>
    </div>
  )
}

// Una recolección ya pasó su hora (o era de un día anterior) y todavía no tiene kilos: toca validarla.
function isDue({ asignacion }: PlannedRequest, today: string, now: string) {
  if (asignacion.fecha !== today) return asignacion.fecha < today
  const minute = timeMinutes(asignacion.hora)
  return minute === undefined || minute <= (timeMinutes(now) ?? 0)
}

function TaskTile({ task, href }: { task: Task; href: EcoLink }) {
  const done = task.count === 0
  return (
    <a className="card today-task" data-done={done} href={href({ page: task.page, filter: task.filter })}>
      <span className="today-task-icon">
        <Icon name={done ? 'check' : task.icon} />
      </span>
      <span className="today-task-text">
        <strong>{done ? 'Al día' : task.count}</strong>
        <span>{done ? task.done : task.pending(task.count)}</span>
      </span>
      <span className="today-task-action">
        {task.action} <Icon name="chevron" className="today-task-arrow" />
      </span>
    </a>
  )
}

function AgendaRow({
  item,
  collector,
  due,
  href,
  onSelect,
}: {
  item: PlannedRequest
  collector: string
  due: boolean
  href: EcoLink
  onSelect: (item: Request) => void
}) {
  const hour = item.asignacion.hora
  const closed = item.estado !== 'asignada'
  return (
    <li className="today-agenda-row" data-state={closed ? item.estado : due ? 'due' : 'next'}>
      <button type="button" className="today-agenda-main" onClick={() => onSelect(item)}>
        <span className="today-agenda-hour">{hour ? readableHour(hour) : 'Sin hora'}</span>
        <span className="today-agenda-who">
          <strong>{item.solicitante}</strong>
          <span>
            {item.ubicacion} · {collector}
          </span>
        </span>
      </button>
      {closed ? (
        <span className="today-agenda-state">
          <Icon name={item.estado === 'recolectada' ? 'check' : 'close'} />
          {item.estado === 'recolectada' ? 'Recolectada' : 'Rechazada'}
        </span>
      ) : due ? (
        <a className="button button-primary" href={href({ page: 'recolecciones', requestId: item.id })}>
          <Icon name="scale" /> Validar kilos
        </a>
      ) : (
        <span className="today-agenda-state">
          <Icon name="clock" /> Más tarde
        </span>
      )}
    </li>
  )
}

export function DashboardPage({
  requests,
  collectors,
  href,
  pages = [],
  counts = {},
  onSelect,
}: {
  requests: Request[]
  collectors: Collector[]
  href: EcoLink
  pages?: EcoPage[]
  counts?: DashboardCounts
  selectedId?: string
  onSelect: (item: Request) => void
}) {
  const [now, setNow] = useState(localTime)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(localTime()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const today = localDate()
  const planned = getPlannedRequests(requests)
  const toValidate = planned.filter((item) => item.estado === 'asignada' && isDue(item, today, now))
  const agenda = planned.filter((item) => item.asignacion.fecha === today)
  const names = new Map(collectors.map((c) => [c.id, c.nombre]))
  const tasks: Task[] = [
    {
      page: 'solicitudes',
      filter: 'pendiente',
      icon: 'clipboard',
      count: requests.filter((item) => item.estado === 'pendiente').length,
      action: 'Asignar',
      pending: (n) => plural(n, 'solicitud espera encargado', 'solicitudes esperan encargado'),
      done: 'No hay solicitudes por asignar.',
    },
    {
      page: 'recolecciones',
      icon: 'scale',
      count: toValidate.length,
      action: 'Validar kilos',
      pending: (n) => plural(n, 'recolección por validar', 'recolecciones por validar'),
      done: 'No hay recolecciones por validar.',
    },
    {
      page: 'canjes',
      icon: 'gift',
      count: counts.canjes ?? 0,
      action: 'Entregar premios',
      pending: (n) => plural(n, 'premio por entregar', 'premios por entregar'),
      done: 'No hay premios por entregar.',
    },
    {
      page: 'habilitar',
      icon: 'user',
      count: counts.habilitar ?? 0,
      action: 'Aceptar vecinos',
      pending: (n) => plural(n, 'vecino nuevo espera', 'vecinos nuevos esperan'),
      done: 'No hay vecinos nuevos.',
    },
  ]
  const visible = tasks.filter(
    (task) => task.page === 'solicitudes' || task.page === 'recolecciones' || pages.includes(task.page),
  )

  return (
    <div className="today-layout">
      <section className="today-tasks" aria-labelledby="today-tasks-heading">
        <h2 id="today-tasks-heading">Qué hacer hoy</h2>
        <div className="today-task-grid">
          {visible.map((task) => (
            <TaskTile key={task.page} task={task} href={href} />
          ))}
        </div>
      </section>
      <section className="card today-agenda" aria-labelledby="today-agenda-heading">
        <div className="today-agenda-heading">
          <h2 id="today-agenda-heading">Recolecciones de hoy</h2>
          <a className="button button-secondary" href={href({ page: 'recolecciones' })}>
            Ver todas
          </a>
        </div>
        {agenda.length ? (
          <ul>
            {agenda.map((item) => (
              <AgendaRow
                key={item.id}
                item={item}
                collector={names.get(item.asignacion.recolectorId) ?? 'Sin encargado'}
                due={isDue(item, today, now)}
                href={href}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : (
          <p className="today-agenda-empty">
            Hoy no hay recolecciones en la agenda. Asigna una solicitud para programarla.
          </p>
        )}
      </section>
    </div>
  )
}
