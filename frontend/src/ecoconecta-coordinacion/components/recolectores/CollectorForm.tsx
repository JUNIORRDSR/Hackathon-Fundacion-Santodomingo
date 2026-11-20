import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Collector, CollectorInput, Zone } from '../../types'
import { ErrorMessage } from '../ui/Feedback'
import { Modal } from '../ui/Modal'
import type { CloseModal } from '../ui/Modal'
import { useSubmission } from '../ui/useSubmission'

// Las zonas salen del catálogo: el sistema sugiere a quien cubre la zona de cada solicitud.
export function CollectorForm({
  collector,
  zones,
  onClose,
  onSave,
}: {
  collector?: Collector
  zones: Zone[]
  onClose: () => void
  onSave: (input: CollectorInput, id?: string) => Promise<() => void>
}) {
  const id = useId()
  const [name, setName] = useState(collector?.nombre ?? '')
  const [selected, setSelected] = useState<string[]>(collector?.zonas ?? [])
  const [active, setActive] = useState(collector?.activo ?? true)
  const [validation, setValidation] = useState({ name: '', zone: '' })
  const submit = useSubmission()

  function save(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    const nombre = name.trim()
    const errors = {
      name: nombre ? '' : 'Escribe el nombre.',
      zone: selected.length ? '' : 'Elige al menos una zona.',
    }
    setValidation(errors)
    if (errors.name || errors.zone) {
      document.getElementById(id + (errors.name ? '-name' : '-zone'))?.focus()
      return
    }
    void submit.run(async () => {
      const apply = await onSave({ nombre, zonas: selected, activo: active }, collector?.id)
      await close(apply)
    })
  }

  function toggle(zone: string, checked: boolean) {
    setSelected((previous) => (checked ? [...previous, zone] : previous.filter((item) => item !== zone)))
    setValidation((previous) => ({ ...previous, zone: '' }))
  }

  return (
    <Modal title={collector ? 'Editar recolector' : 'Agregar recolector'} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <form className="dialog-form" noValidate onSubmit={(event) => save(event, close)}>
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
          <fieldset className="field" id={id + '-zone'} tabIndex={-1}>
            <legend>Zonas que cubre</legend>
            {zones.map((zone) => (
              <label key={zone.id} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={selected.includes(zone.id)}
                  disabled={submit.busy}
                  onChange={(event) => toggle(zone.id, event.target.checked)}
                />{' '}
                {zone.nombre}
              </label>
            ))}
            {validation.zone && <span className="field-error">{validation.zone}</span>}
          </fieldset>
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
            <button
              type="button"
              className="button button-secondary"
              disabled={submit.busy}
              onClick={() => void close()}
            >
              Cancelar
            </button>
            <button className="button button-primary" type="submit" disabled={submit.busy}>
              {submit.busy ? 'Guardando…' : submit.error ? 'Reintentar' : 'Guardar recolector'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
