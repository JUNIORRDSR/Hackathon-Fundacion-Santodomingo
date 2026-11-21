import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Collector, CollectorInput, Zone } from '../../types'
import { ErrorMessage } from '../ui/Feedback'
import { Modal } from '../ui/Modal'
import type { CloseModal } from '../ui/Modal'
import { useSubmission } from '../ui/useSubmission'

// Los lugares salen del catálogo (ADR-0017): conjuntos agrupados por zona; el sistema sugiere a quien cubre
// el conjunto de cada solicitud. Marcar la zona completa marca todos sus conjuntos.
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
      zone: selected.length ? '' : 'Elige al menos un lugar.',
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

  function toggle(ids: string[], checked: boolean) {
    setSelected((previous) =>
      checked ? [...new Set([...previous, ...ids])] : previous.filter((item) => !ids.includes(item)),
    )
    setValidation((previous) => ({ ...previous, zone: '' }))
  }

  const choice = (place: { id: string; nombre: string }, label = place.nombre) => (
    <label key={place.id} className="checkbox-field">
      <input
        type="checkbox"
        checked={selected.includes(place.id)}
        disabled={submit.busy}
        onChange={(event) => toggle([place.id], event.target.checked)}
      />{' '}
      {label}
    </label>
  )

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
            <legend>Lugares que cubre</legend>
            {zones
              .filter((zone) => zone.activo !== false)
              .map((zone) => {
                const sets = (zone.conjuntos ?? []).filter((set) => set.activo !== false)
                if (!sets.length) return choice(zone)
                const ids = sets.map((set) => set.id)
                const marked = ids.filter((item) => selected.includes(item)).length
                return (
                  <div key={zone.id} className="place-group">
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={marked === ids.length}
                        ref={(input) => {
                          if (input) input.indeterminate = marked > 0 && marked < ids.length
                        }}
                        disabled={submit.busy}
                        onChange={(event) => toggle(ids, event.target.checked)}
                      />{' '}
                      {zone.nombre} completa
                    </label>
                    <div className="place-sets">{sets.map((set) => choice(set))}</div>
                  </div>
                )
              })}
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
