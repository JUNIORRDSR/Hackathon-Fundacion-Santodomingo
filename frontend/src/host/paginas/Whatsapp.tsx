import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { api } from '../api'
import { Conversacion, iniciales } from './Conversacion'

export interface ConversacionVista {
  telefono: string
  nombre: string | null
  control: string | null
  ultimo: string
  fecha: string
  sin_leer: number
}

// El monitor reemplaza al simulador: se ve lo que hace el bot y se puede tomar el control (ADR-0007).
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })
const normalizar = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

function soloLista({ data }: MessageEvent<string>) {
  try {
    return JSON.parse(data)?.solo_lista === true
  } catch {
    return false
  }
}

export function Whatsapp() {
  const [conversaciones, setConversaciones] = useState<ConversacionVista[]>([])
  const [elegido, setElegido] = useState<string>()
  const [busqueda, setBusqueda] = useState('')
  const [revisionHilo, setRevisionHilo] = useState(0)
  const [estadoConexion, setEstadoConexion] = useState('')
  const eventos = useRef<EventSource | null>(null)
  const solicitud = useRef<AbortController | null>(null)
  const cargar = useCallback(() => {
    solicitud.current?.abort()
    const actual = new AbortController()
    solicitud.current = actual
    void api<ConversacionVista[]>('/whatsapp/conversaciones', 'GET', undefined, actual.signal)
      .then((datos) => {
        if (!actual.signal.aborted) setConversaciones(datos)
      })
      .catch(() => {
        // El siguiente aviso del servidor o la reconexión vuelve a cargar la lista.
      })
  }, [])
  const actualizar = useCallback(
    (soloLista = false) => {
      cargar()
      if (!soloLista) setRevisionHilo((revision) => revision + 1)
    },
    [cargar],
  )
  const alCambiar = useCallback(
    (soloLista?: boolean) => {
      if (eventos.current?.readyState !== EventSource.OPEN) actualizar(soloLista)
    },
    [actualizar],
  )
  useEffect(() => {
    cargar()
    const fuente = new EventSource('/api/whatsapp/eventos')
    eventos.current = fuente
    fuente.onopen = () => {
      setEstadoConexion('')
      actualizar()
    }
    fuente.onerror = () => {
      setEstadoConexion(
        fuente.readyState === EventSource.CLOSED ? 'Actualización en vivo no disponible' : 'Reconectando…',
      )
    }
    fuente.addEventListener('cambio', (evento) => actualizar(soloLista(evento)))
    return () => {
      fuente.close()
      eventos.current = null
      solicitud.current?.abort()
    }
  }, [actualizar, cargar])
  const actual = conversaciones.find((c) => c.telefono === elegido)
  const termino = normalizar(busqueda)
  const numero = /^[+\d\s().-]+$/.test(termino) ? termino.replace(/\D/g, '') : ''
  const visibles = conversaciones.filter(
    (c) => normalizar(c.nombre ?? 'Sin registrar').includes(termino) || (numero && c.telefono.includes(numero)),
  )

  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Lo que el bot conversa con cada vecino. Toma el control para responder tú."
      />
      <div className="monitor">
        <section className="card monitor-lista" aria-label="Conversaciones">
          <h2>
            Conversaciones <span className="monitor-cuenta">{visibles.length}</span>
          </h2>
          <div className="search-field">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Buscar chats por nombre o teléfono"
              placeholder="Nombre o teléfono"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>
          {estadoConexion && (
            <p className="field-help monitor-conexion" role="status">
              {estadoConexion}
            </p>
          )}
          {visibles.length === 0 ? (
            <EmptyState title={termino ? 'No hay chats con esa búsqueda' : 'Todavía no hay conversaciones'}>
              {termino ? 'Prueba con otro nombre o teléfono.' : 'Escribe como un vecino desde la conversación.'}
            </EmptyState>
          ) : (
            <ul>
              {visibles.map((c) => (
                <li key={c.telefono}>
                  <button
                    type="button"
                    aria-pressed={c.telefono === elegido}
                    data-sin-leer={c.sin_leer > 0}
                    onClick={() => setElegido(c.telefono)}
                  >
                    <span className="monitor-avatar" aria-hidden="true">
                      {iniciales(c.nombre)}
                    </span>
                    <span className="monitor-resumen">
                      <span className="monitor-nombre">
                        <strong>{c.nombre ?? 'Sin registrar'}</strong>
                        <time dateTime={c.fecha}>{hora.format(new Date(c.fecha))}</time>
                      </span>
                      <span className="monitor-previa">
                        <span className="monitor-ultimo">{c.ultimo.replace(/\*/g, '')}</span>
                        {c.sin_leer > 0 && (
                          <span className="monitor-sin-leer">
                            <span aria-hidden="true">{c.sin_leer}</span>
                            <span className="sr-only">
                              {c.sin_leer} {c.sin_leer === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}
                            </span>
                          </span>
                        )}
                      </span>
                      {c.control && <span className="monitor-insignia">Coordinación al mando</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Conversacion
          key={actual?.telefono ?? 'nueva'}
          conversacion={actual}
          revision={revisionHilo}
          alCambiar={alCambiar}
          alSimular={setElegido}
        />
      </div>
    </>
  )
}
