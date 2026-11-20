import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { api } from '../api'

interface Solicitante {
  id: string
  nombre: string
  tipo: 'hogar' | 'unidad_productiva'
  direccion: string
  telefono: string
}

const DESCRIPCION =
  'Vecinos y negocios nuevos de WhatsApp. Al aceptarlos, su primer pedido entra a Solicitudes ' +
  'y reciben su código para la bolsa.'

// RN-08: quien se registró solo por WhatsApp entra al piloto cuando la coordinación lo habilita.
export function PorHabilitar() {
  const [pendientes, setPendientes] = useState<Solicitante[]>([])
  const [aceptado, setAceptado] = useState('')
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    api<Solicitante[]>('/directorio/solicitantes?estado=pendiente')
      .then(setPendientes)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  async function habilitar({ id, nombre }: Solicitante) {
    setError('')
    try {
      await api('/directorio/solicitantes/' + id + '/habilitacion', 'POST')
      setAceptado(nombre)
      window.dispatchEvent(new Event('registros-cambiaron'))
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Registros" description={DESCRIPCION} />
      {error && <ErrorMessage message={error} retry={cargar} />}
      {pendientes.length === 0 ? (
        <div className="card">
          <EmptyState title="No hay registros pendientes" icon="users">
            Cuando alguien se registre por WhatsApp aparecerá aquí.
          </EmptyState>
        </div>
      ) : (
        <ul className="collection-grid">
          {pendientes.map((s) => (
            <li className="card collection-card" key={s.id}>
              <span className="status-badge">
                <Icon name="clock" /> {s.tipo === 'hogar' ? 'Hogar' : 'Negocio'}
              </span>
              <h2>{s.nombre}</h2>
              <div className="small-details">
                <span>
                  <Icon name="pin" />
                  {s.direccion}
                </span>
                <span>{s.telefono}</span>
              </div>
              <button type="button" className="button button-primary" onClick={() => habilitar(s)}>
                <Icon name="check" /> Aceptar vecino
              </button>
            </li>
          ))}
        </ul>
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
