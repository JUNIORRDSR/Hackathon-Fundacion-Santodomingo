import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { api } from '../api'
import type { ConversacionVista } from './Whatsapp'
import '../../shadcn.css'

interface MensajeVista {
  direccion: 'entrante' | 'saliente'
  autor: 'vecino' | 'bot' | 'aviso' | 'coordinacion'
  texto: string
  estado: string | null
  fecha: string
}
const AUTOR = { vecino: 'Vecino', bot: 'Bot', aviso: 'Aviso automático', coordinacion: 'Coordinación' }
const COLOR = { vecino: 'secondary', bot: 'muted', aviso: 'outline', coordinacion: 'default' } as const
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })
const ruta = (telefono: string) => '/whatsapp/conversaciones/' + encodeURIComponent(telefono)

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
          <div>
            <h2>{conversacion.nombre ?? 'Sin registrar'}</h2>
            <span className="monitor-telefono">{conversacion.telefono}</span>
          </div>
          {conversacion.control ? (
            <button type="button" className="button button-secondary" onClick={() => void control(false)}>
              Devolver al bot
            </button>
          ) : (
            <button type="button" className="button button-primary" onClick={() => void control(true)}>
              Tomar el control
            </button>
          )}
        </header>
      ) : (
        <EmptyState title="Elige una conversación" icon="inbox">
          O escribe abajo como si fueras un vecino para probar el bot.
        </EmptyState>
      )}
      {conversacion && <Hilo mensajes={mensajes} control={conversacion.control} />}
      <Redactar telefono={telefono} conControl={!!conversacion?.control} alEnviar={refrescar} alSimular={alSimular} />
    </section>
  )
}

function Hilo({ mensajes, control }: { mensajes: MensajeVista[]; control: string | null }) {
  return (
    <div className="shadcn monitor-mensajes">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="flex flex-col gap-3 p-3">
              {mensajes.map((m, i) => (
                <MessageScrollerItem key={i} messageId={String(i)} scrollAnchor={m.direccion === 'entrante'}>
                  <Message align={m.direccion === 'entrante' ? 'start' : 'end'}>
                    <MessageContent>
                      <MessageHeader>{AUTOR[m.autor]}</MessageHeader>
                      <Bubble variant={COLOR[m.autor]} align={m.direccion === 'entrante' ? 'start' : 'end'}>
                        <BubbleContent className="whitespace-pre-line">{m.texto}</BubbleContent>
                      </Bubble>
                      <MessageFooter>
                        {hora.format(new Date(m.fecha))}
                        {m.estado === 'fallido' && ' · No se envió'}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {control && (
                <MessageScrollerItem messageId="control">
                  <Marker variant="separator">
                    <MarkerContent>La coordinación tiene el control: el bot no responde</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
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
    <form className="dialog-form" onSubmit={enviar}>
      <div className="pills" role="group" aria-label="Quién escribe">
        <button type="button" className="pill" aria-pressed={responder} onClick={() => setModo('responder')}>
          Responder como coordinación
        </button>
        <button type="button" className="pill" aria-pressed={!responder} onClick={() => setModo('simular')}>
          Simular un vecino
        </button>
      </div>
      <div className="monitor-redactar">
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
          disabled={responder && !conControl}
          placeholder={responder && !conControl ? 'Toma el control para escribir' : 'Escribe un mensaje'}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="button button-primary" disabled={!texto.trim() || (responder && !conControl)}>
          {responder ? 'Enviar' : 'Enviar como vecino'}
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}
