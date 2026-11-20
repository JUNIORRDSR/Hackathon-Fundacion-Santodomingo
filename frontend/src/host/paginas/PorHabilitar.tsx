import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { DataTable } from '../../ecoconecta-coordinacion/components/ui/DataTable'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import type { Zone } from '../../ecoconecta-coordinacion'
import { api } from '../api'

interface Solicitante {
  id: string
  nombre: string
  tipo: 'hogar' | 'unidad_productiva'
  zona_id: string
  direccion: string
  telefono: string
}
type Pedido = { flujo: 'organico' | 'reciclable'; preferencia: 'manana' | 'tarde' | 'noche' }
const FLUJO = { organico: 'Orgánicos', reciclable: 'Reciclables' }
const FRANJA = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
const DESCRIPCION =
  'Vecinos y negocios nuevos de WhatsApp. Al aceptarlos, su primer pedido entra a Solicitudes ' +
  'y reciben su código para la bolsa.'
const pedidoTexto = (p?: Pedido) => (p ? FLUJO[p.flujo] + ' · ' + FRANJA[p.preferencia] : 'Sin pedido')

// RN-08 y ADR-0010: quien se registró por WhatsApp entra al piloto cuando la coordinación lo acepta.
export function PorHabilitar() {
  const [pendientes, setPendientes] = useState<Solicitante[]>()
  const [zonas, setZonas] = useState<Record<string, string>>({})
  const [pedidos, setPedidos] = useState<Record<string, Pedido>>({})
  const [elegido, setElegido] = useState<Solicitante>()
  const [aceptado, setAceptado] = useState('')
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    Promise.all([
      api<Solicitante[]>('/directorio/solicitantes?estado=pendiente'),
      api<Zone[]>('/directorio/zonas'),
      api<Record<string, Pedido>>('/whatsapp/pedidos-en-espera'),
    ])
      .then(([lista, catalogo, enEspera]) => {
        setPendientes(lista)
        setZonas(Object.fromEntries(catalogo.map((z) => [z.id, z.nombre])))
        setPedidos(enEspera)
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  const zonaYDireccion = (s: Solicitante) => (zonas[s.zona_id] ? zonas[s.zona_id] + ' · ' : '') + s.direccion
  return (
    <>
      <PageHeader title="Registros" description={DESCRIPCION} />
      {error && <ErrorMessage message={error} retry={cargar} />}
      {pendientes?.length === 0 ? (
        <div className="card">
          <EmptyState title="No hay registros pendientes" icon="users">
            Cuando alguien se registre por WhatsApp aparecerá aquí.
          </EmptyState>
        </div>
      ) : (
        <DataTable
          items={pendientes ?? []}
          rowKey={(s) => s.id}
          rowLabel={(s) => 'Revisar el registro de ' + s.nombre}
          onSelect={setElegido}
          columns={[
            {
              header: 'Vecino',
              width: 'minmax(0, 1.6fr)',
              cell: (s) => (
                <>
                  <p className="request-name">{s.nombre}</p>
                  <p className="request-location">{s.tipo === 'hogar' ? 'Hogar' : 'Negocio'}</p>
                </>
              ),
            },
            { header: 'Zona y dirección', width: 'minmax(0, 2fr)', cell: zonaYDireccion },
            { header: 'WhatsApp', cell: (s) => s.telefono },
            { header: 'Primer pedido', cell: (s) => <strong>{pedidoTexto(pedidos[s.telefono])}</strong> },
          ]}
        />
      )}
      {elegido && (
        <Aceptar
          solicitante={elegido}
          detalle={[zonaYDireccion(elegido), pedidoTexto(pedidos[elegido.telefono])]}
          onClose={() => setElegido(undefined)}
          alAceptar={() => {
            setAceptado(elegido.nombre)
            window.dispatchEvent(new Event('registros-cambiaron'))
            cargar()
          }}
        />
      )}
      {aceptado && (
        <div className="confirmation-anchor">
          <p className="confirmation" role="status">
            <Icon name="check" /> {aceptado} ya es parte del piloto. Su primer pedido entró a Solicitudes.
            <a className="button button-surface" href="#/solicitudes?estado=pendiente">
              Ver solicitudes
            </a>
          </p>
        </div>
      )}
    </>
  )
}

function Aceptar({
  solicitante: s,
  detalle: [lugar, pedido],
  onClose,
  alAceptar,
}: {
  solicitante: Solicitante
  detalle: [string, string]
  onClose: () => void
  alAceptar: () => void
}) {
  const submit = useSubmission()
  return (
    <Modal title={'Registro de ' + s.nombre} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <>
          <dl className="detail-data">
            <div>
              <dt>Tipo</dt>
              <dd>{s.tipo === 'hogar' ? 'Hogar' : 'Negocio'}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{s.telefono}</dd>
            </div>
            <div className="detail-wide">
              <dt>Zona y dirección</dt>
              <dd>{lugar}</dd>
            </div>
            <div className="detail-wide">
              <dt>Primer pedido</dt>
              <dd>{pedido}</dd>
            </div>
          </dl>
          <p className="muted">Al aceptarlo, su primer pedido entra a Solicitudes y recibe su código por WhatsApp.</p>
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => void close()}>
              Ahora no
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={submit.busy}
              onClick={() =>
                void submit.run(async () => {
                  await api('/directorio/solicitantes/' + s.id + '/habilitacion', 'POST')
                  await close(alAceptar)
                })
              }
            >
              <Icon name="check" /> Aceptar vecino
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
