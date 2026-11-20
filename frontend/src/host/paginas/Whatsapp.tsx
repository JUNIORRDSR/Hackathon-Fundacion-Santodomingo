import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { api } from '../api'
import { Conversacion, iniciales } from './Conversacion'

export interface ConversacionVista {
  telefono: string
  nombre: string | null
  control: string | null
  ultimo: string
  fecha: string
}

// El monitor reemplaza al simulador: se ve lo que hace el bot y se puede tomar el control (ADR-0007).
const REFRESCO_MS = 3000
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })

export function Whatsapp() {
  const [conversaciones, setConversaciones] = useState<ConversacionVista[]>([])
  const [elegido, setElegido] = useState<string>()
  const cargar = useCallback(() => {
    void api<ConversacionVista[]>('/whatsapp/conversaciones').then(setConversaciones)
  }, [])
  useEffect(() => {
    cargar()
    const intervalo = window.setInterval(cargar, REFRESCO_MS)
    return () => window.clearInterval(intervalo)
  }, [cargar])
  const actual = conversaciones.find((c) => c.telefono === elegido)

  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Lo que el bot conversa con cada vecino. Toma el control para responder tú."
      />
      <div className="monitor">
        <section className="card monitor-lista" aria-label="Conversaciones">
          <h2>
            Conversaciones <span className="monitor-cuenta">{conversaciones.length}</span>
          </h2>
          {conversaciones.length === 0 ? (
            <EmptyState title="Todavía no hay conversaciones" icon="chat">
              Escribe como un vecino desde la conversación.
            </EmptyState>
          ) : (
            <ul>
              {conversaciones.map((c) => (
                <li key={c.telefono}>
                  <button type="button" aria-pressed={c.telefono === elegido} onClick={() => setElegido(c.telefono)}>
                    <span className="monitor-avatar" aria-hidden="true">
                      {iniciales(c.nombre)}
                    </span>
                    <span className="monitor-resumen">
                      <span className="monitor-nombre">
                        <strong>{c.nombre ?? 'Sin registrar'}</strong>
                        <time dateTime={c.fecha}>{hora.format(new Date(c.fecha))}</time>
                      </span>
                      <span className="monitor-ultimo">{c.ultimo.replace(/\*/g, '')}</span>
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
          alCambiar={cargar}
          alSimular={setElegido}
        />
      </div>
    </>
  )
}
