export type WasteType = 'organico' | 'aprovechable'
export type RequestStatus = 'pendiente' | 'asignada' | 'recolectada' | 'rechazada'
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
  hora?: string // HH:mm, hora local de Colombia
}

export type CollectionResult = { solicitudId: string } & (
  | { estado: 'recolectada'; pesoKg: number }
  | { estado: 'rechazada'; motivoRechazo: string }
)

interface RequestDetails {
  id: string
  solicitante: string
  ubicacion: string
  tipo: WasteType
  fecha: LocalDate
  fotoUrl?: string
  detalle?: string
}

export type Request = RequestDetails & (
  | { estado: 'pendiente'; asignacion?: undefined; resultado?: undefined }
  | { estado: 'asignada'; asignacion: Assignment; resultado?: undefined }
  | { estado: 'recolectada'; asignacion: Assignment; resultado: CollectionResult & { estado: 'recolectada' } }
  | { estado: 'rechazada'; asignacion: Assignment; resultado: CollectionResult & { estado: 'rechazada' } }
)

export interface Collector {
  id: string
  nombre: string
  grupo: WasteType
  zona: string
  activo: boolean
}

export type CollectorInput = Pick<Collector, 'nombre' | 'zona' | 'activo'>

interface TrainingDetails {
  id: string
  titulo: string
  categoria: WasteType | 'mezclas' | 'practicas'
  descripcion: string
}

export type TrainingResource = TrainingDetails & (
  | { tipo: 'guia'; pasos: string[]; url?: string }
  | { tipo: 'video'; url?: string; subtitulosUrl?: string; transcripcion?: string }
)

export interface CoordinatorRepository {
  listRequests(coordinator: Coordinator, signal?: AbortSignal): Promise<Request[]>
  listCollectors(coordinator: Coordinator, signal?: AbortSignal): Promise<Collector[]>
  assign(coordinator: Coordinator, assignment: Assignment): Promise<Request>
  saveResult(coordinator: Coordinator, result: CollectionResult): Promise<Request>
  saveCollector(coordinator: Coordinator, input: CollectorInput, id?: string): Promise<Collector>
}
