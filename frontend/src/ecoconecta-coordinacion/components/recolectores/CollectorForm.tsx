import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Collector, CollectorInput } from '../../types'
import { ErrorMessage } from '../ui/Feedback'
import { Modal } from '../ui/Modal'
import { useSubmission } from '../ui/useSubmission'

export function CollectorForm({
  collector,
  onClose,
  onSave,
}: {
  collector?: Collector
  onClose: () => void
  onSave: (input: CollectorInput, id?: string) => Promise<void>
}) {
  const id = useId()
  const [name, setName] = useState(collector?.nombre ?? '')
  const [zone, setZone] = useState(collector?.zona ?? '')
  const [active, setActive] = useState(collector?.activo ?? true)
  const [validation, setValidation] = useState({ name: '', zone: '' })
  const submit = useSubmission()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nombre = name.trim()
    const zona = zone.trim()
    const errors = { name: nombre ? '' : 'Escribe el nombre.', zone: zona ? '' : 'Escribe la zona.' }
    setValidation(errors)
    if (errors.name || errors.zone) {
      document.getElementById(id + (errors.name ? '-name' : '-zone'))?.focus()
      return
    }
    void submit.run(() => onSave({ nombre, zona, activo: active }, collector?.id))
  }

  return (
    <Modal title={collector ? 'Editar recolector' : 'Agregar recolector'} onClose={onClose} busy={submit.busy}>
      <form className="dialog-form" noValidate onSubmit={save}>
        <div className="field">
          <label htmlFor={id + '-name'}>Nombre</label>
          <input
            id={id + '-name'}
            value={name}
            required
            disabled={submit.busy}
            aria-invalid={!!validation.name}
            aria-describedby={validation.name ? id + '-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              setValidation((prev) => ({ ...prev, name: '' }))
            }}
          />
          {validation.name && (
            <span className="field-error" id={id + '-name-error'}>
              {validation.name}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor={id + '-zone'}>Zona</label>
          <input
            id={id + '-zone'}
            value={zone}
            required
            disabled={submit.busy}
            aria-invalid={!!validation.zone}
            aria-describedby={validation.zone ? id + '-zone-error' : undefined}
            onChange={(event) => {
              setZone(event.target.value)
              setValidation((prev) => ({ ...prev, zone: '' }))
            }}
          />
          {validation.zone && (
            <span className="field-error" id={id + '-zone-error'}>
              {validation.zone}
            </span>
          )}
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={active}
            disabled={submit.busy}
            onChange={(event) => setActive(event.target.checked)}
          />{' '}
          Disponible para nuevas asignaciones
        </label>
        {submit.error && <ErrorMessage message={submit.error} />}
        <div className="form-actions">
          <button type="button" className="button button-secondary" disabled={submit.busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={submit.busy}>
            {submit.busy ? 'Guardando…' : submit.error ? 'Reintentar' : 'Guardar recolector'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
