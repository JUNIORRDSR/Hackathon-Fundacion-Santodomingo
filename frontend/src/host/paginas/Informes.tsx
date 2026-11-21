import { useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { descargarExcel } from '../../ecoconecta-coordinacion/services/exportarExcel'
import { api } from '../api'
import { mesActual, moverMes, nombreMes, periodo } from './meses'
import { Tablero } from './informes/Tablero'

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
  const descarga = useSubmission()
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

  function exportar() {
    const columnas = [
      { header: COLUMNA[por], width: 36 },
      { header: 'Solicitudes', width: 16 },
      { header: 'Recolecciones', width: 17 },
      { header: 'Kilos', width: 14, format: '0.00' },
      { header: 'Puntos', width: 14 },
    ]
    const datos = (filas ?? []).map((f) => [f.nombre, f.solicitudes, f.recolecciones, Number(f.kg), f.puntos])
    void descarga.run(() => descargarExcel(`informe-${por}-${mes}`, 'Informe', columnas, datos))
  }

  return (
    <>
      <PageHeader
        title="Informes"
        description="Métricas del mes para decidir: cuánto se recoge, dónde rinde la ruta y qué tan bien se separa."
        action={
          <button
            type="button"
            className="button button-secondary"
            disabled={!filas?.length || descarga.busy}
            onClick={exportar}
          >
            {descarga.busy ? 'Preparando Excel…' : 'Exportar tabla en Excel'}
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
      </div>
      <Tablero mes={mes} colectivo={colectivo} />
      <section className="card informe-desglose" aria-labelledby="desglose-titulo">
        <div className="informe-desglose-cabeza">
          <div className="tablero-cabeza">
            <h2 id="desglose-titulo">Desglose de {titulo}</h2>
            <p>Lo pedido, recolectado y pesado, para exportar a Excel</p>
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
        {descarga.error && <ErrorMessage message={descarga.error} />}
        {!filas && !error && <p className="muted">Cargando el informe de {titulo}…</p>}
        {filas?.length === 0 && <EmptyState title={`En ${titulo} no hay solicitudes`}>Elige otro mes.</EmptyState>}
        {!!filas?.length && <Tabla filas={filas} por={por} titulo={titulo} />}
      </section>
    </>
  )
}

function Tabla({ filas, por, titulo }: { filas: Fila[]; por: Por; titulo: string }) {
  const suma = (campo: (f: Fila) => number) => filas.reduce((total, f) => total + campo(f), 0)
  return (
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
  )
}
