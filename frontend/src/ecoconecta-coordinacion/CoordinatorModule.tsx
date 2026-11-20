import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Layout, PageHeader } from './components/layout/Layout'
import { RequestDetail } from './components/solicitudes/RequestDetail'
import { ErrorMessage, LoadingState } from './components/ui/Feedback'
import { Icon } from './components/ui/Icon'
import { DashboardHeader, DashboardPage } from './pages/DashboardPage'
import { SolicitudesPage } from './pages/SolicitudesPage'
import { RecoleccionesPage } from './pages/RecoleccionesPage'
import { RecolectoresPage } from './pages/RecolectoresPage'
import { CapacitacionPage } from './pages/CapacitacionPage'
import { sampleTraining } from './mocks/training'
import { useCoordinatorData } from './services/useCoordinatorData'
import type { EcoLink, EcoLocation, EcoPage } from './routes'
import type {
  CollectionResult,
  CollectorInput,
  Coordinator,
  CoordinatorRepository,
  Request,
  Assignment,
  TrainingResource,
} from './types'

interface CoordinatorModuleProps {
  coordinator: Coordinator
  repository: CoordinatorRepository
  location: EcoLocation
  href: EcoLink
  demo?: boolean
  demoChoices?: Coordinator[]
  onDemoChoice?: (id: string) => void
  trainingResources?: TrainingResource[]
  publicTrainingHref?: string
  // Páginas que pone el host (registros por habilitar, canjes, WhatsApp) y salida de la sesión.
  extraPages?: Partial<Record<EcoPage, ReactNode>>
  onSignOut?: () => void
}

export function CoordinatorModule({
  coordinator,
  repository,
  location,
  href,
  demo = false,
  demoChoices,
  onDemoChoice,
  trainingResources,
  publicTrainingHref,
  extraPages = {},
  onSignOut,
}: CoordinatorModuleProps) {
  const { page } = location
  const pages = Object.keys(extraPages) as EcoPage[]
  return (
    <Layout
      page={page}
      coordinator={coordinator}
      choices={demoChoices}
      onChange={onDemoChoice}
      href={href}
      demo={demo}
      extraPages={pages}
      onSignOut={onSignOut}
    >
      {extraPages[page] ? (
        extraPages[page]
      ) : page === 'capacitacion' ? (
        <CapacitacionPage
          resources={trainingResources ?? sampleTraining}
          sample={!trainingResources}
          publicHref={publicTrainingHref}
        />
      ) : (
        <CoordinatorContent
          key={coordinator.id + '-' + coordinator.grupo + '-' + (page === 'recolectores')}
          coordinator={coordinator}
          repository={repository}
          location={location}
          href={href}
          demo={demo}
        />
      )}
    </Layout>
  )
}

export function PublicTrainingModule({ resources, href }: { resources?: TrainingResource[]; href: EcoLink }) {
  return (
    <Layout page="capacitacion" href={href} demo={false}>
      <CapacitacionPage resources={resources ?? sampleTraining} sample={!resources} />
    </Layout>
  )
}

const loadingHeaders = {
  solicitudes: { title: 'Solicitudes', description: 'Consulta y asigna las solicitudes de tu equipo.' },
  recolecciones: { title: 'Recolecciones', description: 'Consulta la agenda y registra los resultados.' },
  recolectores: { title: 'Recolectores', description: 'Gestiona los integrantes y las zonas de tu equipo.' },
}
type OperationalPage = keyof typeof loadingHeaders | 'inicio'

function CoordinatorContent({
  coordinator,
  repository,
  location,
  href,
  demo,
}: {
  coordinator: Coordinator
  repository: CoordinatorRepository
  location: EcoLocation
  href: EcoLink
  demo: boolean
}) {
  const page = location.page as OperationalPage
  const data = useCoordinatorData(coordinator, repository, page !== 'recolectores')
  const [detail, setDetail] = useState<{ id: string; page: OperationalPage }>()
  const [notice, setNotice] = useState('')
  useEffect(() => {
    setNotice('')
    setDetail(undefined)
  }, [page])
  const isDashboard = page === 'inicio'
  const dashboardHeader = isDashboard && <DashboardHeader coordinator={coordinator} demo={demo} href={href} />

  if (data.state.status !== 'ready') {
    return (
      <>
        {isDashboard ? dashboardHeader : <PageHeader {...loadingHeaders[page]} />}
        <div className="card data-feedback">
          {data.state.status === 'loading' ? (
            <LoadingState />
          ) : (
            <ErrorMessage message={data.state.error} retry={data.reload} />
          )}
        </div>
      </>
    )
  }

  const { requests, collectors, zones } = data.state.data
  const selected = detail?.page === page ? requests.find((item) => item.id === detail.id) : undefined
  const open = (item: Request) => setDetail({ id: item.id, page })
  const close = () => setDetail(undefined)

  function confirmRequest(saved: Request, id: string, state: Request['estado']) {
    if (saved.id !== id || saved.tipo !== coordinator.grupo || saved.estado !== state) {
      throw new Error('No se pudo confirmar el cambio. Actualiza el panel para revisar el estado.')
    }
    data.updateRequest(saved)
  }

  async function assign(input: Assignment) {
    const saved = await repository.assign(coordinator, input)
    confirmRequest(saved, input.solicitudId, 'asignada')
    setNotice('Asignación confirmada para la solicitud ' + saved.codigo + '.')
    close()
  }

  async function saveResult(input: CollectionResult) {
    const saved = await repository.saveResult(coordinator, input)
    confirmRequest(saved, input.solicitudId, input.estado)
    setNotice(
      saved.estado === 'recolectada'
        ? 'Peso registrado para ' + saved.codigo + '.'
        : 'Rechazo registrado para ' + saved.codigo + '.',
    )
  }

  async function cancel(id: string, motivo: string) {
    const saved = await repository.cancel(coordinator, id, motivo)
    confirmRequest(saved, id, 'cancelada')
    setNotice('Solicitud ' + saved.codigo + ' cancelada.')
    close()
  }

  async function saveCollector(input: CollectorInput, id?: string) {
    const saved = await repository.saveCollector(coordinator, input, id)
    if (saved.grupo !== coordinator.grupo || !saved.id || (id && saved.id !== id)) {
      throw new Error('No se pudo confirmar el recolector. Actualiza el panel para revisar el estado.')
    }
    data.updateCollector(saved)
    setNotice(id ? 'Datos del recolector actualizados.' : 'Recolector agregado al equipo.')
  }

  let content: ReactNode
  switch (page) {
    case 'inicio':
      content = <DashboardPage requests={requests} collectors={collectors} href={href} onSelect={open} />
      break
    case 'solicitudes':
      content = (
        <SolicitudesPage
          requests={requests}
          group={coordinator.grupo}
          filter={location.filter}
          href={href}
          onSelect={open}
        />
      )
      break
    case 'recolecciones':
      content = (
        <RecoleccionesPage
          key={location.requestId ?? ''}
          requests={requests}
          collectors={collectors}
          requestId={location.requestId}
          group={coordinator.grupo}
          onSave={saveResult}
        />
      )
      break
    case 'recolectores':
      content = (
        <RecolectoresPage collectors={collectors} zones={zones} group={coordinator.grupo} onSave={saveCollector} />
      )
  }

  return (
    <>
      {dashboardHeader}
      {content}
      {selected && (
        <RequestDetail
          key={selected.id}
          request={selected}
          collectors={collectors}
          href={href}
          onClose={close}
          onAssign={assign}
          onCancel={cancel}
        />
      )}
      <div className="confirmation-anchor" role="status" aria-atomic="true">
        {notice && (
          <div className="confirmation">
            <Icon name="checkCircle" />
            <span>{notice}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Cerrar confirmación"
              onClick={() => setNotice('')}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
