export const routes = [
  'inicio',
  'solicitudes',
  'recolecciones',
  'escanear',
  'recolectores',
  'capacitacion',
  'habilitar',
  'canjes',
  'whatsapp',
  'informes',
  'configuracion',
] as const
export type EcoPage = (typeof routes)[number]
export type RecordsView = 'aceptar' | 'vecinos' | 'lugares'

export interface EcoLocation {
  page: EcoPage
  filter?: string
  requestId?: string
  collectionView?: 'rutas'
  collectorId?: string
  recordsView?: RecordsView
}

export type EcoLink = (location: EcoLocation) => string

export const hashLink: EcoLink = ({ page, filter, requestId, collectionView, collectorId, recordsView }) => {
  const query = new URLSearchParams()
  if (filter) query.set('estado', filter)
  if (requestId) query.set('solicitud', requestId)
  if (collectionView) query.set('vista', collectionView)
  if (page === 'habilitar' && recordsView && recordsView !== 'aceptar') query.set('vista', recordsView)
  if (collectorId) query.set('encargado', collectorId)
  const suffix = query.size ? '?' + query.toString() : ''
  return '#/' + (page === 'inicio' ? '' : page) + suffix
}

export function readHash(hash: string): EcoLocation {
  const [path, search] = hash.replace(/^#\/?/, '').split('?')
  const page = routes.find((route) => route === path) ?? 'inicio'
  const params = new URLSearchParams(search)
  const view = params.get('vista')
  return {
    page,
    filter: params.get('estado') ?? undefined,
    requestId: params.get('solicitud') ?? undefined,
    collectionView: view === 'rutas' ? view : undefined,
    collectorId: params.get('encargado') ?? undefined,
    recordsView: page === 'habilitar' && (view === 'vecinos' || view === 'lugares') ? view : undefined,
  }
}
