import { useEffect, useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { ErrorMessage, LoadingState } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { statusLabels, wasteLabels } from '../../ecoconecta-coordinacion/labels'
import type { WasteType } from '../../ecoconecta-coordinacion'
import { api } from '../api'
import { colectivoDe } from '../repositorio'

interface Resumen {
  desde: string
  hasta: string
  total_solicitudes: number
  total_kg: string
  filas: { flujo: WasteType; estado: string; cantidad: number; kg: string }[]
}
const ESTADO: Record<string, string> = { ...statusLabels, recibida: 'Pendiente', programada: 'Programada' }

// Resumen por flujo, estado y periodo (§5.6); por defecto, los últimos 30 días. El CSV no lleva datos personales.
export function Panel({ grupo }: { grupo: WasteType }) {
  const colectivo = colectivoDe(grupo)
  const [resumen, setResumen] = useState<Resumen>()
  const [error, setError] = useState('')
  useEffect(() => {
    api<Resumen>('/reportes/resumen?colectivo=' + colectivo)
      .then(setResumen)
      .catch((e: Error) => setError(e.message))
  }, [colectivo])

  return (
    <>
      <PageHeader
        title="Panel"
        description={resumen ? 'Del ' + resumen.desde + ' al ' + resumen.hasta + '.' : 'Resumen del último mes.'}
        action={
          <a className="button button-secondary" href={'./api/reportes/solicitudes.csv?colectivo=' + colectivo}>
            Descargar CSV
          </a>
        }
      />
      {error && <ErrorMessage message={error} />}
      {!resumen && !error && <LoadingState />}
      {resumen && (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <span className="stat-title">Solicitudes</span>
              <strong>{resumen.total_solicitudes}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-title">Kilos recolectados</span>
              <strong>{Number(resumen.total_kg).toLocaleString('es-CO')}</strong>
            </div>
          </div>
          <table className="card">
            <thead>
              <tr>
                <th>Flujo</th>
                <th>Estado</th>
                <th>Solicitudes</th>
                <th>Kilos</th>
              </tr>
            </thead>
            <tbody>
              {resumen.filas.map((fila) => (
                <tr key={fila.flujo + fila.estado}>
                  <td>{wasteLabels[fila.flujo]}</td>
                  <td>{ESTADO[fila.estado] ?? fila.estado}</td>
                  <td>{fila.cantidad}</td>
                  <td>{Number(fila.kg).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
