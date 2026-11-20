import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export type CloseModal = (after?: () => void) => Promise<void>

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: (close: CloseModal) => ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

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

  const close: CloseModal = async (after) => {
    if (closing.current) return
    closing.current = true
    const element = dialog.current
    if (element?.isConnected) {
      element.dataset.closing = 'true'
      if (content.current) content.current.inert = true
      await Promise.allSettled(element.getAnimations?.().map((animation) => animation.finished) ?? [])
    }
    after?.()
    if (element?.isConnected) onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="eco-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) void close()
      }}
    >
      <div ref={content} className="dialog-content">
        <div className="dialog-header">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={() => void close()}
            disabled={busy}
          >
            <Icon name="close" />
          </button>
        </div>
        {children(close)}
      </div>
    </dialog>
  )
}
