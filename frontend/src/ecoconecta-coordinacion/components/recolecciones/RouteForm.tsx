import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { timeMinutes } from '../../labels'
import type { CollectionRoute, CollectionRouteInput, Collector, Zone } from '../../types'
import { ErrorMessage } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import type { CloseModal } from '../ui/Modal'
import { TimeField } from '../ui/TimeField'
import { useSubmission } from '../ui/useSubmission'
import { routeSectors } from './routePlaces'
import { weekdays } from './routeSchedule'

function placeOptions(zone: Zone, route?: CollectionRoute) {
  const sectors = routeSectors(zone, route?.conjuntoId)
  const wholeZone = route?.zonaId === zone.id && route.conjuntoId === null
  if (!sectors.length || (sectors.length === 1 && wholeZone)) {
    return (
      <option key={zone.id} value={zone.id}>
        {zone.nombre}
      </option>
    )
  }
  const options = sectors.map((item) => (
    <option key={item.id} value={item.id}>
      {item.nombre}
      {item.activo === false ? ' (inactivo)' : ''}
    </option>
  ))
  if (options.length === 1) return options[0]
  return (
    <optgroup key={zone.id} label={zone.nombre}>
      <option value={zone.id}>{zone.nombre} completa</option>
      {options}
    </optgroup>
  )
}

export function RouteForm({
  route,
  collectors,
  zones,
  initialCollector,
  initialZone,
  onClose,
  onSave,
}: {
  route?: CollectionRoute
  collectors: Collector[]
  zones: Zone[]
  initialCollector: string
  initialZone: string
  onClose: () => void
  onSave: (input: CollectionRouteInput, id?: string) => Promise<() => void>
}) {
  const id = useId()
  const [name, setName] = useState(route?.nombre ?? '')
  const [placeId, setPlaceId] = useState(() => {
    if (route) return route.conjuntoId ?? route.zonaId
    const initial = zones.find((item) => item.id === initialZone)
    const sectors = initial ? routeSectors(initial) : []
    return sectors.length === 1 ? sectors[0].id : initialZone
  })
  const [collectorId, setCollectorId] = useState(route?.encargadoId ?? initialCollector)
  const [days, setDays] = useState(route?.dias ?? [])
  const [start, setStart] = useState(route?.horaInicio ?? '')
  const [end, setEnd] = useState(route?.horaFin ?? '')
  const [published, setPublished] = useState(route?.publicada ?? false)
  const [checkedDays, setCheckedDays] = useState(false)
  const submit = useSubmission()
  const zone = zones.find((item) => item.id === placeId || item.conjuntos?.some((set) => set.id === placeId))
  const sector = zone?.conjuntos?.find((item) => item.id === placeId)
  const collector = collectors.find((item) => item.id === collectorId)
  const canPublish = !!(collector?.activo && zone && zone.activo !== false && sector?.activo !== false)
  const startMinutes = timeMinutes(start)
  const endMinutes = timeMinutes(end)
  const invalidHours = startMinutes !== undefined && endMinutes !== undefined && endMinutes <= startMinutes
  const defaultName = sector?.nombre ?? zone?.nombre ?? ''
  const daysError = checkedDays && !days.length

  function selectPlace(value: string) {
    setPlaceId(value)
    if (collectorId) return
    const selectedZone = zones.find((item) => item.id === value)
    const sectors = selectedZone ? routeSectors(selectedZone) : []
    const coverage = sectors.length ? sectors.map((item) => item.id) : [value]
    const matches = collectors.filter((item) => item.activo && coverage.every((place) => item.zonas.includes(place)))
    if (matches.length === 1) setCollectorId(matches[0].id)
  }

  function save(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    setCheckedDays(true)
    if (!days.length) {
      document.getElementById(id + '-days')?.focus()
      return
    }
    if (
      !zone ||
      !collector ||
      startMinutes === undefined ||
      endMinutes === undefined ||
      invalidHours ||
      (published && !canPublish)
    )
      return
    const input: CollectionRouteInput = {
      nombre: name.trim() || defaultName,
      zonaId: zone.id,
      conjuntoId: sector?.id ?? null,
      encargadoId: collector.id,
      dias: [...days].sort((a, b) => a - b),
      horaInicio: start,
      horaFin: end,
      publicada: published,
    }
    void submit.run(async () => {
      const apply = await onSave(input, route?.id)
      await close(apply)
    })
  }

  return (
    <Modal title={route ? 'Editar ruta' : 'Nueva ruta'} busy={submit.busy} onClose={onClose}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => save(event, close)}>
          <div className="field">
            <label htmlFor={id + '-place'}>Etapa o sector</label>
            <div className="select-field">
              <select
                id={id + '-place'}
                required
                disabled={submit.busy}
                value={placeId}
                onChange={(event) => selectPlace(event.target.value)}
              >
                <option value="">Selecciona un lugar</option>
                {zones
                  .filter((item) => item.activo !== false || item.id === route?.zonaId)
                  .map((item) => placeOptions(item, route))}
              </select>
              <Icon name="chevron" />
            </div>
          </div>
          <div className="field">
            <label htmlFor={id + '-collector'}>Responsable</label>
            <select
              id={id + '-collector'}
              required
              disabled={submit.busy}
              value={collectorId}
              onChange={(event) => setCollectorId(event.target.value)}
            >
              <option value="">Selecciona un integrante</option>
              {collectors
                .filter((item) => item.activo || item.id === route?.encargadoId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                    {item.activo ? '' : ' (inactivo)'}
                  </option>
                ))}
            </select>
          </div>
          <fieldset
            id={id + '-days'}
            className="route-days"
            tabIndex={-1}
            disabled={submit.busy}
            aria-describedby={daysError ? id + '-days-error' : undefined}
          >
            <legend>Días de recolección</legend>
            <div className="route-day-options">
              {weekdays.map((day, index) => (
                <label className="checkbox-field" key={day}>
                  <input
                    type="checkbox"
                    checked={days.includes(index)}
                    onChange={(event) =>
                      setDays(event.target.checked ? [...days, index] : days.filter((item) => item !== index))
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
            {daysError && (
              <p role="alert" className="field-error" id={id + '-days-error'}>
                Elige al menos un día.
              </p>
            )}
          </fieldset>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={id + '-start'}>Hora de inicio</label>
              <TimeField
                id={id + '-start'}
                label="Hora de inicio"
                required
                disabled={submit.busy}
                value={start}
                onChange={setStart}
              />
            </div>
            <div className="field">
              <label htmlFor={id + '-end'}>Hora de fin</label>
              <TimeField
                id={id + '-end'}
                label="Hora de fin"
                required
                disabled={submit.busy}
                value={end}
                aria-invalid={invalidHours || undefined}
                aria-describedby={invalidHours ? id + '-time-error' : undefined}
                onChange={setEnd}
              />
            </div>
          </div>
          {invalidHours && (
            <p className="field-error" id={id + '-time-error'}>
              La hora de fin debe ser posterior a la de inicio.
            </p>
          )}
          <div className="field">
            <label htmlFor={id + '-name'}>Nombre de la ruta (opcional)</label>
            <input
              id={id + '-name'}
              value={name}
              placeholder={defaultName || 'Se usa el nombre del lugar'}
              minLength={2}
              maxLength={80}
              disabled={submit.busy}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={published}
              disabled={submit.busy || (!published && !canPublish)}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Mostrar en Capacitación pública
          </label>
          {published && !canPublish && (
            <p className="field-error">Elige un lugar y un responsable activos, o desmarca la publicación.</p>
          )}
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
            <button type="submit" className="button button-primary" disabled={submit.busy}>
              {submit.busy ? 'Guardando…' : 'Guardar ruta'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
