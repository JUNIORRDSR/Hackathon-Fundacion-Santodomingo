import { useState } from 'react'
import type { TrainingResource } from '../../types'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import { SectionHeader } from './Secciones'

type Guide = TrainingResource & { tipo: 'guia' }
const categoryIcons: Record<TrainingResource['categoria'], IconName> = {
  organico: 'leaf',
  reciclable: 'recycle',
  mezclas: 'alert',
  practicas: 'checkCircle',
}
// El avance vive en este navegador: es una ayuda para quien aprende, no un dato de la operación.
const STORAGE = 'ecoconecta-guias-aprendidas'
function readLearned(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
  } catch {
    return []
  }
}

// Las guías de la fundación como tarjetas: cada una abre sus pasos y se marca como aprendida.
export function GuideGrid({ guides }: { guides: Guide[] }) {
  const [learned, setLearned] = useState(readLearned)
  const [open, setOpen] = useState<Guide>()
  const done = guides.filter((guide) => learned.includes(guide.id)).length
  function markLearned(id: string) {
    const next = [...new Set([...learned, id])]
    setLearned(next)
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next))
    } catch {
      // Sin almacenamiento (navegación privada) el avance dura lo que dure la página.
    }
  }
  return (
    <section className="cap-seccion" aria-labelledby="guias-titulo">
      <div className="cap-cabeza-fila">
        <SectionHeader kicker="Guías paso a paso" title="Separa como un experto" id="guias-titulo">
          <p>Lecturas de un minuto con lo esencial para tu casa o tu negocio.</p>
        </SectionHeader>
        <div className="cap-avance">
          <span>
            <strong>{done}</strong> de {guides.length} guías aprendidas
          </span>
          <progress value={done} max={guides.length} aria-label="Guías aprendidas" />
        </div>
      </div>
      <ul className="guias">
        {guides.map((guide, index) => {
          const isLearned = learned.includes(guide.id)
          return (
            <li key={guide.id}>
              <button type="button" className="card guia" data-aprendida={isLearned} onClick={() => setOpen(guide)}>
                <span className="guia-arriba">
                  <span className="icon-tile">
                    <Icon name={categoryIcons[guide.categoria] ?? 'book'} />
                  </span>
                  <span className="guia-numero">Guía {index + 1}</span>
                </span>
                <h3>{guide.titulo}</h3>
                <p>{guide.descripcion}</p>
                <span className="guia-pie">
                  <span>{guide.pasos.length ? guide.pasos.length + ' pasos' : 'Lectura breve'}</span>
                  <span className="guia-estado">
                    {isLearned ? (
                      <>
                        <Icon name="checkCircle" /> Aprendida
                      </>
                    ) : (
                      <>
                        Abrir guía <Icon name="chevron" />
                      </>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <Modal title={open.titulo} onClose={() => setOpen(undefined)}>
          {(close) => (
            <div className="guia-detalle">
              <p className="muted">{open.descripcion}</p>
              {open.pasos.length > 0 && (
                <ol className="guia-pasos">
                  {open.pasos.map((step, index) => (
                    <li key={step}>
                      <span aria-hidden="true">{index + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              )}
              {open.url && (
                <a className="text-link" href={open.url}>
                  Consultar material complementario
                </a>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    markLearned(open.id)
                    void close()
                  }}
                >
                  <Icon name="check" /> {learned.includes(open.id) ? 'Listo' : 'Ya la aprendí'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  )
}

// Un video propio de la fundación, cuando el contenido trae su archivo: se reproduce aquí mismo.
export function VideoCard({ resource }: { resource: TrainingResource & { tipo: 'video' } }) {
  const [failed, setFailed] = useState(false)
  if (!resource.url) return null
  return (
    <section className="card video-card">
      <div className="video-intro">
        <span className="icon-tile">
          <Icon name="play" />
        </span>
        <div>
          <h2>{resource.titulo}</h2>
          <p>{resource.descripcion}</p>
        </div>
      </div>
      {failed ? (
        <div className="video-placeholder" role="alert">
          <p>No se pudo cargar el video.</p>
        </div>
      ) : (
        <video src={resource.url} controls preload="none" playsInline onError={() => setFailed(true)}>
          {resource.subtitulosUrl && (
            <track src={resource.subtitulosUrl} kind="captions" srcLang="es" label="Español" default />
          )}
          Tu navegador no puede reproducir este video.
        </video>
      )}
      {resource.transcripcion && (
        <details className="guide-details">
          <summary>
            Leer transcripción <Icon name="chevron" />
          </summary>
          <p>{resource.transcripcion}</p>
        </details>
      )}
    </section>
  )
}
