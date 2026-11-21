import { useCallback, useId, useState } from 'react'
import type { EcoLink } from '../../routes'
import { useRepositoryQuery } from '../../services/useCoordinatorData'
import type {
  CollectionRoute,
  CollectionRouteInput,
  Collector,
  Coordinator,
  CoordinatorRepository,
  Zone,
} from '../../types'
import { DataTable } from '../ui/DataTable'
import { EmptyState, ErrorMessage, LoadingState } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { RouteForm } from './RouteForm'
import { routeDays, routeHours } from './routeSchedule'
import { routeSectors } from './routePlaces'

export function CollectionRoutes({
  coordinator,
  repository,
  collectors,
  zones,
  initialCollector,
  href,
}: {
  coordinator: Coordinator
  repository: CoordinatorRepository
  collectors: Collector[]
  zones: Zone[]
  initialCollector?: string
  href: EcoLink
}) {
  const id = useId()
  const [zoneId, setZoneId] = useState('')
  const [collectorId, setCollectorId] = useState(initialCollector ?? '')
  const [editing, setEditing] = useState<CollectionRoute | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const load = useCallback(
    (signal: AbortSignal) => repository.listRoutes(coordinator, signal),
    [repository, coordinator],
  )
  const { state, reload, update } = useRepositoryQuery(load)
  const routes = state?.status === 'ready' ? state.data : []
  const collectorById = new Map(collectors.map((item) => [item.id, item]))
  const zoneById = new Map(zones.map((item) => [item.id, item]))
  const filteredCollector = collectorById.has(collectorId) ? collectorId : ''
  const activeCollectors = collectors.filter((item) => item.activo)
  const activeZone = zones.some((item) => item.activo !== false)
  const selectedCollector = collectorById.get(filteredCollector)
  const selectedZone = zoneById.get(zoneId)
  const visible = routes
    .filter(
      (route) =>
        (!zoneId || route.zonaId === zoneId) && (!filteredCollector || route.encargadoId === filteredCollector),
    )
    .sort(
      (a, b) =>
        (zoneById.get(a.zonaId)?.nombre ?? '').localeCompare(zoneById.get(b.zonaId)?.nombre ?? '', 'es') ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )

  async function save(input: CollectionRouteInput, id?: string) {
    const saved = await repository.saveRoute(coordinator, input, id)
    return () => {
      update((items) => (id ? items.map((item) => (item.id === id ? saved : item)) : [...items, saved]))
      setNotice(id ? 'Ruta actualizada.' : 'Ruta creada.')
    }
  }

  function territory(route: CollectionRoute) {
    const zone = zoneById.get(route.zonaId)
    const sector = zone?.conjuntos?.find((item) => item.id === route.conjuntoId)
    if (!zone) return '—'
    if (!sector) return zone.nombre
    const sectors = routeSectors(zone, sector.id)
    return sectors.length > 1 && zone.nombre !== sector.nombre ? `${zone.nombre} · ${sector.nombre}` : sector.nombre
  }

  return (
    <section className="routes-panel" aria-label="Rutas de recolección">
      <div className="card routes-toolbar">
        <div>
          <h2>Rutas de recolección</h2>
          <p className="muted">Organiza los recorridos semanales por etapa o sector de Villas de San Pablo.</p>
        </div>
        <div className="routes-actions">
          <a href={href({ page: 'recolectores' })} className="button button-secondary">
            Ver recolectores
          </a>
          <a href={href({ page: 'habilitar', recordsView: 'lugares' })} className="button button-secondary">
            Ver lugares
          </a>
          <button
            type="button"
            className="button button-primary"
            disabled={state?.status !== 'ready' || !activeCollectors.length || !activeZone}
            onClick={() => {
              setNotice('')
              setEditing('new')
            }}
          >
            <Icon name="plus" /> Nueva ruta
          </button>
        </div>
        {(!activeCollectors.length || !activeZone) && (
          <p className="muted routes-toolbar-note">
            {!activeCollectors.length
              ? 'Agrega o activa un integrante en Recolectores para crear una ruta.'
              : 'Activa una zona en Registros para crear una ruta.'}
          </p>
        )}
      </div>
      {state?.status === 'ready' && (routes.length > 0 || selectedCollector) && (
        <div className="route-filters">
          <div className="field">
            <label htmlFor={id + '-zone'}>Etapa o zona</label>
            <select id={id + '-zone'} value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
              <option value="">Todas las zonas</option>
              {zones.map((zone) => (
                <option value={zone.id} key={zone.id}>
                  {zone.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={id + '-collector'}>Responsable</label>
            <select
              id={id + '-collector'}
              value={filteredCollector}
              onChange={(event) => setCollectorId(event.target.value)}
            >
              <option value="">Todo el equipo</option>
              {collectors.map((collector) => (
                <option value={collector.id} key={collector.id}>
                  {collector.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div role="status" className={notice ? 'route-notice' : 'sr-only'}>
        {notice}
      </div>
      {!state ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : state.status === 'error' ? (
        <div className="card">
          <ErrorMessage message={state.error} retry={reload} />
        </div>
      ) : visible.length ? (
        <DataTable
          items={visible}
          rowKey={(route) => route.id}
          rowLabel={(route) => 'Editar ruta ' + route.nombre}
          onSelect={(route) => {
            setNotice('')
            setEditing(route)
          }}
          columns={[
            {
              header: 'Ruta y territorio',
              width: 'minmax(0, 1.5fr)',
              cell: (route) => (
                <>
                  <p className="request-name">{route.nombre}</p>
                  <p className="request-location">{territory(route)}</p>
                </>
              ),
            },
            {
              header: 'Horario semanal',
              width: 'minmax(0, 1.25fr)',
              cell: (route) => (
                <>
                  <p>{routeDays(route.dias)}</p>
                  <p className="request-location">{routeHours(route)}</p>
                </>
              ),
            },
            { header: 'Responsable', cell: (route) => collectorById.get(route.encargadoId)?.nombre ?? '—' },
            {
              header: 'Visibilidad',
              cell: (route) => (
                <span className="status-badge">
                  {route.publicada ? (route.disponible ? 'Publicada' : 'Suspendida') : 'Interna'}
                </span>
              ),
            },
          ]}
        />
      ) : (
        <div className="card">
          <EmptyState title={routes.length ? 'Sin rutas con estos filtros' : 'Aún no hay rutas'}>
            {selectedCollector && !visible.length
              ? `Puedes crear una ruta para ${selectedCollector.nombre} o elegir otro responsable.`
              : routes.length
                ? 'Cambia la zona o el responsable.'
                : 'Crea una ruta para registrar su horario habitual.'}
          </EmptyState>
        </div>
      )}
      {editing && (
        <RouteForm
          route={editing === 'new' ? undefined : editing}
          collectors={collectors}
          zones={zones}
          initialCollector={
            (selectedCollector?.activo && selectedCollector.id) ||
            (activeCollectors.length === 1 ? activeCollectors[0].id : '')
          }
          initialZone={selectedZone && selectedZone.activo !== false ? selectedZone.id : ''}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </section>
  )
}
