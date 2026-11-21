import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { DataTable } from '../../ecoconecta-coordinacion/components/ui/DataTable'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import type { IconName } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { api } from '../api'
import { Premios } from './Premios'

type Estado = 'pedido' | 'entregado' | 'cancelado'
interface Canje {
  codigo: string
  solicitante_nombre: string
  telefono: string
  premio: string
  costo: number
  estado: Estado
  pedido_en: string
  cerrado_en: string | null
}
const ESTADOS: Record<Estado, { texto: string; uno: string; icono: IconName }> = {
  pedido: { texto: 'Por entregar', uno: 'Por entregar', icono: 'clock' },
  entregado: { texto: 'Entregados', uno: 'Entregado', icono: 'check' },
  cancelado: { texto: 'Cancelados', uno: 'Cancelado', icono: 'close' },
}
const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
const Insignia = ({ estado }: { estado: Estado }) => (
  <span className="status-badge">
    <Icon name={ESTADOS[estado].icono} /> {ESTADOS[estado].uno}
  </span>
)

// ADR-0008: el vecino pide el canje por WhatsApp y muestra el código; aquí se entrega y se descuentan los puntos.
export function Canjes() {
  const [vista, setVista] = useState<'pedidos' | 'premios'>('pedidos')
  const [nuevoPremio, setNuevoPremio] = useState(0)
  return (
    <>
      <PageHeader
        title="Canjes"
        description="El vecino muestra su código CAN en la huerta y aquí se entrega el premio."
        action={
          vista === 'premios' && (
            <button type="button" className="button button-primary" onClick={() => setNuevoPremio((n) => n + 1)}>
              <Icon name="plus" /> Agregar premio
            </button>
          )
        }
      />
      <MotionPills className="segmented-control canje-vista" label="Pedidos o premios" active={vista}>
        <button type="button" aria-pressed={vista === 'pedidos'} onClick={() => setVista('pedidos')}>
          Pedidos
        </button>
        <button type="button" aria-pressed={vista === 'premios'} onClick={() => setVista('premios')}>
          Premios
        </button>
      </MotionPills>
      {vista === 'pedidos' ? <Pedidos /> : <Premios nuevo={nuevoPremio} />}
    </>
  )
}

function Pedidos() {
  const [estado, setEstado] = useState<Estado>('pedido')
  const [buscar, setBuscar] = useState('')
  const [todos, setTodos] = useState<Canje[]>()
  const [elegido, setElegido] = useState<Canje>()
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const cargar = useCallback(() => {
    api<Canje[]>('/puntos/canjes')
      .then(setTodos)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  const lista = todos ?? []
  const texto = buscar.trim().toLowerCase()
  const visibles = lista.filter(
    (c) =>
      c.estado === estado && [c.codigo, c.solicitante_nombre, c.premio].some((v) => v.toLowerCase().includes(texto)),
  )
  return (
    <>
      <div className="filter-bar">
        <MotionPills className="pills" label="Filtrar por estado" active={estado}>
          {(Object.keys(ESTADOS) as Estado[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className="pill"
              aria-pressed={estado === valor}
              onClick={() => setEstado(valor)}
            >
              {ESTADOS[valor].texto} ({lista.filter((c) => c.estado === valor).length})
            </button>
          ))}
        </MotionPills>
        <div className="search-field">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Buscar por código, vecino o premio"
            placeholder="Código CAN, vecino o premio"
            value={buscar}
            onChange={(event) => setBuscar(event.target.value)}
          />
        </div>
      </div>
      {error && <ErrorMessage message={error} retry={cargar} />}
      {todos && visibles.length === 0 ? (
        <div className="card">
          <EmptyState title={texto ? 'No hay canjes con esa búsqueda' : 'No hay canjes aquí'} icon="gift">
            Los vecinos piden su canje por WhatsApp con la opción 4.
          </EmptyState>
        </div>
      ) : (
        <DataTable
          items={visibles}
          rowKey={(c) => c.codigo}
          rowLabel={(c) => 'Abrir el canje ' + c.codigo + ' de ' + c.solicitante_nombre}
          onSelect={setElegido}
          columns={[
            { header: 'Código', width: '7rem', cell: (c) => <span className="data-code">{c.codigo}</span> },
            {
              header: 'Vecino',
              width: 'minmax(0, 1.6fr)',
              cell: (c) => (
                <>
                  <p className="request-name">{c.solicitante_nombre}</p>
                  <p className="request-location">{c.telefono}</p>
                </>
              ),
            },
            { header: 'Premio', width: 'minmax(0, 1.6fr)', cell: (c) => <strong>{c.premio}</strong> },
            { header: 'Puntos', width: '5.5rem', cell: (c) => c.costo },
            { header: 'Pedido', width: '6rem', cell: (c) => fecha.format(new Date(c.pedido_en)) },
            { header: 'Estado', width: '8.5rem', cell: (c) => <Insignia estado={c.estado} /> },
          ]}
        />
      )}
      {elegido && (
        <DetalleCanje
          canje={elegido}
          onClose={() => setElegido(undefined)}
          alCerrar={(texto) => (setAviso(texto), cargar())}
        />
      )}
      {aviso && (
        <div className="confirmation-anchor">
          <p className="confirmation" role="status">
            <Icon name="check" /> {aviso}
            <button type="button" className="icon-button" aria-label="Cerrar aviso" onClick={() => setAviso('')}>
              <Icon name="close" />
            </button>
          </p>
        </div>
      )}
    </>
  )
}

function DetalleCanje({
  canje: c,
  onClose,
  alCerrar,
}: {
  canje: Canje
  onClose: () => void
  alCerrar: (aviso: string) => void
}) {
  const submit = useSubmission()
  const cerrar = (accion: 'entrega' | 'cancelacion', close: (after?: () => void) => Promise<void>) =>
    void submit.run(async () => {
      await api('/puntos/canjes/' + c.codigo + '/' + accion, 'POST')
      const aviso = accion === 'entrega' ? `Entregado: ${c.premio}. El vecino recibe su saldo por WhatsApp.` : ''
      window.dispatchEvent(new Event('canjes-cambiaron'))
      await close(() => alCerrar(aviso))
    })
  return (
    <Modal title={'Canje ' + c.codigo} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <>
          <dl className="detail-data">
            <div className="detail-wide">
              <dt>Premio</dt>
              <dd>
                {c.premio} · {c.costo} puntos
              </dd>
            </div>
            <div>
              <dt>Vecino</dt>
              <dd>{c.solicitante_nombre}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{c.telefono}</dd>
            </div>
            <div>
              <dt>Pedido</dt>
              <dd>{fecha.format(new Date(c.pedido_en))}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <Insignia estado={c.estado} />
              </dd>
            </div>
          </dl>
          {submit.error && <ErrorMessage message={submit.error} />}
          {c.estado === 'pedido' ? (
            <div className="form-actions">
              <button type="button" className="button button-secondary" onClick={() => cerrar('cancelacion', close)}>
                Cancelar canje
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={submit.busy}
                onClick={() => cerrar('entrega', close)}
              >
                <Icon name="check" /> Entregar premio
              </button>
            </div>
          ) : (
            <p className="muted">Este canje ya está {ESTADOS[c.estado].uno.toLowerCase()}.</p>
          )}
        </>
      )}
    </Modal>
  )
}
