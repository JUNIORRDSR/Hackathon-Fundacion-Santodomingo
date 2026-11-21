import type { ReactNode } from 'react'
import type { TrainingResource } from '../types'
import { GuideGrid, VideoCard } from '../components/capacitacion/TrainingCards'
import { ColorCode, Posters, VideoGallery } from '../components/capacitacion/Secciones'
import { SortingGame } from '../components/capacitacion/SortingGame'
import { canecas, carteles, videos } from '../components/capacitacion/contenido'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { MonarchMark } from '../components/ui/MonarchMark'

type Guide = TrainingResource & { tipo: 'guia' }
type OwnVideo = TrainingResource & { tipo: 'video' }

// La capacitación del barrio: el código de colores, las guías con avance, un juego, videos y los carteles del bot.
export function CapacitacionPage({
  resources,
  sample = false,
  publicHref,
  schedules,
  resourcesFeedback,
}: {
  resources: TrainingResource[]
  sample?: boolean
  publicHref?: string
  schedules?: ReactNode
  resourcesFeedback?: ReactNode
}) {
  const guides = resources.filter((item): item is Guide => item.tipo === 'guia')
  const ownVideos = resources.filter((item): item is OwnVideo => item.tipo === 'video' && !!item.url)
  const play = () => document.getElementById('juego-donde-va')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="capacitacion">
      <section className="training-hero cap-hero">
        <div className="cap-hero-texto">
          <p className="training-context">
            <Icon name="book" /> EcoConecta · Escuela del barrio
          </p>
          <h1 tabIndex={-1}>Capacitación ambiental</h1>
          <p className="cap-hero-lema">
            Separar bien es el primer paso: lo orgánico vuelve a la huerta y lo aprovechable, a las manos de los
            recicladores.
          </p>
          <ul className="cap-hero-cifras" aria-label="Lo que hay en esta página">
            <li>
              <strong>{canecas.length}</strong> canecas
            </li>
            <li>
              <strong>{guides.length}</strong> guías
            </li>
            <li>
              <strong>{videos.length + ownVideos.length}</strong> videos
            </li>
            <li>
              <strong>{carteles.length}</strong> carteles
            </li>
          </ul>
          <div className="cap-hero-acciones">
            <button type="button" className="button cap-hero-jugar" onClick={play}>
              <Icon name="spark" /> Jugar ¿Dónde va?
            </button>
            {publicHref && (
              <a className="button cap-hero-publica" href={publicHref}>
                Abrir vista pública
              </a>
            )}
          </div>
          {sample && (
            <span className="demo-note">
              <Icon name="info" /> Contenido de ejemplo
            </span>
          )}
        </div>
        <div className="cap-hero-arte" aria-hidden="true">
          <MonarchMark className="cap-hero-monarca" />
        </div>
      </section>
      {schedules}
      <ColorCode />
      {resourcesFeedback ??
        (guides.length ? (
          <GuideGrid guides={guides} />
        ) : (
          <div className="card">
            <EmptyState title="Aún no hay guías publicadas">
              Vuelve más adelante para consultar los materiales.
            </EmptyState>
          </div>
        ))}
      <SortingGame />
      <VideoGallery
        extra={ownVideos.map((item) => (
          <VideoCard key={item.id} resource={item} />
        ))}
      />
      <Posters />
    </div>
  )
}
