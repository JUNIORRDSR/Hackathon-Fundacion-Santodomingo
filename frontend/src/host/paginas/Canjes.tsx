import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import type { IconName } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
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

// ADR-0008: el vecino pide el canje por WhatsApp y muestra el código; aquí se entrega y se descuentan los puntos.
export function Canjes({ administrador }: { administrador: boolean }) {
  const [estado, setEstado] = useState<Estado>('pedido')
  const [buscar, setBuscar] = useState('')
  const [todos, setTodos] = useState<Canje[]>()
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const cargar = useCallback(() => {
    api<Canje[]>('/puntos/canjes')
      .then(setTodos)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  async function cerrar(codigo: string, accion: 'entrega' | 'cancelacion') {
    setError('')
    try {
      const canje = await api<Canje>('/puntos/canjes/' + codigo + '/' + accion, 'POST')
      setAviso(accion === 'entrega' ? `Entregado: ${canje.premio}. El vecino recibe su saldo por WhatsApp.` : '')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const lista = todos ?? []
  const texto = buscar.trim().toLowerCase()
  const visibles = lista.filter(
    (c) =>
      c.estado === estado && [c.codigo, c.solicitante_nombre, c.premio].some((v) => v.toLowerCase().includes(texto)),
  )
  const entregados = lista.filter((c) => c.estado === 'entregado')
  return (
    <>
      <PageHeader
        title="Canjes"
        description="El vecino muestra su código CAN en la huerta y aquí se entrega el premio."
      />
      <section className="stat-grid canje-cifras" aria-label="Resumen de canjes">
        <Cifra
          clase="stat-pendiente"
          icono="gift"
          titulo="Por entregar"
          valor={lista.filter((c) => c.estado === 'pedido').length}
        >
          Pedidos por WhatsApp
        </Cifra>
        <Cifra icono="check" titulo="Entregados" valor={entregados.length}>
          Premios en manos del vecino
        </Cifra>
        <Cifra icono="spark" titulo="Puntos canjeados" valor={entregados.reduce((suma, c) => suma + c.costo, 0)}>
          Descontados del libro
        </Cifra>
      </section>
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
        <ul className="collection-grid">
          {visibles.map((c) => (
            <TarjetaCanje key={c.codigo} canje={c} alCerrar={cerrar} />
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

function Cifra({
  clase = '',
  icono,
  titulo,
  valor,
  children,
}: {
  clase?: string
  icono: IconName
  titulo: string
  valor: number
  children: string
}) {
  return (
    <div className={'card stat-card ' + clase}>
      <span className="stat-title">
        <Icon name={icono} /> {titulo}
      </span>
      <strong>{valor.toLocaleString('es-CO')}</strong>
      <span className="stat-caption">{children}</span>
    </div>
  )
}

function TarjetaCanje({
  canje: c,
  alCerrar,
}: {
  canje: Canje
  alCerrar: (codigo: string, a: 'entrega' | 'cancelacion') => void
}) {
  return (
    <li className="card collection-card canje-tarjeta" data-estado={c.estado}>
      <div className="collection-card-top">
        <span className="canje-codigo">{c.codigo}</span>
        <span className="status-badge">
          <Icon name={ESTADOS[c.estado].icono} /> {ESTADOS[c.estado].uno}
        </span>
      </div>
      <div className="canje-premio">
        <span className="icon-tile">
          <Icon name="gift" />
        </span>
        <div>
          <h2>{c.premio}</h2>
          <span className="canje-costo">{c.costo} puntos</span>
        </div>
      </div>
      <div className="small-details">
        <span>
          <Icon name="user" /> {c.solicitante_nombre} · {c.telefono}
        </span>
        <span>
          <Icon name="calendar" /> Pedido el {fecha.format(new Date(c.pedido_en))}
          {c.cerrado_en && ` · cerrado el ${fecha.format(new Date(c.cerrado_en))}`}
        </span>
      </div>
      {c.estado === 'pedido' && (
        <div className="canje-acciones">
          <button type="button" className="button button-primary" onClick={() => alCerrar(c.codigo, 'entrega')}>
            <Icon name="check" /> Entregar premio
          </button>
          <button type="button" className="button button-quiet" onClick={() => alCerrar(c.codigo, 'cancelacion')}>
            Cancelar
          </button>
        </div>
      )}
    </li>
  )
}
