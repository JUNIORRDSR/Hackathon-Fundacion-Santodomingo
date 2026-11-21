import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { CoordinatorModule, PublicTrainingModule } from './ecoconecta-coordinacion'
import type { Coordinator, TrainingResource } from './ecoconecta-coordinacion'
import { hashLink, readHash } from './ecoconecta-coordinacion/routes'
import { ErrorMessage, LoadingState } from './ecoconecta-coordinacion/components/ui/Feedback'
import { Layout } from './ecoconecta-coordinacion/components/layout/Layout'
import { useRepositoryQuery } from './ecoconecta-coordinacion/services/useCoordinatorData'
import './host/host.css'
import { api } from './host/api'
import { capacitacionPublica, crearRepositorio, recursoDe } from './host/repositorio'
import { iniciarRecorrido, recorridoPendiente } from './host/recorrido'
import { rutasPublicas } from './host/rutas'
import { useSesion } from './host/sesion'
import type { Usuario } from './host/sesion'
import { Canjes } from './host/paginas/Canjes'
import { Configuracion } from './host/paginas/configuracion/Configuracion'
import { Entrar } from './host/paginas/Entrar'
import { EntregaHuerta } from './host/paginas/EntregaHuerta'
import { Escanear } from './host/paginas/Escanear'
import { Impacto } from './host/paginas/Impacto'
import { Informes } from './host/paginas/Informes'
import { Registros } from './host/paginas/Registros'
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
  const { state, reload } = useRepositoryQuery(capacitacionPublica)
  return (
    <PublicTrainingModule
      resources={state?.status === 'ready' ? state.data : []}
      href={() => capacitacionHref}
      loadRoutes={rutasPublicas}
      resourcesFeedback={
        !state ? (
          <p role="status">Cargando guías…</p>
        ) : state.status === 'error' ? (
          <ErrorMessage message="No se pudieron cargar las guías." retry={reload} />
        ) : undefined
      }
    />
  )
}

function App() {
  const hash = useSyncExternalStore(suscribir, leerHash)
  const location = readHash(hash)
  const { usuario, cargando, aviso, entrar, registrar, salir, actualizarPerfil, claveCambiada } = useSesion()
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
    if (usuario) {
      void api<Parameters<typeof recursoDe>[0][]>('/contenidos')
        .then((c) => setRecursos(c.map(recursoDe)))
        .catch(() => {})
    }
  }, [usuario])

  // La primera vez que alguien entra en este navegador, el recorrido arranca solo cuando el Inicio ya cargó.
  useEffect(() => {
    if (!usuario || !recorridoPendiente()) return
    const espera = window.setTimeout(() => iniciarRecorrido(usuario.rol === 'administrador'), 1200)
    return () => window.clearTimeout(espera)
  }, [usuario])

  if (location.page === 'capacitacion' && new URLSearchParams(hash.split('?')[1]).get('publica') === '1') {
    return <Capacitacion />
  }
  if (cargando) return <Cargando />
  if (!usuario) {
    return <Entrar key={sugerido} onEntrar={entrar} onRegistrar={registrar} usuarioInicial={sugerido} aviso={aviso} />
  }
  const esAdmin = usuario.rol === 'administrador'
  const coordinador = coordinadorDe(usuario, grupo)
  // El administrador cambia de equipo aquí mismo; un coordinador cambia de cuenta: sale y entra con la otra.
  function elegirEquipo(id: string) {
    const elegido = id as Coordinator['grupo']
    if (!usuario?.colectivo) return setGrupo(elegido)
    if (elegido === coordinador.grupo) return
    setSugerido(elegido === 'organico' ? 'rosa' : 'carlos')
    void salir()
  }
  return (
    <CoordinatorModule
      key={coordinador.grupo}
      coordinator={coordinador}
      repository={repositorio}
      location={!esAdmin && location.page === 'configuracion' ? { page: 'inicio' } : location}
      href={hashLink}
      demoChoices={EQUIPOS}
      onDemoChoice={elegirEquipo}
      trainingResources={recursos}
      publicTrainingHref={capacitacionHref}
      extraPages={{
        escanear: <Escanear />,
        habilitar: (
          <Registros
            porAceptar={porAceptar}
            vista={location.recordsView ?? 'aceptar'}
            onVista={(recordsView) => {
              window.location.hash = hashLink({ page: 'habilitar', recordsView })
            }}
          />
        ),
        informes: <Informes grupo={coordinador.grupo} />,
        canjes: <Canjes esAdmin={esAdmin} />,
        whatsapp: <Whatsapp />,
        ...(esAdmin && {
          configuracion: (
            <Configuracion
              usuario={usuario}
              onPerfil={actualizarPerfil}
              onClavePropia={() => {
                setSugerido(usuario.usuario)
                claveCambiada()
              }}
            />
          ),
        }),
      }}
      badges={{ habilitar: porAceptar, whatsapp: sinLeer, canjes: porEntregar }}
      dashboardImpact={<Impacto grupo={coordinador.grupo} />}
      collectionsAction={<EntregaHuerta grupo={coordinador.grupo} />}
      onSignOut={() => void salir()}
      onTour={() => iniciarRecorrido(esAdmin)}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
