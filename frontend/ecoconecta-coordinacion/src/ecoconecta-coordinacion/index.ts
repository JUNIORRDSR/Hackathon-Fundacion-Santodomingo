import './styles/eco.css'
import './styles/dashboard.css'

export { CoordinatorModule, PublicTrainingModule } from './CoordinatorModule'
export { createApiRepository } from './services/apiRepository'
export type { ApiRepositoryOptions } from './services/apiRepository'
export { createMockRepository } from './services/mockRepository'
export type { EcoLink, EcoLocation, EcoPage } from './routes'
export type {
  Assignment, CollectionResult, Collector, CollectorInput, Coordinator, CoordinatorRepository,
  LocalDate, Request, RequestStatus, TrainingResource, WasteType,
} from './types'
