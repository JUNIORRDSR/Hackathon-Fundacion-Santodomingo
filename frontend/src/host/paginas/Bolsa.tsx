import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Request } from '../../ecoconecta-coordinacion'
import { formatDate, formatWeight, localDate, wasteLabels } from '../../ecoconecta-coordinacion/labels'
import { CollectionResultForm } from '../../ecoconecta-coordinacion/components/recolecciones/CollectionResultForm'
import { StatusBadge, WasteIcon } from '../../ecoconecta-coordinacion/components/solicitudes/RequestList'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MonarchMark } from '../../ecoconecta-coordinacion/components/ui/MonarchMark'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { api } from '../api'
import { asignar, guardarResultado } from '../repositorio'

export interface Hogar {
  nombre: string
  zona: string
  habilitado: boolean
  solicitudes: Request[]
}
type Lista = Request & { estado: 'asignada' }

// Lo que trajo el QR: el hogar y su solicitud abierta. Se valida con el mismo formulario de Recolecciones.
export function Bolsa({
  hogar,
  onRegistrada,
  onSeguir,
}: {
  hogar: Hogar
  onRegistrada: (solicitud: Request) => void
  onSeguir: () => void
}) {
  return (
    <div className="bolsa">
      <div className="detail-identity">
        {hogar.solicitudes[0] ? <WasteIcon type={hogar.solicitudes[0].tipo} /> : <Icon name="user" />}
        <div>
          <strong>{hogar.nombre}</strong>
          <p>{hogar.zona}</p>
        </div>
      </div>
      {hogar.solicitudes.map((solicitud) => (
        <Abierta key={solicitud.id} solicitud={solicitud} onRegistrada={onRegistrada} />
      ))}
      {!hogar.solicitudes.length && (
        <p className="bolsa-aviso">
          <Icon name="info" />
          {hogar.habilitado
            ? 'No tiene solicitudes abiertas de tu colectivo. Puede pedir por WhatsApp o la registras en Solicitudes.'
            : 'Este hogar todavía espera que lo acepten en Registros.'}
        </p>
      )}
      <button type="button" className="button button-secondary" onClick={onSeguir}>
        <Icon name="qr" /> {hogar.solicitudes.length ? 'Cancelar y seguir escaneando' : 'Seguir escaneando'}
      </button>
    </div>
  )
}

function Abierta({ solicitud, onRegistrada }: { solicitud: Request; onRegistrada: (solicitud: Request) => void }) {
  const [validando, setValidando] = useState<Lista>()
  return (
    <section className="bolsa-solicitud" aria-label={'Solicitud ' + solicitud.codigo}>
      <dl className="detail-data">
        <div>
          <dt>Código en la bolsa</dt>
          <dd className="detail-codigo">{solicitud.codigo}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <StatusBadge status={solicitud.estado} />
          </dd>
        </div>
        <div>
          <dt>Residuo</dt>
          <dd>{wasteLabels[solicitud.tipo]}</dd>
        </div>
        <div>
          <dt>{solicitud.asignacion ? 'Asignada para' : 'Pidió'}</dt>
          <dd>{solicitud.asignacion ? formatDate(solicitud.asignacion.fecha) : formatDate(solicitud.fecha)}</dd>
        </div>
      </dl>
      {solicitud.estado === 'asignada' ? (
        <button type="button" className="button button-primary" autoFocus onClick={() => setValidando(solicitud)}>
          <Icon name="scale" /> Registrar el peso
        </button>
      ) : (
        <Asignar solicitud={solicitud} onAsignada={setValidando} />
      )}
      {validando && (
        <CollectionResultForm
          request={validando}
          onSave={async (resultado) => {
            const guardada = await guardarResultado(resultado)
            return () => onRegistrada(guardada)
          }}
          onClose={() => setValidando(undefined)}
        />
      )}
    </section>
  )
}

// Sigue pendiente: se asigna para hoy a quien trajo la bolsa (sin hora no se avisa al vecino, RN-02) y se pesa.
function Asignar({ solicitud, onAsignada }: { solicitud: Request; onAsignada: (lista: Lista) => void }) {
  const id = useId()
  const submit = useSubmission()
  const [encargados, setEncargados] = useState<{ id: string; nombre: string }[]>()
  const [elegido, setElegido] = useState('')
  useEffect(() => {
    const control = new AbortController()
    api<{ id: string; nombre: string }[]>(`/solicitudes/${solicitud.id}/sugerencias`, 'GET', undefined, control.signal)
      .then((lista) => {
        setEncargados(lista)
        setElegido(lista[0]?.id ?? '')
      })
      .catch(() => control.signal.aborted || setEncargados([]))
    return () => control.abort()
  }, [solicitud.id])

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(async () => {
      const asignada = await asignar({ solicitudId: solicitud.id, recolectorId: elegido, fecha: localDate() })
      if (asignada.estado === 'asignada') onAsignada(asignada)
    })
  }

  return (
    <form className="dialog-form" onSubmit={enviar}>
      <div className="field">
        <label htmlFor={id}>¿Quién trajo la bolsa?</label>
        <select
          id={id}
          value={elegido}
          disabled={!encargados || submit.busy}
          onChange={(e) => setElegido(e.target.value)}
        >
          {encargados?.length === 0 && <option value="">No hay recolectores activos</option>}
          {encargados?.map((encargado) => (
            <option key={encargado.id} value={encargado.id}>
              {encargado.nombre}
            </option>
          ))}
        </select>
        <span className="field-help">Sigue pendiente: queda asignada para hoy y luego registras el peso.</span>
      </div>
      {submit.error && <ErrorMessage message={submit.error} />}
      <button className="button button-primary" type="submit" disabled={!elegido || submit.busy}>
        <Icon name="scale" /> {submit.busy ? 'Asignando…' : 'Asignar y registrar el peso'}
      </button>
    </form>
  )
}

export function Registrada({ solicitud, onSiguiente }: { solicitud: Request; onSiguiente: () => void }) {
  const kg = solicitud.estado === 'recolectada' ? solicitud.resultado.pesoKg : undefined
  const siguiente = useRef<HTMLButtonElement>(null)
  // Después de que el diálogo devuelve el foco: Enter sigue con la próxima bolsa.
  useEffect(() => siguiente.current?.focus({ preventScroll: true }), [])
  return (
    <div className="bolsa-lista">
      {kg !== undefined ? (
        <MonarchMark className="monarch-celebra" />
      ) : (
        <span className="icon-tile">
          <Icon name="xCircle" />
        </span>
      )}
      <h2>{kg !== undefined ? 'Bolsa registrada' : 'Rechazo registrado'}</h2>
      {solicitud.puntos !== undefined && <p className="bolsa-puntos">+{solicitud.puntos} puntos</p>}
      <p>
        {solicitud.solicitante} · {solicitud.codigo}
        {kg !== undefined && ' · ' + formatWeight(kg)}
      </p>
      <p className="muted">
        {kg !== undefined
          ? 'Le llega por WhatsApp el aviso con sus puntos.'
          : 'Le llega por WhatsApp el motivo y una guía para separar mejor.'}
      </p>
      <button ref={siguiente} type="button" className="button button-primary" onClick={onSiguiente}>
        <Icon name="qr" /> Escanear la siguiente bolsa
      </button>
    </div>
  )
}
