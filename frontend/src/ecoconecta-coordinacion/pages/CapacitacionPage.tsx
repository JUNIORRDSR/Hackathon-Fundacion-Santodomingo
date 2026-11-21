import type { TrainingResource } from '../types'
import { TrainingCard, VideoCard } from '../components/capacitacion/TrainingCards'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'

export function CapacitacionPage({
  resources,
  sample = false,
  publicHref,
}: {
  resources: TrainingResource[]
  sample?: boolean
  publicHref?: string
}) {
  return (
    <>
      <section className="training-hero">
        <div>
          <p className="training-context">
            <Icon name="book" /> EcoConecta · Guías de separación
          </p>
          <h1 tabIndex={-1}>Capacitación ambiental</h1>
          <p className="muted">Aprende a separar los residuos que generas en casa o en tu negocio.</p>
          {sample && (
            <span className="demo-note">
              <Icon name="info" /> Contenido de ejemplo
            </span>
          )}
        </div>
        {publicHref && (
          <a className="button button-secondary" href={publicHref}>
            Abrir vista pública
          </a>
        )}
      </section>
      {resources.length ? (
        <>
          <div className="training-grid">
            {resources
              .filter((item) => item.tipo === 'guia')
              .map((item) => (
                <TrainingCard key={item.id} resource={item} />
              ))}
          </div>
          {resources
            .filter((item) => item.tipo === 'video')
            .map((item) => (
              <VideoCard key={item.id} resource={item} />
            ))}
        </>
      ) : (
        <div className="card">
          <EmptyState title="Aún no hay guías publicadas">
            Vuelve más adelante para consultar los materiales.
          </EmptyState>
        </div>
      )}
    </>
  )
}
