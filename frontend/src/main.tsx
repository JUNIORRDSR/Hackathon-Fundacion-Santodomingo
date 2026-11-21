import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { CoordinatorModule, PublicTrainingModule } from './ecoconecta-coordinacion'
import type { Coordinator, TrainingResource } from './ecoconecta-coordinacion'
import { hashLink, readHash } from './ecoconecta-coordinacion/routes'
import { LoadingState } from './ecoconecta-coordinacion/components/ui/Feedback'
import { Layout } from './ecoconecta-coordinacion/components/layout/Layout'
import './host/host.css'
import { api } from './host/api'
import { capacitacionPublica, crearRepositorio, recursoDe } from './host/repositorio'
import { useSesion } from './host/sesion'
import type { Usuario } from './host/sesion'
import { Canjes } from './host/paginas/Canjes'
import { Entrar } from './host/paginas/Entrar'
import { Informes } from './host/paginas/Informes'
import { Registros } from './host/paginas/Registros'
import { EntregaHuerta } from './host/paginas/EntregaHuerta'
import { Impacto } from './host/paginas/Impacto'
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

// Contadores del menú que se refrescan solos: vecinos por aceptar y mensajes de WhatsApp sin leer.
function useContador<T>(activo: boolean, ruta: string, contar: (datos: T) => number, evento: string) {
  const [cantidad, setCantidad] = useState(0)
  useEffect(() => {
    if (!activo) return
    const actualizar = () =>
      void api<T>(ruta)
        .then((datos) => setCantidad(contar(datos)))
        .catch(() => {})
    actualizar()
    const intervalo = window.setInterval(actualizar, 8000)
    window.addEventListener(evento, actualizar)
    return () => (window.clearInterval(intervalo), window.removeEventListener(evento, actualizar))
  }, [activo, ruta, contar, evento])
  return cantidad
}
const contarLista = (lista: unknown[]) => lista.length
const contarSinLeer = (chats: { sin_leer: number }[]) => chats.reduce((total, chat) => total + chat.sin_leer, 0)

const Cargando = () => (
  <Layout page="inicio" href={hashLink} demo={false}>
    <LoadingState />
  </Layout>
)

function Capacitacion() {
  const [recursos, setRecursos] = useState<TrainingResource[]>()
  useEffect(() => void capacitacionPublica().then(setRecursos), [])
  return recursos ? <PublicTrainingModule resources={recursos} href={() => capacitacionHref} /> : <Cargando />
}

function App() {
  const hash = useSyncExternalStore(suscribir, leerHash)
  const location = readHash(hash)
  const { usuario, cargando, entrar, registrar, salir } = useSesion()
  const [grupo, setGrupo] = useState<Coordinator['grupo']>('organico')
  const [sugerido, setSugerido] = useState('')
  const porAceptar = useContador(
    !!usuario,
    '/directorio/solicitantes?estado=pendiente',
    contarLista,
    'registros-cambiaron',
  )
  const sinLeer = useContador(!!usuario, '/whatsapp/conversaciones', contarSinLeer, 'whatsapp-leido')
  const porEntregar = useContador(!!usuario, '/puntos/canjes?estado=pedido', contarLista, 'canjes-cambiaron')
  const [recursos, setRecursos] = useState<TrainingResource[]>()
  useEffect(() => {
    if (usuario) void api<Parameters<typeof recursoDe>[0][]>('/contenidos').then((c) => setRecursos(c.map(recursoDe)))
  }, [usuario])

  if (location.page === 'capacitacion' && new URLSearchParams(hash.split('?')[1]).get('publica') === '1') {
    return <Capacitacion />
  }
  if (cargando) return <Cargando />
  if (!usuario) return <Entrar key={sugerido} onEntrar={entrar} onRegistrar={registrar} usuarioInicial={sugerido} />
  const coordinador = coordinadorDe(usuario, grupo)
  // El administrador cambia de equipo aquí mismo; un coordinador cambia de cuenta: sale y entra con la otra.
  function elegirEquipo(id: string) {
    const elegido = id as Coordinator['grupo']
    if (!usuario?.colectivo) return setGrupo(elegido)
    if (elegido === coordinador.grupo) return
    setSugerido(elegido === 'organico' ? 'huerteros' : 'recicladores')
    void salir()
  }
  return (
    <CoordinatorModule
      key={coordinador.grupo}
      coordinator={coordinador}
      repository={repositorio}
      location={location}
      href={hashLink}
      demoChoices={EQUIPOS}
      onDemoChoice={elegirEquipo}
      trainingResources={recursos}
      publicTrainingHref={capacitacionHref}
      extraPages={{
        habilitar: <Registros porAceptar={porAceptar} />,
        informes: <Informes grupo={coordinador.grupo} />,
        canjes: <Canjes esAdmin={usuario.rol === 'administrador'} />,
        whatsapp: <Whatsapp />,
      }}
      badges={{ habilitar: porAceptar, whatsapp: sinLeer, canjes: porEntregar }}
      dashboardImpact={<Impacto grupo={coordinador.grupo} />}
      collectionsAction={<EntregaHuerta grupo={coordinador.grupo} />}
      onSignOut={() => void salir()}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
