import { statusLabels, wasteLabels } from '../../labels'
import type { PlannedRequest } from './timelineData'

// La hoja de ruta del día en CSV que Excel en español abre en columnas: «;», coma decimal y tildes (BOM).
export function exportarDia(fecha: string, visibles: PlannedRequest[], nombres: Map<string, string>) {
  const celda = (valor: string) => '"' + valor.replace(/"/g, '""') + '"'
  const filas = [
    ['Hora', 'Encargado', 'Código', 'Vecino', 'Dirección', 'Residuo', 'Estado', 'Kg'],
    ...visibles.map((item) => [
      item.asignacion.hora ?? 'Sin hora',
      nombres.get(item.asignacion.recolectorId) ?? 'Sin encargado',
      item.codigo,
      item.solicitante,
      item.ubicacion,
      wasteLabels[item.tipo],
      statusLabels[item.estado],
      item.resultado?.estado === 'recolectada' ? String(item.resultado.pesoKg).replace('.', ',') : '',
    ]),
  ]
  const csv = '\ufeff' + filas.map((fila) => fila.map(celda).join(';')).join('\r\n')
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  enlace.download = `cronograma-${fecha}.csv`
  enlace.click()
  window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000)
}
