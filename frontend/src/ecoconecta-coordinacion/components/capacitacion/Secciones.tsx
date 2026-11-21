import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import { canecas, carteles, videos } from './contenido'
import type { Caneca } from './contenido'

export function SectionHeader({
  kicker,
  title,
  id,
  children,
}: {
  kicker: string
  title: string
  id: string
  children?: ReactNode
}) {
  return (
    <header className="cap-cabeza">
      <p className="cap-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      {children}
    </header>
  )
}

// La caneca dibujada: tapa, cuerpo y tres líneas; el color sale de la clase (blanca, verde o negra).
export function BinIcon({ type }: { type: Caneca }) {
  return (
    <svg viewBox="0 0 64 72" className={'caneca-svg caneca-svg-' + type} aria-hidden="true">
      <rect x="23" y="2" width="18" height="7" rx="3" className="caneca-tapa" />
      <rect x="6" y="8" width="52" height="9" rx="3.5" className="caneca-tapa" />
      <path d="M11 20h42l-4.2 45.4a5 5 0 0 1-5 4.6H20.2a5 5 0 0 1-5-4.6Z" className="caneca-cuerpo" />
      <path d="M24 31v28M32 31v28M40 31v28" className="caneca-lineas" />
    </svg>
  )
}

export function ColorCode() {
  return (
    <section className="cap-seccion" aria-labelledby="codigo-titulo">
      <SectionHeader kicker="Resolución 2184 de 2019" title="El código de colores en 30 segundos" id="codigo-titulo">
        <p>
          Desde 2021 toda Colombia separa en tres canecas. En Villas de San Pablo, la verde y la blanca tienen quién las
          recoja y las convierta en abono o en material nuevo.
        </p>
      </SectionHeader>
      <ul className="canecas">
        {canecas.map((caneca) => (
          <li key={caneca.id} className={'card caneca caneca-' + caneca.id}>
            <div className="caneca-cabeza">
              <BinIcon type={caneca.id} />
              <div>
                <h3>{caneca.nombre}</h3>
                <p className="caneca-que">{caneca.que}</p>
              </div>
            </div>
            <ul className="caneca-ejemplos">
              {caneca.ejemplos.map((ejemplo) => (
                <li key={ejemplo}>
                  <Icon name="check" />
                  {ejemplo}
                </li>
              ))}
            </ul>
            <p className="caneca-destino">{caneca.destino}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Portada liviana: la imagen de YouTube y el reproductor solo cuando la persona toca (sin cargar nada antes).
export function VideoGallery({ extra }: { extra?: ReactNode }) {
  const [playing, setPlaying] = useState<string>()
  return (
    <section className="cap-seccion" aria-labelledby="videos-titulo">
      <SectionHeader kicker="Videos cortos" title="Aprende viendo" id="videos-titulo">
        <p>Para ver en familia, en el negocio o con el equipo de la huerta.</p>
      </SectionHeader>
      <ul className="cap-videos">
        {videos.map((video) => (
          <li key={video.id} className="card cap-video">
            {playing === video.id ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
                title={video.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                className="cap-video-portada"
                aria-label={'Ver el video: ' + video.titulo}
                onClick={() => setPlaying(video.id)}
              >
                <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" />
                <span className="cap-video-play">
                  <Icon name="play" />
                </span>
                <span className="cap-video-tema">{video.tema}</span>
              </button>
            )}
            <div className="cap-video-texto">
              <h3>{video.titulo}</h3>
              <p>{video.fuente}</p>
            </div>
          </li>
        ))}
      </ul>
      {extra}
    </section>
  )
}

export function Posters() {
  const [open, setOpen] = useState<(typeof carteles)[number]>()
  return (
    <section className="cap-seccion" aria-labelledby="carteles-titulo">
      <SectionHeader kicker="Infografías" title="Carteles para compartir" id="carteles-titulo">
        <p>Los mismos que el asistente de WhatsApp les envía a los vecinos. Tócalos para verlos en grande.</p>
      </SectionHeader>
      <ul className="carteles">
        {carteles.map((cartel) => (
          <li key={cartel.archivo}>
            <button type="button" className="card cartel" onClick={() => setOpen(cartel)}>
              <img src={cartel.url} alt="" loading="lazy" width="561" height="701" />
              <span className="cartel-texto">
                <strong>{cartel.titulo}</strong>
                <span>{cartel.texto}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <Modal title={open.titulo} onClose={() => setOpen(undefined)}>
          {() => (
            <div className="cartel-grande">
              <img src={open.url} alt={open.titulo + ': ' + open.texto} />
              <a className="button button-secondary" href={open.url} download={open.archivo}>
                Descargar cartel
              </a>
            </div>
          )}
        </Modal>
      )}
    </section>
  )
}
