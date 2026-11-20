import { useState } from 'react'
import type { TrainingResource } from '../../types'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'

const categoryIcons: Record<TrainingResource['categoria'], IconName> = {
  organico: 'leaf',
  aprovechable: 'recycle',
  mezclas: 'alert',
  practicas: 'checkCircle',
}

export function TrainingCard({ resource }: { resource: TrainingResource & { tipo: 'guia' } }) {
  return (
    <article className="card training-card">
      <span className="icon-tile"><Icon name={categoryIcons[resource.categoria]} /></span>
      <h2>{resource.titulo}</h2>
      <p>{resource.descripcion}</p>
      <details className="guide-details">
        <summary>Leer guía <Icon name="chevron" /></summary>
        <ol>{resource.pasos.map((step) => <li key={step}>{step}</li>)}</ol>
        {resource.url && <a className="text-link" href={resource.url}>Consultar material complementario</a>}
      </details>
    </article>
  )
}

export function VideoCard({ resource }: { resource: TrainingResource & { tipo: 'video' } }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  return (
    <section className="card video-card">
      <div className="video-intro">
        <span className="icon-tile"><Icon name="play" /></span>
        <div><h2>{resource.titulo}</h2><p>{resource.descripcion}</p></div>
      </div>
      {resource.url && !failed && (
        <video key={attempt} src={resource.url} controls preload="none" playsInline
          aria-label={resource.titulo} onError={() => setFailed(true)}>
          {resource.subtitulosUrl && <track src={resource.subtitulosUrl} kind="captions" srcLang="es" label="Español" default />}
          Tu navegador no puede reproducir este video.
        </video>
      )}
      {!resource.url && (
        <div className="video-placeholder"><Icon name="play" /><span>Video pendiente de publicación</span></div>
      )}
      {failed && <div className="video-placeholder" role="alert">
        <p>No se pudo cargar el video.</p>
        <button type="button" className="button button-surface" onClick={() => {
          setAttempt((value) => value + 1)
          setFailed(false)
        }}>Reintentar</button>
      </div>}
      {resource.transcripcion && (
        <details className="guide-details">
          <summary>Leer transcripción <Icon name="chevron" /></summary>
          <p>{resource.transcripcion}</p>
        </details>
      )}
    </section>
  )
}
