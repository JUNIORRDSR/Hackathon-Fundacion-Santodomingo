import type { Request } from '../../types'
import { StatusBadge } from '../solicitudes/RequestList'
import { initials } from './timelineData'
import type { PlannedRequest } from './timelineData'

export function CollectorAvatar({ name }: { name: string }) {
  return (
    <span className="collector-avatar" aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function AgendaList({
  requests,
  names,
  selectedId,
  onSelect,
}: {
  requests: PlannedRequest[]
  names: Map<string, string>
  selectedId?: string
  onSelect: (item: Request) => void
}) {
  return (
    <ul className="timeline-agenda">
      {requests.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="agenda-task"
            aria-haspopup="dialog"
            data-selected={selectedId === item.id}
            onClick={() => onSelect(item)}
          >
            <span className="agenda-hour">{item.asignacion.hora ?? 'Sin hora'}</span>
            <span className="agenda-detail">
              <strong>{item.solicitante}</strong>
              <span>
                {names.get(item.asignacion.recolectorId)} · {item.ubicacion}
              </span>
            </span>
            <StatusBadge status={item.estado} />
          </button>
        </li>
      ))}
    </ul>
  )
}
