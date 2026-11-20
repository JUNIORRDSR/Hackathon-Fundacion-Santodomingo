import { useState } from 'react'
import { normalizeSearch, statusLabels, wasteLabels } from '../labels'
import type { EcoLink } from '../routes'
import type { Request, RequestStatus, WasteType } from '../types'
import { PageHeader } from '../components/layout/Layout'
import { RequestList } from '../components/solicitudes/RequestList'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { MotionPills } from '../components/ui/MotionPills'

const filters: { label: string; value: 'todas' | RequestStatus }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Asignadas', value: 'asignada' },
  { label: 'Recolectadas', value: 'recolectada' },
  { label: 'Rechazadas', value: 'rechazada' },
]

export function SolicitudesPage({
  requests,
  group,
  filter,
  href,
  onSelect,
}: {
  requests: Request[]
  group: WasteType
  filter?: string
  href: EcoLink
  onSelect: (item: Request) => void
}) {
  const [search, setSearch] = useState('')
  const current = filters.find(({ value }) => value === filter)?.value ?? 'todas'
  const query = normalizeSearch(search)
  const visible = requests
    .filter((request) => {
      const matchesState = current === 'todas' || current === request.estado
      const searchable = [
        request.codigo,
        request.solicitante,
        request.ubicacion,
        wasteLabels[request.tipo],
        statusLabels[request.estado],
      ].join(' ')
      return matchesState && normalizeSearch(searchable).includes(query)
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.codigo.localeCompare(a.codigo, undefined, { numeric: true }))

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description={'Consulta y asigna las solicitudes de ' + wasteLabels[group].toLowerCase() + '.'}
      />
      <div className="filter-bar">
        <MotionPills as="nav" className="pills" label="Filtrar por estado" active={current}>
          {filters.map(({ label, value }) => (
            <a
              key={value}
              className="pill"
              aria-current={current === value ? 'true' : undefined}
              href={href({ page: 'solicitudes', filter: value === 'todas' ? undefined : value })}
            >
              {label}
            </a>
          ))}
        </MotionPills>
        <div className="search-field">
          <Icon name="search" />
          <label htmlFor="eco-request-search" className="sr-only">
            Buscar por nombre, ubicación o código
          </label>
          <input
            id="eco-request-search"
            type="search"
            placeholder="Buscar solicitudes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <p className="results-count" role="status">
        {visible.length} {visible.length === 1 ? 'solicitud' : 'solicitudes'}
      </p>
      <div className="view-content" key={current}>
        {visible.length ? (
          <RequestList requests={visible} onSelect={onSelect} />
        ) : (
          <div className="card">
            <EmptyState title="No encontramos solicitudes" icon={query ? 'search' : 'inbox'}>
              <p>
                {query ? 'Prueba con otro nombre, ubicación o código.' : 'Elige otro estado para ver más solicitudes.'}
              </p>
              {(query || current !== 'todas') && (
                <>
                  <a
                    className="button button-secondary"
                    href={href({ page: 'solicitudes' })}
                    onClick={() => setSearch('')}
                  >
                    Quitar filtros
                  </a>
                </>
              )}
            </EmptyState>
          </div>
        )}
      </div>
    </>
  )
}
