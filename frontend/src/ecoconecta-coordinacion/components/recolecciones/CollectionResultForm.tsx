import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { CollectionResult, Request } from '../../types'
import { ErrorMessage } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import type { CloseModal } from '../ui/Modal'
import { useSubmission } from '../ui/useSubmission'

export function CollectionResultForm({
  request,
  onSave,
  onClose,
}: {
  request: Request & { estado: 'asignada' }
  onSave: (result: CollectionResult) => Promise<() => void>
  onClose: () => void
}) {
  const id = useId()
  const [status, setStatus] = useState<CollectionResult['estado']>('recolectada')
  const [weight, setWeight] = useState('')
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')
  const submit = useSubmission()

  function save(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    const pesoKg = Number(weight.trim().replace(',', '.'))
    const motivoRechazo = reason.trim()
    const collected = status === 'recolectada'
    const validWeight = /^\d*(?:[.,]\d+)?$/.test(weight.trim()) && Number.isFinite(pesoKg) && pesoKg > 0
    const message = collected
      ? validWeight
        ? ''
        : 'Ingresa un peso válido mayor que cero, en kilogramos.'
      : motivoRechazo
        ? ''
        : 'Escribe el motivo del rechazo.'
    setValidation(message)
    if (message) {
      document.getElementById(id + '-value')?.focus()
      return
    }
    const result: CollectionResult = collected
      ? { solicitudId: request.id, estado: status, pesoKg }
      : { solicitudId: request.id, estado: status, motivoRechazo }
    void submit.run(async () => {
      const apply = await onSave(result)
      await close(apply)
    })
  }

  return (
    <Modal title="Validar la recolección" onClose={onClose} busy={submit.busy}>
      {(close) => (
        <>
          <p className="muted">
            {request.codigo} · {request.solicitante}
          </p>
          <form className="dialog-form" noValidate onSubmit={(event) => save(event, close)}>
            <fieldset disabled={submit.busy}>
              <legend>¿Qué pasó en la recolección?</legend>
              <div className="outcome-options">
                <label className="outcome-option">
                  <input
                    type="radio"
                    name={id}
                    checked={status === 'recolectada'}
                    onChange={() => {
                      setStatus('recolectada')
                      setValidation('')
                    }}
                  />
                  <Icon name="checkCircle" /> Recolectada
                </label>
                <label className="outcome-option">
                  <input
                    type="radio"
                    name={id}
                    checked={status === 'rechazada'}
                    onChange={() => {
                      setStatus('rechazada')
                      setValidation('')
                    }}
                  />
                  <Icon name="xCircle" /> Rechazada
                </label>
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor={id + '-value'}>
                {status === 'recolectada' ? 'Peso real (kg)' : 'Motivo del rechazo'}
              </label>
              {status === 'recolectada' ? (
                <input
                  id={id + '-value'}
                  inputMode="decimal"
                  placeholder="Ej. 3,5"
                  value={weight}
                  required
                  aria-invalid={!!validation}
                  aria-describedby={validation ? id + '-error' : undefined}
                  disabled={submit.busy}
                  onChange={(event) => {
                    setWeight(event.target.value)
                    setValidation('')
                  }}
                />
              ) : (
                <textarea
                  id={id + '-value'}
                  rows={4}
                  value={reason}
                  required
                  aria-invalid={!!validation}
                  aria-describedby={validation ? id + '-error' : undefined}
                  disabled={submit.busy}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setValidation('')
                  }}
                />
              )}
              {validation && (
                <span id={id + '-error'} className="field-error">
                  {validation}
                </span>
              )}
            </div>
            {submit.error && <ErrorMessage message={submit.error} />}
            <div className="form-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void close()}
                disabled={submit.busy}
              >
                Cancelar
              </button>
              <button className="button button-primary" type="submit" disabled={submit.busy}>
                {submit.busy ? 'Guardando…' : submit.error ? 'Reintentar registro' : 'Validar y dar puntos'}
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  )
}
