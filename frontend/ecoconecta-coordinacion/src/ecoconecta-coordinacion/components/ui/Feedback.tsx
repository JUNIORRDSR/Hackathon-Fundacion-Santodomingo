import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function EmptyState({ title, children, icon = 'inbox' }: {
  title: string; children: ReactNode; icon?: IconName
}) {
  return (
    <div className="empty-state">
      <span className="icon-tile"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  )
}

export function LoadingState() {
  return (
    <div role="status" className="empty-state">
      <span className="spinner" aria-hidden="true" />
      <span>Cargando datos de coordinación…</span>
    </div>
  )
}

export function ErrorMessage({ message, retry, id }: { message: string; retry?: () => void; id?: string }) {
  return (
    <div className="error-message" role="alert" id={id}>
      <Icon name="alert" />
      <div>
        <p>{message}</p>
        {retry && <button className="button button-secondary" type="button" onClick={retry}>Reintentar</button>}
      </div>
    </div>
  )
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.'
}
