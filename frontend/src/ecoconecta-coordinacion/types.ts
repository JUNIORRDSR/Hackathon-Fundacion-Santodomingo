// El lenguaje es el del glosario del backend (docs/GLOSARIO.md): «reciclable», no «aprovechable» (ADR-0007).
export type WasteType = 'organico' | 'reciclable'
export type RequestStatus = 'pendiente' | 'asignada' | 'recolectada' | 'rechazada' | 'cancelada'
export type LocalDate = string // YYYY-MM-DD, fecha de calendario en Colombia

export interface Coordinator {
  id: string
  nombre: string
  grupo: WasteType
}

export interface Assignment {
  solicitudId: string
  recolectorId: string
  fecha: LocalDate
  hora?: string // HH:mm, hora local de Colombia; sin hora la solicitud queda asignada, con hora programada (RN-02)
}

export type CollectionResult = { solicitudId: string } & (
  | { estado: 'recolectada'; pesoKg: number }
  | { estado: 'rechazada'; motivoRechazo: string }
)

interface RequestDetails {
  id: string
  codigo: string // ORG-0042: el que la persona escribe en la bolsa
  solicitante: string
  ubicacion: string
  tipo: WasteType
  fecha: LocalDate
  fotoUrl?: string
  detalle?: string
  // Franja que eligió el vecino al pedir: orienta la hora de la asignación.
  horario?: string
  // Puntos que ganó el vecino con esta recolección (solo las recolectadas).
  puntos?: number
  motivo?: string // de la cancelación o del rechazo
}

export type Request = RequestDetails &
  (
    | { estado: 'pendiente'; asignacion?: undefined; resultado?: undefined }
    | { estado: 'asignada'; asignacion: Assignment; resultado?: undefined }
    | { estado: 'recolectada'; asignacion: Assignment; resultado: CollectionResult & { estado: 'recolectada' } }
    | { estado: 'rechazada'; asignacion: Assignment; resultado: CollectionResult & { estado: 'rechazada' } }
    | { estado: 'cancelada'; asignacion?: Assignment; resultado?: undefined }
  )

export interface Zone {
  id: string
  nombre: string
  activo?: boolean
  // Conjuntos o sectores de la zona (ADR-0017); una zona sin conjuntos se cubre a sí misma.
  conjuntos?: { id: string; nombre: string; activo?: boolean }[]
}

export interface Collector {
  id: string
  nombre: string
  grupo: WasteType
  zonas: string[] // ids de los lugares que cubre: conjuntos, o zonas sin conjuntos
  zona: string // nombres de esos lugares, para mostrar
  activo: boolean
}

export type CollectorInput = Pick<Collector, 'nombre' | 'zonas' | 'activo'>

export interface RouteSchedule {
  nombre: string
  dias: number[] // 0 es lunes, 6 es domingo
  horaInicio: string
  horaFin: string
}

export interface CollectionRouteInput extends RouteSchedule {
  zonaId: string
  conjuntoId: string | null
  encargadoId: string
  publicada: boolean
}

export interface CollectionRoute extends CollectionRouteInput {
  id: string
  disponible: boolean
}

export interface PublicCollectionRoute extends RouteSchedule {
  id: string
  grupo: WasteType
  zona: string
  conjunto: string | null
}

interface TrainingDetails {
  id: string
  titulo: string
  categoria: WasteType | 'mezclas' | 'practicas'
  descripcion: string
}

export type TrainingResource = TrainingDetails &
  (
    | { tipo: 'guia'; pasos: string[]; url?: string }
    | { tipo: 'video'; url?: string; subtitulosUrl?: string; transcripcion?: string }
  )

export interface CoordinatorRepository {
  listRequests(coordinator: Coordinator, signal?: AbortSignal): Promise<Request[]>
  listCollectors(coordinator: Coordinator, signal?: AbortSignal): Promise<Collector[]>
  listZones(signal?: AbortSignal): Promise<Zone[]>
  assign(coordinator: Coordinator, assignment: Assignment): Promise<Request>
  saveResult(coordinator: Coordinator, result: CollectionResult): Promise<Request>
  cancel(coordinator: Coordinator, solicitudId: string, motivo: string): Promise<Request>
  saveCollector(coordinator: Coordinator, input: CollectorInput, id?: string): Promise<Collector>
  listRoutes(coordinator: Coordinator, signal?: AbortSignal): Promise<CollectionRoute[]>
  saveRoute(coordinator: Coordinator, input: CollectionRouteInput, id?: string): Promise<CollectionRoute>
}
