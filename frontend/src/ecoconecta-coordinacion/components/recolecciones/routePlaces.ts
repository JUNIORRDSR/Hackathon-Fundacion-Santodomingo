import type { Zone } from '../../types'

export function routeSectors(zone: Zone, currentSector?: string | null) {
  return zone.conjuntos?.filter((sector) => sector.activo !== false || sector.id === currentSector) ?? []
}
