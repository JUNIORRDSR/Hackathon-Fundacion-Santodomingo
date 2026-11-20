export const routes = [
  'inicio',
  'solicitudes',
  'recolecciones',
  'recolectores',
  'capacitacion',
  'registro',
  'habilitar',
  'panel',
  'whatsapp',
] as const
export type EcoPage = (typeof routes)[number]

export interface EcoLocation {
  page: EcoPage
  filter?: string
  requestId?: string
}

export type EcoLink = (location: EcoLocation) => string

export const hashLink: EcoLink = ({ page, filter, requestId }) => {
  const query = new URLSearchParams()
  if (filter) query.set('estado', filter)
  if (requestId) query.set('solicitud', requestId)
  const suffix = query.size ? '?' + query.toString() : ''
  return '#/' + (page === 'inicio' ? '' : page) + suffix
}

export function readHash(hash: string): EcoLocation {
  const [path, search] = hash.replace(/^#\/?/, '').split('?')
  const page = routes.find((route) => route === path) ?? 'inicio'
  const params = new URLSearchParams(search)
  return {
    page,
    filter: params.get('estado') ?? undefined,
    requestId: params.get('solicitud') ?? undefined,
  }
}
