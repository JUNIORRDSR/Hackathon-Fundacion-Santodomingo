import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { formatDay, groupLabels, localDate, localTime } from '../labels'
import type { EcoLink, EcoPage } from '../routes'
import type { Coordinator, Request } from '../types'
import { getPlannedRequests } from '../components/recolecciones/timelineData'
import { RequestList } from '../components/solicitudes/RequestList'
import { TaskCard, todayTasks } from './inicio/tareas'
import type { DashboardCounts } from './inicio/tareas'

export type { DashboardCounts } from './inicio/tareas'

function greeting() {
  const hour = Number(localTime().slice(0, 2))
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function DashboardHeader({ coordinator, demo }: { coordinator: Coordinator; demo: boolean }) {
  const today = localDate()
  return (
    <div className="workspace-heading">
      <div>
        <h1 tabIndex={-1}>
          {greeting()}, {coordinator.nombre}
        </h1>
        <p className="workspace-context">
          <time dateTime={today}>{formatDay(today)}</time>
          <span>{groupLabels[coordinator.grupo]} · Villas de San Pablo</span>
          {demo && <span className="workspace-demo">Datos de demostración</span>}
        </p>
      </div>
    </div>
  )
}

// El Inicio: el impacto del barrio que pone el host, lo que espera hoy y lo último que pidieron los vecinos.
export function DashboardPage({
  requests,
  href,
  pages = [],
  counts = {},
  impact,
  onSelect,
}: {
  requests: Request[]
  href: EcoLink
  pages?: EcoPage[]
  counts?: DashboardCounts
  impact?: ReactNode
  onSelect: (item: Request) => void
}) {
  const [now, setNow] = useState(localTime)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(localTime()), 15000)
    return () => window.clearInterval(timer)
  }, [])
  const tasks = todayTasks(requests, getPlannedRequests(requests), { today: localDate(), now, counts, pages })
  const urgent = tasks.find((task) => task.count > 0)
  const recent = [...requests].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6)
  return (
    <>
      {impact}
      <section aria-label="Qué hacer hoy" className="stat-grid">
        {tasks.map((task) => (
          <TaskCard key={task.page} task={task} href={href} featured={task === urgent} />
        ))}
      </section>
      <section className="card bento-panel recent-panel" aria-labelledby="recent-heading">
        <div className="panel-heading">
          <div>
            <h2 id="recent-heading">Solicitudes recientes</h2>
            <p>Últimos pedidos de los vecinos</p>
          </div>
          <a className="button button-secondary" href={href({ page: 'solicitudes' })}>
            Ver todas
          </a>
        </div>
        <RequestList requests={recent} onSelect={onSelect} compact />
      </section>
    </>
  )
}
