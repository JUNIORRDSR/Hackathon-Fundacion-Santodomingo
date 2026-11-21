import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { api } from '../api'
import { Hilo } from './Hilo'
import type { MensajeVista } from './Hilo'
import type { ConversacionVista } from './Whatsapp'

const ruta = (telefono: string) => '/whatsapp/conversaciones/' + encodeURIComponent(telefono)
export const iniciales = (nombre: string | null) =>
  (nombre ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
// Quien no se ha registrado se muestra con el nombre de su perfil de WhatsApp, si Twilio lo envió (ADR-0016).
export const nombreVisible = (c: ConversacionVista) =>
  c.nombre ?? (c.perfil ? `${c.perfil} (sin registrar)` : 'Sin registrar')

export function Conversacion({
  conversacion,
  revision,
  alCambiar,
  alSimular,
}: {
  conversacion?: ConversacionVista
  revision: number
  alCambiar: (soloLista?: boolean) => void
  alSimular: (telefono: string) => void
}) {
  const telefono = conversacion?.telefono
  const [mensajes, setMensajes] = useState<MensajeVista[]>([])
  const solicitud = useRef<AbortController | null>(null)
  const ultimaLectura = useRef(0)
  const lecturaPendiente = useRef(0)
  const cargar = useCallback(() => {
    if (!telefono) return
    solicitud.current?.abort()
    const actual = new AbortController()
    solicitud.current = actual
    void api<MensajeVista[]>(ruta(telefono) + '/mensajes', 'GET', undefined, actual.signal)
      .then((datos) => {
        if (!actual.signal.aborted) setMensajes(datos)
      })
      .catch(() => {
        // El siguiente aviso del servidor o la reconexión vuelve a cargar el hilo.
      })
  }, [telefono])
  const marcarLeido = useCallback(
    async (hastaId: number) => {
      if (!telefono || hastaId <= Math.max(ultimaLectura.current, lecturaPendiente.current)) return
      lecturaPendiente.current = hastaId
      try {
        await api(ruta(telefono) + '/lectura', 'POST', { hasta_id: hastaId })
        ultimaLectura.current = Math.max(ultimaLectura.current, hastaId)
        alCambiar(true)
      } catch {
        // La lectura se reintenta si el mensaje sigue visible al refrescar.
      } finally {
        if (lecturaPendiente.current === hastaId) lecturaPendiente.current = 0
      }
    },
    [telefono, alCambiar],
  )
  useEffect(() => {
    cargar()
    return () => solicitud.current?.abort()
  }, [cargar, revision])
  const control = async (tomar: boolean) => {
    if (!telefono) return
    await api(ruta(telefono) + '/control', tomar ? 'POST' : 'DELETE')
    alCambiar()
  }
  const clasificar = async (mensajeId: number) => {
    try {
      await api<string[]>('/whatsapp/mensajes/' + mensajeId + '/clasificacion', 'POST')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo clasificar la foto.')
    }
    cargar()
  }

  return (
    <section className="card monitor-hilo" aria-label="Conversación">
      {conversacion ? (
        <header className="monitor-cabecera">
          <span className="monitor-avatar" aria-hidden="true">
            {iniciales(conversacion.nombre ?? conversacion.perfil)}
          </span>
          <div className="monitor-quien">
            <h2>{nombreVisible(conversacion)}</h2>
            <span className="monitor-estado" data-control={!!conversacion.control}>
              {conversacion.telefono}
              {conversacion.usuario && ` · @${conversacion.usuario}`}
              {conversacion.control ? ' · Responde la coordinación' : ' · Responde el bot'}
            </span>
          </div>
          {conversacion.control ? (
            <button type="button" className="button button-secondary" onClick={() => void control(false)}>
              <Icon name="spark" /> Devolver al bot
            </button>
          ) : (
            <button type="button" className="button button-primary" onClick={() => void control(true)}>
              <Icon name="user" /> Tomar el control
            </button>
          )}
        </header>
      ) : (
        <div className="monitor-vacio">
          <EmptyState title="Elige una conversación" icon="chat">
            O escribe abajo como si fueras un vecino para probar el bot.
          </EmptyState>
        </div>
      )}
      {conversacion && (
        <Hilo mensajes={mensajes} control={!!conversacion.control} alLeer={marcarLeido} alClasificar={clasificar} />
      )}
      <Redactar telefono={telefono} conControl={!!conversacion?.control} alEnviar={alCambiar} alSimular={alSimular} />
    </section>
  )
}

function Redactar({
  telefono,
  conControl,
  alEnviar,
  alSimular,
}: {
  telefono?: string
  conControl: boolean
  alEnviar: () => void
  alSimular: (telefono: string) => void
}) {
  const [modo, setModo] = useState<'responder' | 'simular'>(conControl ? 'responder' : 'simular')
  const [texto, setTexto] = useState('')
  const [vecino, setVecino] = useState(telefono ?? '+573000000009')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const responder = modo === 'responder'
  const bloqueado = responder && !conControl
  useEffect(() => setModo(conControl ? 'responder' : 'simular'), [conControl])

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      if (responder) await api(ruta(telefono ?? '') + '/mensajes', 'POST', { texto })
      else await api('/whatsapp/simulador', 'POST', { telefono: vecino, texto })
      setTexto('')
      if (!responder) alSimular(vecino)
      alEnviar()
    } catch (e) {
      setError((e as Error).message)
      if (responder) alEnviar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="monitor-redactar" onSubmit={enviar}>
      <MotionPills className="segmented-control" label="Quién escribe" active={modo}>
        <button type="button" aria-pressed={responder} onClick={() => setModo('responder')}>
          Como coordinación
        </button>
        <button type="button" aria-pressed={!responder} onClick={() => setModo('simular')}>
          Como vecino (prueba)
        </button>
      </MotionPills>
      <div className="monitor-campo">
        {!responder && (
          <input
            className="monitor-telefono-input"
            aria-label="Teléfono del vecino"
            value={vecino}
            onChange={(e) => setVecino(e.target.value)}
          />
        )}
        <input
          aria-label="Mensaje"
          value={texto}
          disabled={bloqueado || enviando}
          placeholder={bloqueado ? 'Toma el control para responder' : 'Escribe un mensaje'}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="submit"
          className="monitor-enviar"
          aria-label="Enviar"
          disabled={!texto.trim() || bloqueado || enviando}
        >
          <Icon name="send" />
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}
