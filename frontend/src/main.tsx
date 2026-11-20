import { StrictMode, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { CoordinatorModule, PublicTrainingModule, createMockRepository } from './ecoconecta-coordinacion'
import { demoCoordinators } from './ecoconecta-coordinacion/mocks/demoData'
import { hashLink, readHash } from './ecoconecta-coordinacion/routes'

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

const getHash = () => window.location.hash
const repository = createMockRepository(getStorage())
const publicTrainingHref = '#/capacitacion?publica=1'

function DemoApp() {
  const hash = useSyncExternalStore(subscribe, getHash)
  const location = readHash(hash)
  const [team, setTeam] = useState(demoCoordinators[0].id)
  const coordinator = demoCoordinators.find((item) => item.id === team) ?? demoCoordinators[0]

  if (location.page === 'capacitacion' && new URLSearchParams(hash.split('?')[1]).get('publica') === '1') {
    return <PublicTrainingModule href={() => publicTrainingHref} />
  }

  return (
    <CoordinatorModule
      coordinator={coordinator}
      repository={repository}
      location={location}
      href={hashLink}
      demo
      demoChoices={demoCoordinators}
      onDemoChoice={setTeam}
      publicTrainingHref={publicTrainingHref}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
)
