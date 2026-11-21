import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { urlDeAdjunto } from '../api'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScrollerScrollable,
} from '@/components/ui/message-scroller'
import '../../shadcn.css'

export interface MensajeVista {
  id: number
  direccion: 'entrante' | 'saliente'
  autor: 'vecino' | 'bot' | 'aviso' | 'coordinacion'
  texto: string
  media_url: string | null
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
  alClasificar,
}: {
  mensajes: MensajeVista[]
  control: boolean
  alLeer: (hastaId: number) => Promise<void>
  alClasificar?: (mensajeId: number) => Promise<void>
}) {
  const ultimoEntrante = mensajes.reduce(
    (ultimo, mensaje) => (mensaje.direccion === 'entrante' ? mensaje.id : ultimo),
    0,
  )
  const marcaLectura = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const ultimoId = mensajes.at(-1)?.id ?? 0
  const hayMensajes = ultimoId !== 0

  useEffect(() => {
    if (!hayMensajes) return
    // El historial inicial se coloca al final antes de animar las actualizaciones en vivo.
    const frame = requestAnimationFrame(() => viewport.current?.setAttribute('data-seguimiento', 'true'))
    return () => cancelAnimationFrame(frame)
  }, [hayMensajes])

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
      <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollEdgeThreshold={16}>
        <MessageScroller>
          <MessageScrollerViewport
            ref={viewport}
            aria-label="Mensajes de la conversación"
            className="motion-safe:data-[seguimiento=true]:scroll-smooth"
          >
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
                            {m.texto && (
                              <BubbleContent className="whitespace-pre-line">{conNegritas(m.texto)}</BubbleContent>
                            )}
                            {m.media_url && <Adjunto mensaje={m} conControl={control} alClasificar={alClasificar} />}
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
          <IrAlUltimoMensaje ultimoId={ultimoId} />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )
}

function IrAlUltimoMensaje({ ultimoId }: { ultimoId: number }) {
  const { end: hayMensajesDebajo } = useMessageScrollerScrollable()
  const anterior = useRef(ultimoId)
  const boton = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const llegoMensaje = anterior.current > 0 && ultimoId > anterior.current
    anterior.current = ultimoId
    if (!llegoMensaje || !hayMensajesDebajo) return

    const flecha = boton.current?.querySelector('svg')
    if (!flecha || flecha.getAnimations().length > 0) return
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fotogramas = reducirMovimiento
      ? [{ opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }]
      : [{ transform: 'none' }, { transform: 'translateY(-4px)' }, { transform: 'none' }]
    flecha.animate(fotogramas, { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
  }, [ultimoId, hayMensajesDebajo])

  return (
    <MessageScrollerButton
      ref={boton}
      behavior="auto"
      aria-label="Ir al último mensaje"
      title="Ir al último mensaje"
      size="icon"
      className={
        'inset-s-auto inset-e-4 z-10 translate-x-0 rounded-full shadow-md' +
        ' motion-reduce:transition-none rtl:translate-x-0'
      }
    />
  )
}

// La foto o el audio del vecino. Con el control tomado, la coordinación decide:
// responde ella o pide la revisión de la IA.
function Adjunto({
  mensaje,
  conControl,
  alClasificar,
}: {
  mensaje: MensajeVista
  conControl: boolean
  alClasificar?: (mensajeId: number) => Promise<void>
}) {
  const [esAudio, setEsAudio] = useState(false)
  const [cargada, setCargada] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [clasificando, setClasificando] = useState(false)
  const miniatura = useRef<HTMLImageElement>(null)
  const grande = useRef<HTMLImageElement>(null)
  const src = urlDeAdjunto(mensaje.media_url ?? '')
  // La foto crece desde el chat y vuelve a su sitio: el nombre de la transición pasa de la miniatura a la
  // foto grande y el navegador interpola entre las dos. data-visor le dice al CSS qué captura dibujar.
  // Sin View Transitions, el visor abre sin movimiento.
  const verEnGrande = (abrir: boolean) => {
    const foto = miniatura.current
    if (!foto || !('startViewTransition' in document)) return setAbierta(abrir)
    const fase = abrir ? 'abre' : 'cierra'
    document.documentElement.dataset.visor = fase
    foto.style.viewTransitionName = abrir ? 'foto-vecino' : ''
    const transicion = document.startViewTransition(async () => {
      flushSync(() => setAbierta(abrir))
      foto.style.viewTransitionName = abrir ? '' : 'foto-vecino'
      await grande.current?.decode().catch(() => undefined)
    })
    transicion.ready.catch(() => undefined) // el navegador la omite si la pestaña está oculta: no es un error
    void transicion.finished.finally(() => {
      foto.style.viewTransitionName = ''
      if (document.documentElement.dataset.visor === fase) delete document.documentElement.dataset.visor
    })
  }
  const clasificar = async () => {
    if (!alClasificar) return
    setClasificando(true)
    try {
      await alClasificar(mensaje.id)
    } finally {
      setClasificando(false)
    }
  }
  if (esAudio) return <audio controls preload="none" src={src} style={{ maxWidth: '16rem' }} />
  return (
    <div className="hilo-adjunto">
      <Dialog open={abierta} onOpenChange={verEnGrande}>
        <DialogTrigger asChild>
          <button type="button" className="hilo-foto" aria-label="Ampliar la foto que mandó el vecino">
            {/* Sin carga diferida: el hilo oculta los mensajes fuera de vista y la foto esperaba al scroll. */}
            <img
              ref={miniatura}
              src={src}
              alt=""
              data-cargada={cargada || undefined}
              onLoad={() => setCargada(true)}
              onError={() => setEsAudio(true)}
            />
          </button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={(evento) => {
            // El foco vuelve a la miniatura sin desplazar el chat: un salto ahí se vería durante la transición.
            evento.preventDefault()
            miniatura.current?.parentElement?.focus({ preventScroll: true })
          }}
        >
          <DialogTitle className="sr-only">Foto que mandó el vecino</DialogTitle>
          <img ref={grande} src={src} alt="Foto que mandó el vecino" className="foto-grande" />
        </DialogContent>
      </Dialog>
      {conControl && mensaje.direccion === 'entrante' && alClasificar && (
        <button
          type="button"
          className="button button-secondary"
          disabled={clasificando}
          onClick={() => void clasificar()}
        >
          {clasificando ? 'Clasificando…' : 'Clasificar con IA'}
        </button>
      )}
    </div>
  )
}
