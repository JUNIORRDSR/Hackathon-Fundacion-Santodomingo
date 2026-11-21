import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../ui/Feedback'
import { useSubmission } from '../ui/useSubmission'

// Cancelar pide un motivo: queda en el historial y al vecino le llega por WhatsApp.
export function CancelRequest({ onCancel }: { onCancel: (motivo: string) => Promise<void> }) {
  const id = useId()
  const submit = useSubmission()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 3

  if (!open) {
    return (
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => setOpen(true)}>
          Cancelar solicitud
        </button>
      </div>
    )
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid) void submit.run(() => onCancel(reason.trim()))
  }

  return (
    <form className="dialog-form" onSubmit={save} noValidate>
      <h3>Cancelar solicitud</h3>
      <div className="field">
        <label htmlFor={id}>Motivo</label>
        <input id={id} value={reason} disabled={submit.busy} onChange={(event) => setReason(event.target.value)} />
      </div>
      {submit.error && <ErrorMessage message={submit.error} />}
      <div className="form-actions">
        <button type="button" className="button button-secondary" disabled={submit.busy} onClick={() => setOpen(false)}>
          Volver
        </button>
        <button type="submit" className="button button-primary" disabled={submit.busy || !valid}>
          {submit.busy ? 'Guardando…' : 'Confirmar cancelación'}
        </button>
      </div>
    </form>
  )
}
