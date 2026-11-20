import { useCallback, useEffect, useState } from 'react'
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

export function Conversacion({
  conversacion,
  alCambiar,
  alSimular,
}: {
  conversacion?: ConversacionVista
  alCambiar: () => void
  alSimular: (telefono: string) => void
}) {
  const telefono = conversacion?.telefono
  const [mensajes, setMensajes] = useState<MensajeVista[]>([])
  const cargar = useCallback(() => {
    if (telefono) void api<MensajeVista[]>(ruta(telefono) + '/mensajes').then(setMensajes)
  }, [telefono])
  useEffect(() => {
    cargar()
    const intervalo = window.setInterval(cargar, 3000)
    return () => window.clearInterval(intervalo)
  }, [cargar])
  const refrescar = () => (cargar(), alCambiar())
  const control = async (tomar: boolean) => {
    if (!telefono) return
    await api(ruta(telefono) + '/control', tomar ? 'POST' : 'DELETE')
    refrescar()
  }

  return (
    <section className="card monitor-hilo" aria-label="Conversación">
      {conversacion ? (
        <header className="monitor-cabecera">
          <span className="monitor-avatar" aria-hidden="true">
            {iniciales(conversacion.nombre)}
          </span>
          <div className="monitor-quien">
            <h2>{conversacion.nombre ?? 'Sin registrar'}</h2>
            <span className="monitor-estado" data-control={!!conversacion.control}>
              {conversacion.telefono} · {conversacion.control ? 'Responde la coordinación' : 'Responde el bot'}
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
      {conversacion && <Hilo mensajes={mensajes} control={!!conversacion.control} />}
      <Redactar telefono={telefono} conControl={!!conversacion?.control} alEnviar={refrescar} alSimular={alSimular} />
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
  const responder = modo === 'responder'
  const bloqueado = responder && !conControl
  useEffect(() => setModo(conControl ? 'responder' : 'simular'), [conControl])

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      if (responder) await api(ruta(telefono ?? '') + '/mensajes', 'POST', { texto })
      else await api('/whatsapp/simulador', 'POST', { telefono: vecino, texto })
      setTexto('')
      if (!responder) alSimular(vecino)
      alEnviar()
    } catch (e) {
      setError((e as Error).message)
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
          disabled={bloqueado}
          placeholder={bloqueado ? 'Toma el control para responder' : 'Escribe un mensaje'}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="monitor-enviar" aria-label="Enviar" disabled={!texto.trim() || bloqueado}>
          <Icon name="send" />
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}
