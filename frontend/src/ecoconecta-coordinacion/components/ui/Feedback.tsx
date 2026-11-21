import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { MonarchMark } from './MonarchMark'

// Todo vacío, o lo que todavía falta, lo acompaña la monarca de Villas de San Pablo aleteando.
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <MonarchMark />
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
        {retry && (
          <button className="button button-secondary" type="button" onClick={retry}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.'
}
