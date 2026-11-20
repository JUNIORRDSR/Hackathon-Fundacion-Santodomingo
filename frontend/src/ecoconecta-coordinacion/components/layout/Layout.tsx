import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import villasLogo from '../../../../identidad-visual/Logo villas de san pablo - transparente.png'
import foundationLogo from '../../../../identidad-visual/Logo Santo Domingo - transparente.png'
import { groupLabels } from '../../labels'
import type { EcoLink, EcoPage } from '../../routes'
import type { Coordinator } from '../../types'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { BrandLogo } from './BrandLogo'
import { MotionPills } from '../ui/MotionPills'
import { animateMotion } from '../ui/motion'
import { useRouteScene } from './useRouteScene'
import { useBentoMotion } from './useBentoMotion'

const navigation: { page: EcoPage; label: string; icon: IconName }[] = [
  { page: 'inicio', label: 'Inicio', icon: 'dashboard' },
  { page: 'solicitudes', label: 'Solicitudes', icon: 'clipboard' },
  { page: 'recolecciones', label: 'Recolecciones', icon: 'truck' },
  { page: 'recolectores', label: 'Recolectores', icon: 'users' },
  { page: 'capacitacion', label: 'Capacitación', icon: 'book' },
  { page: 'habilitar', label: 'Registros', icon: 'user' },
  { page: 'canjes', label: 'Canjes', icon: 'gift' },
]
const modulePages: EcoPage[] = ['inicio', 'solicitudes', 'recolecciones', 'recolectores', 'capacitacion']

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function CoordinatorIdentity({
  coordinator,
  choices,
  onChange,
  demo,
}: {
  coordinator: Coordinator
  choices?: Coordinator[]
  onChange?: (id: string) => void
  demo: boolean
}) {
  const initials = coordinator.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
  return (
    <div className="coordinator-profile">
      <span className="profile-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="profile-copy">
        <strong>{coordinator.nombre}</strong>
        <span>Coord. de {groupLabels[coordinator.grupo].toLowerCase()}</span>
      </div>
      {choices && onChange && (
        <>
          <Icon name="chevron" className="profile-chevron" />
          <select
            aria-label={demo ? 'Cambiar equipo de demostración' : 'Cambiar de equipo'}
            value={coordinator.id}
            onChange={(event) => onChange(event.target.value)}
          >
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {groupLabels[item.grupo]}
                {demo ? ' (demo)' : ''}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

export function Layout({
  page,
  href,
  coordinator,
  choices,
  onChange,
  demo,
  extraPages = [],
  onSignOut,
  children,
}: {
  page: EcoPage
  href: EcoLink
  coordinator?: Coordinator
  choices?: Coordinator[]
  onChange?: (id: string) => void
  demo: boolean
  extraPages?: EcoPage[]
  onSignOut?: () => void
  children: ReactNode
}) {
  const visible = navigation.filter((item) => modulePages.includes(item.page) || extraPages.includes(item.page))
  const main = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const { visiblePage, content } = useRouteScene(
    page,
    <>
      {demo && page !== 'inicio' && page !== 'capacitacion' && (
        <span className="demo-note">
          <Icon name="info" /> Modo demo · Los registros son ficticios
        </span>
      )}
      {children}
    </>,
    stage,
  )
  useBentoMotion(stage, visiblePage)
  const lastPage = useRef(page)
  useLayoutEffect(() => {
    document.title = 'EcoConecta | ' + (navigation.find((item) => item.page === visiblePage)?.label ?? 'WhatsApp')
    if (lastPage.current !== visiblePage) {
      window.scrollTo(0, 0)
      main.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
      lastPage.current = visiblePage
    }
    const element = stage.current
    if (!element || element.hasAttribute('data-route-transition')) return
    const animation = animateMotion(
      element,
      [
        { opacity: 0.88, translate: '0 7px', scale: 0.994 },
        { opacity: 1, translate: '0 0', scale: 1 },
      ],
      '--motion-route',
    )
    return () => animation?.cancel()
  }, [visiblePage])

  return (
    <div className="eco-app">
      <a
        className="skip-link"
        href="#eco-main"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Saltar al contenido
      </a>
      <header className="topbar">
        <div className="site-width topbar-inner">
          <BrandLogo href={href({ page: coordinator ? 'inicio' : 'capacitacion' })} />
          {coordinator && (
            <>
              <MotionPills as="nav" className="main-nav" label="Navegación principal" active={page}>
                {visible.map(({ page: target, label, icon }) => (
                  <a key={target} href={href({ page: target })} aria-current={page === target ? 'page' : undefined}>
                    <Icon name={icon} />
                    <span>{label}</span>
                  </a>
                ))}
              </MotionPills>
              <div className="topbar-actions">
                <CoordinatorIdentity coordinator={coordinator} choices={choices} onChange={onChange} demo={demo} />
                {onSignOut && (
                  <button type="button" className="icon-button" onClick={onSignOut} aria-label="Salir" title="Salir">
                    <Icon name="logout" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>
      <main id="eco-main" className="site-width main-content" tabIndex={-1} ref={main}>
        <div className="motion-route-stage" ref={stage}>
          {content}
        </div>
      </main>
      {coordinator && extraPages.includes('whatsapp') && page !== 'whatsapp' && (
        <a className="whatsapp-fab" href={href({ page: 'whatsapp' })} aria-label="Abrir el monitor de WhatsApp">
          <Icon name="chat" />
          <span>WhatsApp</span>
        </a>
      )}
      <footer className="site-width site-footer">
        <p>
          EcoConecta <span>·</span> Villas de San Pablo, Barranquilla
        </p>
        <div className="partner-logos">
          <img src={villasLogo} alt="Villas de San Pablo" width="94" height="34" />
          <img src={foundationLogo} alt="Fundación Santo Domingo" width="92" height="50" />
        </div>
      </footer>
    </div>
  )
}
