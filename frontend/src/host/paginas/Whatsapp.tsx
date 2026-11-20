import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { api } from '../api'
import { Conversacion } from './Conversacion'

export interface ConversacionVista {
  telefono: string
  nombre: string | null
  control: string | null
  ultimo: string
  fecha: string
}

// El monitor reemplaza al simulador: se ve lo que hace el bot y se puede tomar el control (ADR-0007).
const REFRESCO_MS = 3000

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
        <ul className="card monitor-lista" aria-label="Conversaciones">
          {conversaciones.length === 0 && (
            <EmptyState title="Todavía no hay conversaciones" icon="inbox">
              Escribe como un vecino con «Simular un vecino».
            </EmptyState>
          )}
          {conversaciones.map((c) => (
            <li key={c.telefono}>
              <button type="button" aria-pressed={c.telefono === elegido} onClick={() => setElegido(c.telefono)}>
                <span className="monitor-nombre">
                  {c.nombre ?? 'Sin registrar'}
                  {c.control && <span className="status-badge">Coordinación</span>}
                </span>
                <span className="monitor-telefono">{c.telefono}</span>
                <span className="monitor-ultimo">{c.ultimo}</span>
              </button>
            </li>
          ))}
        </ul>
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
