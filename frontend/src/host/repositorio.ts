import type {
  Assignment,
  CollectionResult,
  Collector,
  CoordinatorRepository,
  Request,
  RequestStatus,
  TrainingResource,
  WasteType,
  Zone,
} from '../ecoconecta-coordinacion'
import { api, urlDeAdjunto } from './api'

// El CoordinatorRepository de Daniela contra la API real (ADR-0007): traduce la vista del backend a sus tipos.
export interface SolicitudVista {
  id: string
  codigo: string
  estado: 'recibida' | 'asignada' | 'programada' | 'recolectada' | 'rechazada' | 'cancelada'
  flujo: WasteType
  solicitante_nombre: string
  zona: string
  conjunto: string | null
  direccion: string
  observaciones: string
  preferencia: 'manana' | 'tarde' | 'noche'
  foto_url: string | null
  encargado_id: string | null
  dia: string | null
  hora: string | null
  kg: string | null
  motivo: string
  recibida: string
}
interface EncargadoVista {
  id: string
  nombre: string
  colectivo: 'huerteros' | 'recicladores'
  lugares: string[]
  activo: boolean
}
interface ContenidoVista {
  id: string
  titulo: string
  categoria: TrainingResource['categoria']
  formato: 'video' | 'imagen' | 'texto'
  texto_corto: string
  url: string | null
  pasos: string[]
  subtitulos_url: string | null
  transcripcion: string | null
}

export const colectivoDe = (grupo: WasteType) => (grupo === 'organico' ? 'huerteros' : 'recicladores')
const ESTADOS: Record<SolicitudVista['estado'], RequestStatus> = {
  recibida: 'pendiente',
  asignada: 'asignada', // sin hora
  programada: 'asignada', // con hora (RN-02)
  recolectada: 'recolectada',
  rechazada: 'rechazada',
  cancelada: 'cancelada',
}
const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })

export function solicitudDe(v: SolicitudVista): Request {
  const base = {
    id: v.id,
    codigo: v.codigo,
    solicitante: v.solicitante_nombre,
    ubicacion: (v.conjunto ?? v.zona) + ' · ' + v.direccion,
    tipo: v.flujo,
    fecha: fechaLocal.format(new Date(v.recibida)),
    fotoUrl: v.foto_url ? urlDeAdjunto(v.foto_url) : undefined,
    detalle: v.observaciones || undefined,
    horario: { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }[v.preferencia],
    motivo: v.motivo || undefined,
  }
  const asignacion =
    v.encargado_id && v.dia
      ? {
          solicitudId: v.id,
          recolectorId: v.encargado_id,
          fecha: v.dia,
          ...(v.hora ? { hora: v.hora.slice(0, 5) } : {}),
        }
      : undefined
  const estado = ESTADOS[v.estado]
  if (estado === 'pendiente') return { ...base, estado }
  if (estado === 'cancelada') return { ...base, estado, asignacion }
  if (!asignacion) throw new Error('La solicitud ' + v.codigo + ' llegó sin asignación.')
  if (estado === 'asignada') return { ...base, estado, asignacion }
  if (estado === 'recolectada') {
    return { ...base, estado, asignacion, resultado: { solicitudId: v.id, estado, pesoKg: Number(v.kg ?? 0) } }
  }
  return { ...base, estado, asignacion, resultado: { solicitudId: v.id, estado, motivoRechazo: v.motivo } }
}

// El encargado cubre lugares (ADR-0016): conjuntos, o zonas sin conjuntos. El módulo los llama «zonas».
function recolectorDe(e: EncargadoVista, zonas: Zone[]): Collector {
  const lugares = zonas.flatMap((zona) => [zona, ...(zona.conjuntos ?? [])])
  const nombres = lugares.filter((lugar) => e.lugares.includes(lugar.id)).map((lugar) => lugar.nombre)
  const grupo: WasteType = e.colectivo === 'huerteros' ? 'organico' : 'reciclable'
  return { id: e.id, nombre: e.nombre, grupo, zonas: e.lugares, zona: nombres.join(', '), activo: e.activo }
}

export function recursoDe(c: ContenidoVista): TrainingResource {
  const base = { id: c.id, titulo: c.titulo, categoria: c.categoria, descripcion: c.texto_corto }
  if (c.formato === 'video') {
    const extras = { subtitulosUrl: c.subtitulos_url ?? undefined, transcripcion: c.transcripcion ?? undefined }
    return { ...base, tipo: 'video', url: c.url ?? undefined, ...extras }
  }
  return { ...base, tipo: 'guia', pasos: c.pasos, url: c.url ?? undefined }
}

export async function capacitacionPublica(): Promise<TrainingResource[]> {
  return (await api<ContenidoVista[]>('/contenidos/publicos')).map(recursoDe)
}

// Lo que ganó cada recolección, por código: Resultados y el detalle lo muestran.
const puntosPorCodigo = (signal?: AbortSignal) =>
  api<Record<string, number>>('/puntos/por-codigo', 'GET', undefined, signal)
const solicitud = (ruta: string, cuerpo: object) =>
  api<SolicitudVista>('/solicitudes/' + ruta, 'POST', cuerpo).then(solicitudDe)

// Recolecciones y la pantalla Escanear asignan y registran igual.
export const asignar = (a: Assignment) =>
  solicitud(a.solicitudId + '/asignacion', { encargado_id: a.recolectorId, dia: a.fecha, hora: a.hora ?? null })
export const guardarResultado = (r: CollectionResult) =>
  r.estado === 'recolectada'
    ? solicitud(r.solicitudId + '/recoleccion', { kg: r.pesoKg }).then(async (s) => ({
        ...s,
        puntos: (await puntosPorCodigo())[s.codigo],
      }))
    : solicitud(r.solicitudId + '/rechazo', { motivo: r.motivoRechazo })

export function crearRepositorio(): CoordinatorRepository {
  const zonas = (signal?: AbortSignal) => api<Zone[]>('/directorio/zonas', 'GET', undefined, signal)
  return {
    listRequests: async (c, signal) => {
      const [lista, puntos] = await Promise.all([
        api<SolicitudVista[]>('/solicitudes?colectivo=' + colectivoDe(c.grupo), 'GET', undefined, signal),
        puntosPorCodigo(signal),
      ])
      return lista.map((v) => ({ ...solicitudDe(v), puntos: puntos[v.codigo] }))
    },
    listCollectors: async (c, signal) => {
      const [lista, catalogo] = await Promise.all([
        api<EncargadoVista[]>('/directorio/encargados?colectivo=' + colectivoDe(c.grupo), 'GET', undefined, signal),
        zonas(signal),
      ])
      return lista.map((e) => recolectorDe(e, catalogo))
    },
    listZones: zonas,
    assign: (_, a) => asignar(a),
    saveResult: (_, r) => guardarResultado(r),
    cancel: (_, id, motivo) => solicitud(id + '/cancelacion', { motivo }),
    saveCollector: async (c, input, id) => {
      const cuerpo = {
        nombre: input.nombre,
        lugares: input.zonas,
        activo: input.activo,
        colectivo: colectivoDe(c.grupo),
      }
      let guardado = id
        ? await api<EncargadoVista>('/directorio/encargados/' + id, 'PATCH', cuerpo)
        : await api<EncargadoVista>('/directorio/encargados', 'POST', cuerpo)
      if (!id && !input.activo) guardado = await api('/directorio/encargados/' + guardado.id, 'PATCH', cuerpo)
      return recolectorDe(guardado, await zonas())
    },
  }
}
