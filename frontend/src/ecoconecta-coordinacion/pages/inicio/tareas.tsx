import { timeMinutes } from '../../labels'
import type { EcoLink, EcoPage } from '../../routes'
import type { Request } from '../../types'
import type { PlannedRequest } from '../../components/recolecciones/timelineData'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'

export interface DashboardCounts {
  canjes?: number
  habilitar?: number
}
export interface Task {
  page: EcoPage
  filter?: string
  icon: IconName
  title: string
  count: number
  caption: string
  action: string
}

// Una recolección ya pasó su hora (o era de un día anterior) y todavía no tiene kilos: toca validarla.
function isDue({ asignacion }: PlannedRequest, today: string, now: string) {
  if (asignacion.fecha !== today) return asignacion.fecha < today
  const minute = timeMinutes(asignacion.hora)
  return minute === undefined || minute <= (timeMinutes(now) ?? 0)
}

// Lo que la coordinación tiene que hacer hoy, en el orden de urgencia del ciclo: validar, asignar, entregar, aceptar.
export function todayTasks(
  requests: Request[],
  planned: PlannedRequest[],
  { today, now, counts, pages }: { today: string; now: string; counts: DashboardCounts; pages: EcoPage[] },
): Task[] {
  const tasks: Task[] = [
    {
      page: 'recolecciones',
      icon: 'scale',
      title: 'Por validar',
      count: planned.filter((item) => item.estado === 'asignada' && isDue(item, today, now)).length,
      caption: 'Ya pasó su hora y faltan los kilos',
      action: 'Validar kilos',
    },
    {
      page: 'solicitudes',
      filter: 'pendiente',
      icon: 'clipboard',
      title: 'Por asignar',
      count: requests.filter((item) => item.estado === 'pendiente').length,
      caption: 'Esperan encargado y hora',
      action: 'Asignar',
    },
    {
      page: 'canjes',
      icon: 'gift',
      title: 'Premios por entregar',
      count: counts.canjes ?? 0,
      caption: 'Vecinos que muestran su código CAN',
      action: 'Entregar',
    },
    {
      page: 'habilitar',
      icon: 'user',
      title: 'Vecinos nuevos',
      count: counts.habilitar ?? 0,
      caption: 'Se registraron por WhatsApp',
      action: 'Aceptar',
    },
  ]
  return tasks.filter(
    (task) => task.page === 'recolecciones' || task.page === 'solicitudes' || pages.includes(task.page),
  )
}

// La tarjeta de cifra de Daniela, toda tocable, con la acción siempre abajo y del mismo tamaño.
export function TaskCard({ task, href, featured = false }: { task: Task; href: EcoLink; featured?: boolean }) {
  return (
    <a
      className={'card stat-card task-card' + (featured ? ' stat-pendiente' : '')}
      data-done={task.count === 0}
      href={href({ page: task.page, filter: task.filter })}
    >
      <span className="stat-title">
        <Icon name={task.icon} />
        {task.title}
      </span>
      <strong>{task.count}</strong>
      <span className="stat-caption">{task.count ? task.caption : 'Al día'}</span>
      <span className="task-card-action">
        {task.action}
        <Icon name="chevron" className="task-card-arrow" />
      </span>
    </a>
  )
}
