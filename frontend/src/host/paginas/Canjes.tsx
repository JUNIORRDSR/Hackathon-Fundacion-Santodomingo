import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
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
const FILTROS: { valor: Estado; texto: string }[] = [
  { valor: 'pedido', texto: 'Por entregar' },
  { valor: 'entregado', texto: 'Entregados' },
  { valor: 'cancelado', texto: 'Cancelados' },
]
const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })

// ADR-0008: el vecino pide el canje por WhatsApp y muestra el código; aquí se entrega y se descuentan los puntos.
export function Canjes({ administrador }: { administrador: boolean }) {
  const [estado, setEstado] = useState<Estado>('pedido')
  const [buscar, setBuscar] = useState('')
  const [lista, setLista] = useState<Canje[]>()
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const cargar = useCallback(() => {
    api<Canje[]>('/puntos/canjes?estado=' + estado)
      .then(setLista)
      .catch((e: Error) => setError(e.message))
  }, [estado])
  useEffect(cargar, [cargar])

  async function cerrar(codigo: string, accion: 'entrega' | 'cancelacion') {
    setError('')
    try {
      const canje = await api<Canje>('/puntos/canjes/' + codigo + '/' + accion, 'POST')
      setAviso(accion === 'entrega' ? `Entregado ${canje.premio}. El vecino recibe su saldo por WhatsApp.` : '')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const texto = buscar.trim().toLowerCase()
  const visibles = (lista ?? []).filter((c) =>
    [c.codigo, c.solicitante_nombre, c.premio].some((v) => v.toLowerCase().includes(texto)),
  )
  return (
    <>
      <PageHeader title="Canjes" description="El vecino muestra su código CAN y aquí se entrega el premio." />
      <div className="filter-bar">
        <div className="pills" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(({ valor, texto: etiqueta }) => (
            <button
              key={valor}
              type="button"
              className="pill"
              aria-pressed={estado === valor}
              onClick={() => setEstado(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
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
      {lista && visibles.length === 0 ? (
        <div className="card">
          <EmptyState title={texto ? 'No hay canjes con ese código' : 'No hay canjes aquí'} icon="gift">
            Los vecinos piden su canje por WhatsApp con la opción 4.
          </EmptyState>
        </div>
      ) : (
        <ul className="collection-grid">
          {visibles.map((c) => (
            <li className="card collection-card" key={c.codigo}>
              <span className="canje-codigo">{c.codigo}</span>
              <h2>{c.premio}</h2>
              <div className="small-details">
                <span>
                  <Icon name="user" /> {c.solicitante_nombre} · {c.telefono}
                </span>
                <span>
                  <Icon name="gift" /> {c.costo} puntos
                </span>
                <span>
                  <Icon name="calendar" /> Pedido el {fecha.format(new Date(c.pedido_en))}
                  {c.cerrado_en && ` · cerrado el ${fecha.format(new Date(c.cerrado_en))}`}
                </span>
              </div>
              {c.estado === 'pedido' && (
                <div className="canje-acciones">
                  <button type="button" className="button button-primary" onClick={() => cerrar(c.codigo, 'entrega')}>
                    <Icon name="check" /> Entregar
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => cerrar(c.codigo, 'cancelacion')}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Premios administrador={administrador} />
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
