import { useState } from 'react'
import { compareAssignments, formatDate, formatWeight, localDate, wasteLabels } from '../labels'
import type { CollectionResult, Collector, Request, WasteType } from '../types'
import { PageHeader } from '../components/layout/Layout'
import { CollectionResultForm } from '../components/recolecciones/CollectionResultForm'
import { StatusBadge } from '../components/solicitudes/RequestList'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'

type AssignedRequest = Request & { estado: 'asignada' }
type ResolvedRequest = Request & { estado: 'recolectada' | 'rechazada' }

export function RecoleccionesPage({ requests, collectors, requestId, group, onSave }: {
  requests: Request[]; collectors: Collector[]; requestId?: string;
  group: WasteType; onSave: (result: CollectionResult) => Promise<void>
}) {
  const [view, setView] = useState<'programadas' | 'resultados'>('programadas')
  const [selectedId, setSelectedId] = useState(requestId)
  const scheduled = requests.filter((item): item is AssignedRequest => item.estado === 'asignada')
    .sort((a, b) => compareAssignments(a.asignacion, b.asignacion))
  const resolved = requests.filter((item): item is ResolvedRequest => item.estado === 'recolectada' || item.estado === 'rechazada')
    .sort((a, b) => compareAssignments(b.asignacion, a.asignacion))
  const selected = scheduled.find((item) => item.id === selectedId)
  const today = localDate()

  function collectorName(id: string) {
    return collectors.find((item) => item.id === id)?.nombre ?? id
  }

  return (
    <>
      <PageHeader title="Recolecciones" description={'Consulta tu agenda y registra los resultados de ' + wasteLabels[group].toLowerCase() + '.'} />
      <div className="pills collection-filters" role="group" aria-label="Filtrar recolecciones">
        <button className="pill" type="button" aria-pressed={view === 'programadas'} onClick={() => setView('programadas')}>Programadas ({scheduled.length})</button>
        <button className="pill" type="button" aria-pressed={view === 'resultados'} onClick={() => setView('resultados')}>Resultados ({resolved.length})</button>
      </div>
      <div className="view-content" key={view}>
        {view === 'programadas' ? (
          scheduled.length ? (
            <ul className="collection-grid">
              {scheduled.map((item) => (
                <li className="card collection-card" key={item.id}>
                  <div className="collection-card-top">
                    <span className="icon-tile"><Icon name="truck" /></span>
                    <StatusBadge status={item.estado} />
                  </div>
                  <div><p className="request-id">{item.id}</p><h2>{item.solicitante}</h2></div>
                  <div className="small-details">
                    <span><Icon name="pin" />{item.ubicacion}</span>
                    <span><Icon name="calendar" /><time dateTime={item.asignacion.fecha}>
                      {item.asignacion.fecha === today ? 'Hoy · ' : ''}{formatDate(item.asignacion.fecha, true)}
                      {' · ' + (item.asignacion.hora ?? 'Sin hora')}
                    </time></span>
                    <span><Icon name="user" />{collectorName(item.asignacion.recolectorId)}</span>
                  </div>
                  <button type="button" className="button button-primary"
                    aria-label={'Registrar resultado de ' + item.solicitante}
                    onClick={() => setSelectedId(item.id)}>Registrar resultado</button>
                </li>
              ))}
            </ul>
          ) : <div className="card"><EmptyState title="No hay recolecciones programadas" icon="calendar">Asigna una solicitud para incluirla en tu agenda.</EmptyState></div>
        ) : (
          resolved.length ? (
            <ul className="card history-list divide-y divide-[var(--line)]">
              {resolved.map((item) => (
                <li key={item.id}>
                  <div>
                    <span className="request-id">{item.id} · {formatDate(item.asignacion.fecha)}{item.asignacion.hora && ' · ' + item.asignacion.hora}</span>
                    <h2>{item.solicitante}</h2>
                    <p>{item.estado === 'recolectada' ? formatWeight(item.resultado.pesoKg) : item.resultado.motivoRechazo}</p>
                  </div>
                  <StatusBadge status={item.estado} />
                </li>
              ))}
            </ul>
          ) : <div className="card"><EmptyState title="Aún no hay resultados" icon="scale">Registra una recolección desde la pestaña Programadas.</EmptyState></div>
        )}
      </div>
      {selected && <CollectionResultForm key={selected.id} request={selected} onClose={() => setSelectedId(undefined)}
        onSave={async (result) => {
          await onSave(result)
          setSelectedId(undefined)
        }} />}
    </>
  )
}
