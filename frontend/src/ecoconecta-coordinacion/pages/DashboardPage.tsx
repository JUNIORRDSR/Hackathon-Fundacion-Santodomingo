import { useEffect, useState } from 'react'
import { formatDate, formatDay, groupLabels, localDate, localTime } from '../labels'
import type { EcoLink } from '../routes'
import type { Collector, Coordinator, Request, RequestStatus } from '../types'
import { ScheduleTimeline } from '../components/recolecciones/ScheduleTimeline'
import { getPlannedRequests } from '../components/recolecciones/timelineData'
import type { PlannedRequest } from '../components/recolecciones/timelineData'
import { RequestList } from '../components/solicitudes/RequestList'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import type { IconName } from '../components/ui/Icon'

const metrics: { status: RequestStatus; title: string; caption: string; icon: IconName }[] = [
  { status: 'pendiente', title: 'Solicitudes pendientes', caption: 'Por asignar', icon: 'clock' },
  { status: 'asignada', title: 'Recolecciones asignadas', caption: 'Con fecha de recolección', icon: 'calendar' },
  { status: 'recolectada', title: 'Recolecciones completadas', caption: 'Con peso registrado', icon: 'checkCircle' },
  { status: 'rechazada', title: 'Recolecciones rechazadas', caption: 'Con motivo registrado', icon: 'xCircle' },
]

export function DashboardHeader({
  coordinator,
  demo,
  href,
}: {
  coordinator: Coordinator
  demo: boolean
  href: EcoLink
}) {
  const today = localDate()
  return (
    <div className="workspace-heading">
      <div>
        <h1 tabIndex={-1}>Panel de coordinación</h1>
        <p className="workspace-context">
          <time dateTime={today}>{formatDay(today)}</time>
          <span>{groupLabels[coordinator.grupo]} · Villas de San Pablo</span>
          {demo && (
            <span className="workspace-demo">
              <i aria-hidden="true" /> Datos de demostración
            </span>
          )}
        </p>
      </div>
      <a className="button button-primary" href={href({ page: 'solicitudes', filter: 'pendiente' })}>
        <Icon name="clipboard" /> Ver pendientes
      </a>
    </div>
  )
}

function NextCollection({
  planned,
  collectors,
  href,
  today,
  now,
  onSelect,
}: {
  planned: PlannedRequest[]
  collectors: Collector[]
  href: EcoLink
  today: string
  now: string
  onSelect: (item: Request) => void
}) {
  const assigned = planned.filter((item) => item.estado === 'asignada')
  const upcoming = assigned.filter(
    ({ asignacion }) =>
      asignacion.fecha > today || (asignacion.fecha === today && (!asignacion.hora || asignacion.hora >= now)),
  )
  const next = upcoming[0] ?? assigned[0]
  const others = (upcoming.length ? upcoming.slice(1) : assigned.slice(1)).slice(0, 2)

  return (
    <section className="card bento-panel collection-feature" aria-labelledby="next-heading">
      <div className="panel-heading">
        <div>
          <h2 id="next-heading">{upcoming.length ? 'Próxima recolección' : 'Por registrar'}</h2>
          <p>Agenda de tu equipo</p>
        </div>
        <span className="feature-icon">
          <Icon name="truck" />
        </span>
      </div>
      {next ? (
        <div className="next-card">
          <p className="next-time">
            <Icon name="calendar" />
            <time dateTime={next.asignacion.fecha}>
              {next.asignacion.fecha === today ? 'Hoy' : formatDate(next.asignacion.fecha)}
            </time>
            <span>· {next.asignacion.hora ?? 'Sin hora'}</span>
          </p>
          <h3>{next.solicitante}</h3>
          <div className="next-meta">
            <p>
              <Icon name="pin" /> {next.ubicacion}
            </p>
            <p>
              <Icon name="user" />{' '}
              {collectors.find(({ id }) => id === next.asignacion.recolectorId)?.nombre ?? next.asignacion.recolectorId}
            </p>
          </div>
          <div className="next-actions">
            <button type="button" className="button feature-button" onClick={() => onSelect(next)}>
              Ver detalle
            </button>
            <a className="button button-surface" href={href({ page: 'recolecciones', requestId: next.id })}>
              Registrar
            </a>
          </div>
        </div>
      ) : (
        <p className="feature-empty">No hay recolecciones asignadas.</p>
      )}
      {others.length > 0 && (
        <div className="following">
          <h3>{upcoming.length ? 'Después' : 'Otras por registrar'}</h3>
          <ul>
            {others.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onSelect(item)}>
                  <time dateTime={item.asignacion.fecha}>
                    {item.asignacion.fecha === today
                      ? (item.asignacion.hora ?? 'Hoy')
                      : formatDate(item.asignacion.fecha)}
                  </time>
                  <span>
                    <strong>{item.solicitante}</strong>
                    <small>{item.ubicacion}</small>
                  </span>
                  <Icon name="clipboard" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <a className="button feature-link" href={href({ page: 'recolecciones' })}>
        Todas las recolecciones
      </a>
    </section>
  )
}

export function DashboardPage({
  requests,
  collectors,
  href,
  onSelect,
}: {
  requests: Request[]
  collectors: Collector[]
  href: EcoLink
  onSelect: (item: Request) => void
}) {
  const [clock, setClock] = useState(localTime)
  useEffect(() => {
    const timer = window.setInterval(() => setClock(localTime()), 15000)
    return () => window.clearInterval(timer)
  }, [])
  const today = localDate()
  const planned = getPlannedRequests(requests)
  const counts = { pendiente: 0, asignada: 0, recolectada: 0, rechazada: 0, cancelada: 0 }
  for (const request of requests) counts[request.estado]++
  const recent = [...requests]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.codigo.localeCompare(a.codigo, undefined, { numeric: true }))
    .slice(0, 3)
  const pendingShare = requests.length ? Math.round((counts.pendiente / requests.length) * 100) : 0

  return (
    <>
      <section aria-label="Estado de las solicitudes" className="stat-grid">
        {metrics.map(({ status, title, caption, icon }) => (
          <a
            key={status}
            className={'card stat-card stat-' + status}
            href={href({ page: 'solicitudes', filter: status })}
          >
            <span className="stat-title">
              <Icon name={icon} />
              {title}
            </span>
            <strong>{counts[status]}</strong>
            <span className="stat-meta">
              <span className="stat-caption">{caption}</span>
              {status === 'pendiente' && (
                <span className="stat-meter" title={pendingShare + '% del total'}>
                  <span className="sr-only">{pendingShare}% del total</span>
                  <span aria-hidden="true" style={{ width: pendingShare + '%' }} />
                </span>
              )}
            </span>
          </a>
        ))}
      </section>
      <div className="dashboard-bento">
        <ScheduleTimeline planned={planned} collectors={collectors} today={today} clock={clock} onSelect={onSelect} />
        <NextCollection
          planned={planned}
          collectors={collectors}
          href={href}
          today={today}
          now={clock}
          onSelect={onSelect}
        />
      </div>
      <div className="dashboard-bento dashboard-lower">
        <section className="card bento-panel recent-panel" aria-labelledby="recent-heading">
          <div className="panel-heading">
            <div>
              <h2 id="recent-heading">Solicitudes recientes</h2>
              <p>Últimos registros de tu equipo</p>
            </div>
            <a className="button button-secondary" href={href({ page: 'solicitudes' })}>
              Ver todas
            </a>
          </div>
          {recent.length ? (
            <RequestList requests={recent} onSelect={onSelect} compact />
          ) : (
            <EmptyState title="Todavía no hay solicitudes">Aquí verás los últimos registros.</EmptyState>
          )}
        </section>
        <section className="card bento-panel training-shortcut">
          <span className="icon-tile">
            <Icon name="book" />
          </span>
          <div>
            <h2>Capacitación ambiental</h2>
            <p>Guías de separación de residuos</p>
          </div>
          <a className="button button-secondary" href={href({ page: 'capacitacion' })}>
            Ver guías
          </a>
        </section>
      </div>
    </>
  )
}
