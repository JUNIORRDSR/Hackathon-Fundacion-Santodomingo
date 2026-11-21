import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { formatDate, formatWeight, groupLabels, isLocalDate, localDate, timeMinutes, wasteLabels } from '../../labels'
import type { Assignment, Collector, Request } from '../../types'
import type { EcoLink } from '../../routes'
import { ErrorMessage } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import type { CloseModal } from '../ui/Modal'
import { TimeField } from '../ui/TimeField'
import { useSubmission } from '../ui/useSubmission'
import { CancelRequest } from './CancelRequest'
import { StatusBadge, WasteIcon } from './RequestList'

export function RequestDetail({
  request,
  collectors,
  onAssign,
  onCancel,
  onClose,
  href,
}: {
  request: Request
  collectors: Collector[]
  onAssign: (assignment: Assignment) => Promise<() => void>
  onCancel: (id: string, motivo: string) => Promise<void>
  onClose: () => void
  href: EcoLink
}) {
  const id = useId()
  const submit = useSubmission()
  const [collectorId, setCollectorId] = useState('')
  const [date, setDate] = useState(localDate)
  const [hour, setHour] = useState('')
  const [validation, setValidation] = useState({ collector: '', date: '', hour: '' })
  const [photoFailed, setPhotoFailed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const active = collectors.filter((collector) => collector.activo && collector.grupo === request.tipo)
  const assigned = collectors.find((collector) => collector.id === request.asignacion?.recolectorId)

  function assign(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    const errors = {
      collector: collectorId ? '' : 'Selecciona un recolector.',
      date: isLocalDate(date) ? '' : 'Ingresa una fecha válida.',
      hour: hour && timeMinutes(hour) === undefined ? 'Ingresa una hora válida.' : '',
    }
    setValidation(errors)
    const invalid = Object.entries(errors).find(([, message]) => message)
    if (invalid) {
      document.getElementById(id + '-' + invalid[0])?.focus()
      return
    }
    void submit.run(async () => {
      const apply = await onAssign({
        solicitudId: request.id,
        recolectorId: collectorId,
        fecha: date,
        ...(hour ? { hora: hour } : {}),
      })
      await close(apply)
    })
  }

  return (
    <Modal title={'Solicitud ' + request.codigo} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <>
          <div className="detail-identity">
            <WasteIcon type={request.tipo} />
            <div>
              <strong>{request.solicitante}</strong>
              <p>{request.ubicacion}</p>
            </div>
            <StatusBadge status={request.estado} />
          </div>
          <dl className="detail-data">
            <div>
              <dt>Código en la bolsa</dt>
              <dd className="detail-codigo">{request.codigo}</dd>
            </div>
            <div>
              <dt>Tipo de residuo</dt>
              <dd>{wasteLabels[request.tipo]}</dd>
            </div>
            <div>
              <dt>Fecha de solicitud</dt>
              <dd>{formatDate(request.fecha, true)}</dd>
            </div>
            {request.asignacion && (
              <>
                <div>
                  <dt>Recolector</dt>
                  <dd>{assigned?.nombre ?? request.asignacion.recolectorId}</dd>
                </div>
                <div>
                  <dt>Recolección</dt>
                  <dd>
                    {formatDate(request.asignacion.fecha, true)} · {request.asignacion.hora ?? 'Sin hora'}
                  </dd>
                </div>
              </>
            )}
            {request.estado === 'recolectada' && (
              <div>
                <dt>Peso registrado</dt>
                <dd>{formatWeight(request.resultado.pesoKg)}</dd>
              </div>
            )}
            {request.puntos !== undefined && (
              <div>
                <dt>Puntos para el vecino</dt>
                <dd className="data-points">+{request.puntos}</dd>
              </div>
            )}
            {request.estado === 'rechazada' && (
              <div className="detail-wide">
                <dt>Motivo del rechazo</dt>
                <dd>{request.resultado.motivoRechazo}</dd>
              </div>
            )}
            {request.estado === 'cancelada' && request.motivo && (
              <div className="detail-wide">
                <dt>Motivo de la cancelación</dt>
                <dd>{request.motivo}</dd>
              </div>
            )}
            {request.horario && (
              <div>
                <dt>Horario que prefiere</dt>
                <dd>{request.horario}</dd>
              </div>
            )}
            {request.detalle && (
              <div className="detail-wide">
                <dt>Observaciones</dt>
                <dd>{request.detalle}</dd>
              </div>
            )}
          </dl>
          {request.fotoUrl &&
            (photoFailed ? (
              <p className="muted">No pudimos cargar la foto.</p>
            ) : (
              <img
                className="request-photo"
                alt={'Foto de los residuos de la solicitud ' + request.codigo}
                src={request.fotoUrl}
                onError={() => setPhotoFailed(true)}
              />
            ))}
          {request.estado === 'pendiente' && !cancelling && (
            <form className="dialog-form" onSubmit={(event) => assign(event, close)} noValidate>
              <h3>Asignar recolector</h3>
              {active.length ? (
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor={id + '-collector'}>Recolector</label>
                    <div className="select-field">
                      <select
                        id={id + '-collector'}
                        value={collectorId}
                        required
                        disabled={submit.busy}
                        aria-invalid={!!validation.collector}
                        aria-describedby={validation.collector ? id + '-collector-error' : undefined}
                        onChange={(event) => {
                          setCollectorId(event.target.value)
                          setValidation((prev) => ({ ...prev, collector: '' }))
                        }}
                      >
                        <option value="">Selecciona una persona</option>
                        {active.map((collector) => (
                          <option key={collector.id} value={collector.id}>
                            {collector.nombre}
                          </option>
                        ))}
                      </select>
                      <Icon name="chevron" />
                    </div>
                    {validation.collector && (
                      <span className="field-error" id={id + '-collector-error'}>
                        {validation.collector}
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor={id + '-date'}>Fecha de recolección</label>
                    <input
                      type="date"
                      id={id + '-date'}
                      value={date}
                      required
                      disabled={submit.busy}
                      aria-invalid={!!validation.date}
                      aria-describedby={validation.date ? id + '-date-error' : undefined}
                      onChange={(event) => {
                        setDate(event.target.value)
                        setValidation((prev) => ({ ...prev, date: '' }))
                      }}
                    />
                    {validation.date && (
                      <span className="field-error" id={id + '-date-error'}>
                        {validation.date}
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor={id + '-hour'}>Hora (opcional)</label>
                    <TimeField
                      id={id + '-hour'}
                      label="Hora de recolección"
                      value={hour}
                      disabled={submit.busy}
                      aria-invalid={!!validation.hour}
                      aria-describedby={validation.hour ? id + '-hour-error' : undefined}
                      onChange={(value) => {
                        setHour(value)
                        setValidation((prev) => ({ ...prev, hour: '' }))
                      }}
                    />
                    {validation.hour && (
                      <span className="field-error" id={id + '-hour-error'}>
                        {validation.hour}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="muted">
                  No hay integrantes activos en {groupLabels[request.tipo].toLowerCase()}.{' '}
                  <a href={href({ page: 'recolectores' })} onClick={onClose}>
                    Ver recolectores
                  </a>
                </p>
              )}
              {submit.error && <ErrorMessage message={submit.error} />}
              <div className="form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setCancelling(true)}
                  disabled={submit.busy}
                >
                  Cancelar solicitud
                </button>
                <button className="button button-primary" type="submit" disabled={!active.length || submit.busy}>
                  {submit.busy ? 'Guardando…' : submit.error ? 'Reintentar asignación' : 'Confirmar asignación'}
                </button>
              </div>
            </form>
          )}
          {request.estado === 'asignada' && !cancelling && (
            <div className="form-actions">
              <button type="button" className="button button-secondary" onClick={() => setCancelling(true)}>
                Cancelar solicitud
              </button>
              <a
                className="button button-primary"
                href={href({ page: 'recolecciones', requestId: request.id })}
                onClick={onClose}
              >
                Validar y registrar kilos
              </a>
            </div>
          )}
          {cancelling && (
            <CancelRequest onCancel={(motivo) => onCancel(request.id, motivo)} onBack={() => setCancelling(false)} />
          )}
        </>
      )}
    </Modal>
  )
}
