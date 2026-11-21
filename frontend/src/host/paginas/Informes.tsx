import { useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { descargarCsv } from '../../ecoconecta-coordinacion/components/recolecciones/exportar'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { api } from '../api'
import { mesActual, moverMes, nombreMes, periodo } from './meses'

type Por = 'conjunto' | 'zona' | 'encargado' | 'vecino'
interface Fila {
  nombre: string
  solicitudes: number
  recolecciones: number
  kg: string
  puntos: number
}
const POR: Record<Por, string> = {
  conjunto: 'Por conjunto',
  zona: 'Por zona',
  encargado: 'Por encargado',
  vecino: 'Por vecino',
}
const COLUMNA: Record<Por, string> = {
  conjunto: 'Conjunto o sector',
  zona: 'Zona',
  encargado: 'Encargado',
  vecino: 'Vecino o negocio',
}
const kilos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

// RF-18: lo pedido, recolectado y pesado en el mes, por conjunto, zona, encargado o vecino, con exportación.
export function Informes({ grupo }: { grupo: 'organico' | 'reciclable' }) {
  const [mes, setMes] = useState(mesActual)
  const [por, setPor] = useState<Por>('conjunto')
  const [filas, setFilas] = useState<Fila[]>()
  const [error, setError] = useState('')
  const { desde, hasta } = periodo(mes)
  const colectivo = grupo === 'organico' ? 'huerteros' : 'recicladores'
  const consulta = `por=${por}&desde=${desde}&hasta=${hasta}&colectivo=${colectivo}`
  useEffect(() => {
    const control = new AbortController()
    setFilas(undefined)
    setError('')
    api<Fila[]>('/reportes/desglose?' + consulta, 'GET', undefined, control.signal)
      .then(setFilas)
      .catch((e: Error) => !control.signal.aborted && setError(e.message))
    return () => control.abort()
  }, [consulta])
  const titulo = nombreMes.format(new Date(desde + 'T00:00:00Z'))
  const suma = (campo: (f: Fila) => number) => (filas ?? []).reduce((total, f) => total + campo(f), 0)

  function exportar() {
    descargarCsv(`informe-${por}-${mes}.csv`, [
      [COLUMNA[por], 'Solicitudes', 'Recolecciones', 'Kilos', 'Puntos'],
      ...(filas ?? []).map((f) => [
        f.nombre,
        String(f.solicitudes),
        String(f.recolecciones),
        kilos.format(Number(f.kg)),
        String(f.puntos),
      ]),
    ])
  }

  return (
    <>
      <PageHeader
        title="Informes"
        description="Cuánto se pidió, se recolectó y se pesó cada mes, para la coordinación y la fundación."
        action={
          <button type="button" className="button button-secondary" disabled={!filas?.length} onClick={exportar}>
            Exportar tabla
          </button>
        }
      />
      <div className="filtros-registro">
        <div className="date-selector impacto-mes" role="group" aria-label="Mes del informe">
          <button
            type="button"
            className="icon-button date-previous"
            aria-label="Mes anterior"
            onClick={() => setMes(moverMes(mes, -1))}
          >
            <Icon name="chevron" />
          </button>
          <span aria-live="polite">{titulo}</span>
          <button
            type="button"
            className="icon-button date-next"
            aria-label="Mes siguiente"
            disabled={mes >= mesActual}
            onClick={() => setMes(moverMes(mes, 1))}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <MotionPills className="pills" label="Agrupar el informe" active={por}>
          {(Object.keys(POR) as Por[]).map((p) => (
            <button key={p} type="button" className="pill" aria-pressed={por === p} onClick={() => setPor(p)}>
              {POR[p]}
            </button>
          ))}
        </MotionPills>
      </div>
      {error && <ErrorMessage message={error} />}
      {!filas && !error && <p className="muted">Cargando el informe de {titulo}…</p>}
      {filas?.length === 0 && (
        <div className="card">
          <EmptyState title={`En ${titulo} no hay solicitudes`}>Elige otro mes.</EmptyState>
        </div>
      )}
      {!!filas?.length && (
        <div className="card informe">
          <table className="informe-tabla">
            <caption className="sr-only">
              {POR[por]}, {titulo}
            </caption>
            <thead>
              <tr>
                <th scope="col">{COLUMNA[por]}</th>
                <th scope="col">Solicitudes</th>
                <th scope="col">Recolecciones</th>
                <th scope="col">Kilos</th>
                <th scope="col">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre}>
                  <th scope="row">{f.nombre}</th>
                  <td>{f.solicitudes}</td>
                  <td>{f.recolecciones}</td>
                  <td>{kilos.format(Number(f.kg))}</td>
                  <td>{f.puntos}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{suma((f) => f.solicitudes)}</td>
                <td>{suma((f) => f.recolecciones)}</td>
                <td>{kilos.format(suma((f) => Number(f.kg)))}</td>
                <td>{suma((f) => f.puntos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
