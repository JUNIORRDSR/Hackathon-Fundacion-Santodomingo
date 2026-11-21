import type {
  CollectionRoute,
  CollectionRouteInput,
  PublicCollectionRoute,
  RouteSchedule,
} from '../ecoconecta-coordinacion/types'
import { api } from './api'

type Colectivo = 'huerteros' | 'recicladores'
type Horario = Pick<RouteSchedule, 'nombre' | 'dias'> & { hora_inicio: string; hora_fin: string }
type Ruta = Horario & {
  id: string
  zona_id: string
  conjunto_id: string | null
  encargado_id: string
  publicada: boolean
  disponible: boolean
}
type RutaPublica = Horario & { id: string; colectivo: Colectivo; zona: string; conjunto: string | null }

const url = '/directorio/rutas'
const horarioDe = (ruta: Horario): RouteSchedule => ({
  nombre: ruta.nombre,
  dias: ruta.dias,
  horaInicio: ruta.hora_inicio,
  horaFin: ruta.hora_fin,
})
const rutaDe = (ruta: Ruta): CollectionRoute => ({
  ...horarioDe(ruta),
  id: ruta.id,
  zonaId: ruta.zona_id,
  conjuntoId: ruta.conjunto_id,
  encargadoId: ruta.encargado_id,
  publicada: ruta.publicada,
  disponible: ruta.disponible,
})

export async function rutasDe(colectivo: Colectivo, signal?: AbortSignal): Promise<CollectionRoute[]> {
  const rutas = await api<Ruta[]>(url + '?colectivo=' + colectivo, 'GET', undefined, signal)
  return rutas.map(rutaDe)
}

export async function guardarRuta(colectivo: Colectivo, input: CollectionRouteInput, id?: string) {
  const datos = {
    nombre: input.nombre,
    colectivo,
    zona_id: input.zonaId,
    conjunto_id: input.conjuntoId,
    encargado_id: input.encargadoId,
    dias: input.dias,
    hora_inicio: input.horaInicio,
    hora_fin: input.horaFin,
    publicada: input.publicada,
  }
  return rutaDe(await api<Ruta>(id ? url + '/' + id : url, id ? 'PUT' : 'POST', datos))
}

export async function rutasPublicas(signal?: AbortSignal): Promise<PublicCollectionRoute[]> {
  const rutas = await api<RutaPublica[]>(url + '/publicas', 'GET', undefined, signal)
  return rutas.map(({ id, zona, conjunto, colectivo, ...horario }) => ({
    ...horarioDe(horario),
    id,
    zona,
    conjunto,
    grupo: colectivo === 'huerteros' ? 'organico' : 'reciclable',
  }))
}
