import './styles/eco.css'
import './styles/dashboard.css'
import './styles/motion.css'

export { CoordinatorModule, PublicTrainingModule } from './CoordinatorModule'
export { createMockRepository } from './services/mockRepository'
export type { EcoLink, EcoLocation, EcoPage } from './routes'
export type {
  Assignment,
  CollectionResult,
  Collector,
  CollectorInput,
  Coordinator,
  CoordinatorRepository,
  LocalDate,
  Request,
  RequestStatus,
  TrainingResource,
  WasteType,
  Zone,
} from './types'
