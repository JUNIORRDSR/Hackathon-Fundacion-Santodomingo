import { statusLabels, timeMinutes, wasteLabels } from '../../labels'
import { descargarExcel } from '../../services/exportarExcel'
import type { PlannedRequest } from './timelineData'

const columnas = [
  { header: 'Hora', width: 14, format: 'hh:mm' },
  { header: 'Encargado', width: 25 },
  { header: 'Código', width: 15 },
  { header: 'Vecino', width: 30 },
  { header: 'Dirección', width: 43 },
  { header: 'Residuo', width: 16 },
  { header: 'Estado', width: 17 },
  { header: 'Kg', width: 12, format: '0.00' },
]

export function exportarDia(fecha: string, visibles: PlannedRequest[], nombres: Map<string, string>) {
  const filas = visibles.map((item) => {
    const minutos = timeMinutes(item.asignacion.hora)
    return [
      minutos === undefined ? 'Sin hora' : minutos / 1440,
      nombres.get(item.asignacion.recolectorId) ?? 'Sin encargado',
      item.codigo,
      item.solicitante,
      item.ubicacion,
      wasteLabels[item.tipo],
      statusLabels[item.estado],
      item.resultado?.estado === 'recolectada' ? item.resultado.pesoKg : null,
    ]
  })
  return descargarExcel(`cronograma-${fecha}`, 'Cronograma', columnas, filas)
}
