import type { ReactNode } from 'react'
import { Layout } from '../components/layout/Layout'
import { routeDays, routeHours } from '../components/recolecciones/routeSchedule'
import { ErrorMessage } from '../components/ui/Feedback'
import { groupLabels } from '../labels'
import { sampleTraining } from '../mocks/training'
import type { EcoLink } from '../routes'
import { useRepositoryQuery } from '../services/useCoordinatorData'
import type { PublicCollectionRoute, TrainingResource } from '../types'
import { CapacitacionPage } from './CapacitacionPage'

type LoadRoutes = (signal: AbortSignal) => Promise<PublicCollectionRoute[]>

export function PublicTrainingModule({
  resources,
  href,
  loadRoutes,
  resourcesFeedback,
}: {
  resources?: TrainingResource[]
  href: EcoLink
  loadRoutes?: LoadRoutes
  resourcesFeedback?: ReactNode
}) {
  return (
    <Layout page="capacitacion" href={href} demo={false}>
      <CapacitacionPage
        resources={resources ?? sampleTraining}
        sample={!resources}
        schedules={loadRoutes && <PublicRoutes load={loadRoutes} />}
        resourcesFeedback={resourcesFeedback}
      />
    </Layout>
  )
}

function PublicRoutes({ load }: { load: LoadRoutes }) {
  const { state, reload } = useRepositoryQuery(load)
  return (
    <section className="card public-routes" aria-labelledby="public-routes-title">
      <h2 id="public-routes-title">Rutas y horarios de recolección</h2>
      {!state ? (
        <p role="status">Cargando horarios…</p>
      ) : state.status === 'error' ? (
        <ErrorMessage message="No se pudieron cargar los horarios." retry={reload} />
      ) : state.data.length ? (
        <ul className="public-routes-grid">
          {state.data.map((route) => (
            <li key={route.id}>
              <p className="muted">
                {groupLabels[route.grupo]}
                {route.conjunto && ' · ' + route.zona}
              </p>
              <h3>{route.conjunto ?? route.zona}</h3>
              {route.nombre !== (route.conjunto ?? route.zona) && <p>{route.nombre}</p>}
              <p>
                {routeDays(route.dias)} · <strong>{routeHours(route)}</strong>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Aún no hay horarios publicados para Villas de San Pablo.</p>
      )}
    </section>
  )
}
