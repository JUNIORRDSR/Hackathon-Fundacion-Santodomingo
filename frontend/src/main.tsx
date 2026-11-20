import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { CoordinatorModule, PublicTrainingModule } from './ecoconecta-coordinacion'
import type { Coordinator, TrainingResource } from './ecoconecta-coordinacion'
import { hashLink, readHash } from './ecoconecta-coordinacion/routes'
import { LoadingState } from './ecoconecta-coordinacion/components/ui/Feedback'
import { api } from './host/api'
import { capacitacionPublica, crearRepositorio, recursoDe } from './host/repositorio'
import { useSesion } from './host/sesion'
import type { Usuario } from './host/sesion'
import { Entrar } from './host/paginas/Entrar'
import { Panel } from './host/paginas/Panel'
import { PorHabilitar } from './host/paginas/PorHabilitar'
import { RegistroAsistido } from './host/paginas/RegistroAsistido'
import { Whatsapp } from './host/paginas/Whatsapp'

const suscribir = (aviso: () => void) => (
  window.addEventListener('hashchange', aviso), () => window.removeEventListener('hashchange', aviso)
)
const leerHash = () => window.location.hash
const repositorio = crearRepositorio()
const capacitacionHref = '#/capacitacion?publica=1'
const EQUIPOS: Coordinator[] = [
  { id: 'organico', nombre: 'Huerteros', grupo: 'organico' },
  { id: 'reciclable', nombre: 'Recicladores', grupo: 'reciclable' },
]

// El coordinador ve su colectivo; el administrador elige cuál mirar (ADR-0004).
function coordinadorDe(usuario: Usuario, grupo: Coordinator['grupo']): Coordinator {
  const propio =
    usuario.colectivo === 'huerteros' ? 'organico' : usuario.colectivo === 'recicladores' ? 'reciclable' : grupo
  return { id: propio, nombre: usuario.nombre, grupo: propio }
}

function Capacitacion() {
  const [recursos, setRecursos] = useState<TrainingResource[]>()
  useEffect(() => void capacitacionPublica().then(setRecursos), [])
  return recursos ? <PublicTrainingModule resources={recursos} href={() => capacitacionHref} /> : <LoadingState />
}

function App() {
  const hash = useSyncExternalStore(suscribir, leerHash)
  const location = readHash(hash)
  const { usuario, cargando, entrar, salir } = useSesion()
  const [grupo, setGrupo] = useState<Coordinator['grupo']>('organico')
  const [recursos, setRecursos] = useState<TrainingResource[]>()
  useEffect(() => {
    if (usuario) void api<Parameters<typeof recursoDe>[0][]>('/contenidos').then((c) => setRecursos(c.map(recursoDe)))
  }, [usuario])

  if (location.page === 'capacitacion' && new URLSearchParams(hash.split('?')[1]).get('publica') === '1') {
    return <Capacitacion />
  }
  if (cargando) return <LoadingState />
  if (!usuario) return <Entrar onEntrar={entrar} />
  const coordinador = coordinadorDe(usuario, grupo)
  return (
    <CoordinatorModule
      key={coordinador.grupo}
      coordinator={coordinador}
      repository={repositorio}
      location={location}
      href={hashLink}
      demoChoices={usuario.colectivo ? undefined : EQUIPOS}
      onDemoChoice={(id) => setGrupo(id as Coordinator['grupo'])}
      trainingResources={recursos}
      publicTrainingHref={capacitacionHref}
      extraPages={{
        registro: <RegistroAsistido />,
        habilitar: <PorHabilitar />,
        panel: <Panel grupo={coordinador.grupo} />,
        whatsapp: <Whatsapp />,
      }}
      onSignOut={() => void salir()}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
