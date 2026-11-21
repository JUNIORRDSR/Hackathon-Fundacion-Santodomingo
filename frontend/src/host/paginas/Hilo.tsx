import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
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
import '../../shadcn.css'

export interface MensajeVista {
  id: number
  direccion: 'entrante' | 'saliente'
  autor: 'vecino' | 'bot' | 'aviso' | 'coordinacion'
  texto: string
  estado: string | null
  fecha: string
}
const AUTOR = { vecino: 'Vecino', bot: 'Bot EcoConecta', aviso: 'Aviso automático', coordinacion: 'Coordinación' }
const ZONA = 'America/Bogota'
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' })
const dia = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
const clave = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA })

// WhatsApp marca la negrita con asteriscos: aquí se ve como negrita, no como símbolos.
function conNegritas(texto: string): ReactNode {
  return texto.split(/\*([^*\n]+)\*/).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte))
}

function nombreDelDia(fecha: Date) {
  const hoy = clave.format(new Date())
  return clave.format(fecha) === hoy ? 'Hoy' : dia.format(fecha)
}

// Los mensajes van por día, y los seguidos del mismo autor se agrupan bajo un solo nombre.
export function Hilo({
  mensajes,
  control,
  alLeer,
}: {
  mensajes: MensajeVista[]
  control: boolean
  alLeer: (hastaId: number) => Promise<void>
}) {
  const ultimoEntrante = mensajes.reduce(
    (ultimo, mensaje) => (mensaje.direccion === 'entrante' ? mensaje.id : ultimo),
    0,
  )
  const marcaLectura = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const marca = marcaLectura.current
    if (!marca || !ultimoEntrante) return
    let enVista = false
    const comprobarLectura = () => {
      if (enVista && document.visibilityState === 'visible' && getComputedStyle(marca).visibility === 'visible') {
        void alLeer(ultimoEntrante)
      }
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        enVista = entrada.isIntersecting && entrada.intersectionRatio === 1
        comprobarLectura()
      },
      { threshold: 1 },
    )
    observador.observe(marca)
    document.addEventListener('visibilitychange', comprobarLectura)
    return () => {
      enVista = false
      observador.disconnect()
      document.removeEventListener('visibilitychange', comprobarLectura)
    }
  }, [mensajes, ultimoEntrante, alLeer])

  return (
    <div className="shadcn hilo">
      <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={64}>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Mensajes de la conversación">
            <MessageScrollerContent className="flex flex-col gap-1.5 p-4">
              {mensajes.map((m, i) => {
                const fecha = new Date(m.fecha)
                const anterior = mensajes[i - 1]
                const nuevoDia = !anterior || clave.format(new Date(anterior.fecha)) !== clave.format(fecha)
                const seguido = !nuevoDia && anterior?.autor === m.autor
                const lado = m.direccion === 'entrante' ? 'start' : 'end'
                return (
                  <Fragment key={m.id}>
                    {nuevoDia && (
                      <Marker variant="separator" className="hilo-dia">
                        <MarkerContent>{nombreDelDia(fecha)}</MarkerContent>
                      </Marker>
                    )}
                    <MessageScrollerItem messageId={String(m.id)}>
                      <Message align={lado} className={seguido ? 'hilo-seguido' : 'hilo-primero'}>
                        <MessageContent>
                          {!seguido && <MessageHeader className="hilo-autor">{AUTOR[m.autor]}</MessageHeader>}
                          <Bubble align={lado} data-autor={m.autor}>
                            <BubbleContent className="whitespace-pre-line">{conNegritas(m.texto)}</BubbleContent>
                          </Bubble>
                          <MessageFooter className="hilo-hora" ref={m.id === ultimoEntrante ? marcaLectura : undefined}>
                            {hora.format(fecha)}
                            {m.estado === 'fallido' && ' · No se envió'}
                          </MessageFooter>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  </Fragment>
                )
              })}
              {control && (
                <Marker variant="separator" className="hilo-dia">
                  <MarkerContent>La coordinación tiene el control · el bot no responde</MarkerContent>
                </Marker>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            aria-label="Ir al último mensaje"
            title="Ir al último mensaje"
            size="icon"
            className="inset-s-auto inset-e-4 z-10 translate-x-0 rounded-full shadow-md rtl:translate-x-0"
          />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}
