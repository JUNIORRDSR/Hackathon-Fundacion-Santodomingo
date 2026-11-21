import './styles/eco.css'
import './styles/dashboard.css'
import './styles/motion.css'
import './styles/pickers.css'
import './styles/rutas.css'

export { CoordinatorModule } from './CoordinatorModule'
export { PublicTrainingModule } from './pages/PublicTrainingModule'
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
  PublicCollectionRoute,
  Request,
  RequestStatus,
  TrainingResource,
  WasteType,
  Zone,
} from './types'
