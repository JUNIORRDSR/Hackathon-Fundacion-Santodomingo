import { useState } from 'react'
import { compareAssignments, formatDate, formatWeight, localDate, wasteLabels } from '../labels'
import type { CollectionResult, Collector, Request, WasteType } from '../types'
import { PageHeader } from '../components/layout/Layout'
import { CollectionResultForm } from '../components/recolecciones/CollectionResultForm'
import { StatusBadge } from '../components/solicitudes/RequestList'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { DataTable } from '../components/ui/DataTable'
import { MotionPills } from '../components/ui/MotionPills'

type AssignedRequest = Request & { estado: 'asignada' }
type ResolvedRequest = Request & { estado: 'recolectada' | 'rechazada' }

export function RecoleccionesPage({
  requests,
  collectors,
  requestId,
  group,
  onSave,
  onOpen,
}: {
  requests: Request[]
  collectors: Collector[]
  requestId?: string
  group: WasteType
  onSave: (result: CollectionResult) => Promise<() => void>
  onOpen: (item: Request) => void
}) {
  const [view, setView] = useState<'programadas' | 'resultados'>('programadas')
  const [selectedId, setSelectedId] = useState(requestId)
  const [code, setCode] = useState('')
  const query = code.trim().toLowerCase()
  const matches = (item: Request) => !query || (item.codigo + ' ' + item.solicitante).toLowerCase().includes(query)
  const scheduled = requests
    .filter((item): item is AssignedRequest => item.estado === 'asignada' && matches(item))
    .sort((a, b) => compareAssignments(a.asignacion, b.asignacion))
  const resolved = requests
    .filter(
      (item): item is ResolvedRequest =>
        (item.estado === 'recolectada' || item.estado === 'rechazada') && matches(item),
    )
    .sort((a, b) => compareAssignments(b.asignacion, a.asignacion))
  const selected = scheduled.find((item) => item.id === selectedId)
  const today = localDate()

  const person = (item: Request) => (
    <>
      <p className="request-name">{item.solicitante}</p>
      <p className="request-location">{item.ubicacion}</p>
    </>
  )
  const when = ({ fecha, hora }: { fecha: string; hora?: string }) =>
    (fecha === today ? 'Hoy' : formatDate(fecha)) + ' · ' + (hora ?? 'Sin hora')

  function collectorName(id: string) {
    return collectors.find((item) => item.id === id)?.nombre ?? id
  }

  return (
    <>
      <PageHeader
        title="Recolecciones"
        description={'Consulta tu agenda y registra los resultados de ' + wasteLabels[group].toLowerCase() + '.'}
      />
      <div className="filter-bar">
        <MotionPills className="pills collection-filters" label="Filtrar recolecciones" active={view}>
          <button
            className="pill"
            type="button"
            aria-pressed={view === 'programadas'}
            onClick={() => setView('programadas')}
          >
            Programadas ({scheduled.length})
          </button>
          <button
            className="pill"
            type="button"
            aria-pressed={view === 'resultados'}
            onClick={() => setView('resultados')}
          >
            Resultados ({resolved.length})
          </button>
        </MotionPills>
        <form
          className="search-field"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            if (scheduled.length === 1) setSelectedId(scheduled[0].id)
          }}
        >
          <Icon name="search" />
          <input
            type="search"
            aria-label="Buscar por el código escrito en la bolsa"
            placeholder="Código de la bolsa (ORG-0001)"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </form>
      </div>
      <div className="view-content" key={view}>
        {view === 'programadas' ? (
          scheduled.length ? (
            <DataTable
              items={scheduled}
              rowKey={(item) => item.id}
              rowLabel={(item) => 'Validar la recolección ' + item.codigo + ' de ' + item.solicitante}
              onSelect={(item) => setSelectedId(item.id)}
              columns={[
                { header: 'Bolsa', width: '6.5rem', cell: (item) => <span className="data-code">{item.codigo}</span> },
                { header: 'Vecino', width: 'minmax(0, 2fr)', cell: person },
                { header: 'Encargado', cell: (item) => collectorName(item.asignacion.recolectorId) },
                { header: 'Cuándo', cell: (item) => when(item.asignacion) },
                { header: 'Estado', width: '8.5rem', cell: (item) => <StatusBadge status={item.estado} /> },
              ]}
            />
          ) : (
            <div className="card">
              <EmptyState title="No hay recolecciones programadas" icon="calendar">
                Asigna una solicitud para incluirla en tu agenda.
              </EmptyState>
            </div>
          )
        ) : resolved.length ? (
          <DataTable
            items={resolved}
            rowKey={(item) => item.id}
            rowLabel={(item) => 'Ver la solicitud ' + item.codigo + ' de ' + item.solicitante}
            onSelect={onOpen}
            columns={[
              { header: 'Bolsa', width: '6.5rem', cell: (item) => <span className="data-code">{item.codigo}</span> },
              { header: 'Vecino', width: 'minmax(0, 2fr)', cell: person },
              {
                header: 'Resultado',
                width: 'minmax(0, 1.4fr)',
                cell: (item) =>
                  item.estado === 'recolectada' ? formatWeight(item.resultado.pesoKg) : item.resultado.motivoRechazo,
              },
              {
                header: 'Puntos',
                width: '6rem',
                cell: (item) => (item.puntos ? <span className="data-points">+{item.puntos}</span> : '—'),
              },
              { header: 'Estado', width: '8.5rem', cell: (item) => <StatusBadge status={item.estado} /> },
            ]}
          />
        ) : (
          <div className="card">
            <EmptyState title="Aún no hay resultados" icon="scale">
              Valida una recolección desde la pestaña Programadas.
            </EmptyState>
          </div>
        )}
      </div>
      {selected && (
        <CollectionResultForm
          key={selected.id}
          request={selected}
          onClose={() => setSelectedId(undefined)}
          onSave={onSave}
        />
      )}
    </>
  )
}
