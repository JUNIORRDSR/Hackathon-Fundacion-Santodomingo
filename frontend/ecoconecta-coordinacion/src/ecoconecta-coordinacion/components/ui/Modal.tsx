import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previouslyFocused = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true })
      } else {
        document.querySelector<HTMLElement>('#eco-main h1')?.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <dialog ref={dialog} className="eco-dialog" aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <div className="dialog-content">
        <div className="dialog-header">
          <h2 id={id}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose} disabled={busy}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
