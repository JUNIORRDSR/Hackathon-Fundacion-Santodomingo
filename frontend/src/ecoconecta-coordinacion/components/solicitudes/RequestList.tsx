import { formatDate, statusLabels, wasteLabels } from '../../labels'
import type { Request, RequestStatus } from '../../types'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

const statusIcons: Record<RequestStatus, IconName> = {
  pendiente: 'clock',
  asignada: 'calendar',
  recolectada: 'checkCircle',
  rechazada: 'xCircle',
  cancelada: 'close',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className="status-badge">
      <Icon name={statusIcons[status]} />
      {statusLabels[status]}
    </span>
  )
}

export function WasteIcon({ type }: { type: Request['tipo'] }) {
  return (
    <span className="icon-tile">
      <Icon name={type === 'organico' ? 'leaf' : 'recycle'} />
    </span>
  )
}

export function RequestList({
  requests,
  onSelect,
  compact = false,
}: {
  requests: Request[]
  onSelect: (item: Request) => void
  compact?: boolean
}) {
  return (
    <div className={compact ? 'request-list compact-list' : 'card request-list'}>
      <div className="request-columns" aria-hidden="true">
        <span>Solicitante</span>
        <span>Tipo de residuo</span>
        {!compact && <span>Fecha</span>}
        <span>Estado</span>
        <span />
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {requests.map((item) => (
          <li className="request-row" key={item.id}>
            <div className="request-person">
              <WasteIcon type={item.tipo} />
              <div className="min-w-0">
                <p className="request-name">{item.solicitante}</p>
                <p className="request-location">{item.ubicacion}</p>
                {compact && <p className="request-tablet-type">{wasteLabels[item.tipo]}</p>}
                {!compact && <span className="request-id">{item.codigo}</span>}
              </div>
            </div>
            <span className="request-type">{wasteLabels[item.tipo]}</span>
            {!compact && (
              <time className="request-date" dateTime={item.fecha}>
                {formatDate(item.fecha)}
              </time>
            )}
            <StatusBadge status={item.estado} />
            <button
              type="button"
              className="button button-quiet request-action"
              aria-label={'Ver solicitud ' + item.codigo + ' de ' + item.solicitante}
              onClick={() => onSelect(item)}
            >
              Ver<span className="sr-only"> solicitud</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
