import type { Zone } from '../../ecoconecta-coordinacion'

export interface Ubicado {
  zona_id: string
  conjunto_id?: string | null
  direccion: string
}

// Nombre de cada lugar (zona o conjunto) por su id, para mostrar dónde vive cada vecino (ADR-0014).
export function nombresDeLugares(zonas: Zone[]): Record<string, string> {
  return Object.fromEntries(
    zonas.flatMap((zona) => [[zona.id, zona.nombre], ...(zona.conjuntos ?? []).map((c) => [c.id, c.nombre])]),
  )
}

export const lugarYDireccion = (vecino: Ubicado, nombres: Record<string, string>) =>
  [nombres[vecino.conjunto_id ?? ''] ?? nombres[vecino.zona_id], vecino.direccion].filter(Boolean).join(' · ')
