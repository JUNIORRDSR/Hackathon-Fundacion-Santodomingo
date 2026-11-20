import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '../api'
import type { ConversacionVista } from './Whatsapp'

interface MensajeVista {
  direccion: 'entrante' | 'saliente'
  autor: 'vecino' | 'bot' | 'aviso' | 'coordinacion'
  texto: string
  estado: string | null
  fecha: string
}
const AUTOR = { vecino: 'Vecino', bot: 'Bot', aviso: 'Aviso automático', coordinacion: 'Coordinación' }
const COLOR = { vecino: 'muted', bot: 'secondary', aviso: 'outline', coordinacion: 'default' } as const
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })
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
    <section className="card flex min-h-0 flex-col gap-3">
      {conversacion && (
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>{conversacion.nombre ?? 'Sin registrar'}</strong>
            <p className="text-sm text-muted-foreground">{conversacion.telefono}</p>
          </div>
          {conversacion.control ? (
            <Button variant="outline" onClick={() => void control(false)}>
              Devolver al bot
            </Button>
          ) : (
            <Button onClick={() => void control(true)}>Tomar el control</Button>
          )}
        </header>
      )}
      <Hilo mensajes={mensajes} control={conversacion?.control ?? null} />
      <Redactar telefono={telefono} conControl={!!conversacion?.control} alEnviar={refrescar} alSimular={alSimular} />
    </section>
  )
}

function Hilo({ mensajes, control }: { mensajes: MensajeVista[]; control: string | null }) {
  return (
    <div className="min-h-64 flex-1">
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="flex flex-col gap-3 p-2">
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
                        {m.estado === 'fallido' && <Badge variant="destructive">No se envió</Badge>}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
              {control && (
                <MessageScrollerItem messageId="control">
                  <Marker variant="separator">
                    <MarkerContent>{control} tiene el control: el bot no responde</MarkerContent>
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
  const [texto, setTexto] = useState('')
  const [vecino, setVecino] = useState(telefono ?? '+573000000009')
  const [error, setError] = useState('')
  const enviar = (accion: () => Promise<unknown>) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      await accion()
      setTexto('')
      alEnviar()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const responder = enviar(() => api(ruta(telefono ?? '') + '/mensajes', 'POST', { texto }))
  const simular = enviar(async () => {
    await api('/whatsapp/simulador', 'POST', { telefono: vecino, texto })
    alSimular(vecino)
  })

  return (
    <Tabs defaultValue={conControl ? 'responder' : 'simular'}>
      <TabsList>
        <TabsTrigger value="responder">Responder como coordinación</TabsTrigger>
        <TabsTrigger value="simular">Simular un vecino</TabsTrigger>
      </TabsList>
      <TabsContent value="responder">
        <form className="flex gap-2" onSubmit={responder}>
          <Input
            value={texto}
            disabled={!conControl}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={conControl ? 'Escribe tu respuesta' : 'Toma el control para escribir'}
          />
          <Button type="submit" disabled={!conControl || !texto.trim()}>
            Enviar
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="simular">
        <form className="flex flex-wrap gap-2" onSubmit={simular}>
          <Input className="w-44" value={vecino} onChange={(e) => setVecino(e.target.value)} aria-label="Teléfono" />
          <Input className="flex-1" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Hola" />
          <Button type="submit" variant="secondary" disabled={!texto.trim()}>
            Enviar como vecino
          </Button>
        </form>
      </TabsContent>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Tabs>
  )
}
