import { useCallback, useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import type { CloseModal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { api } from '../api'

interface Premio {
  id?: string
  nombre: string
  costo: number
  activo: boolean
  ejemplo?: boolean
}
const NUEVO: Premio = { nombre: '', costo: 30, activo: true }

// La coordinación y la administración editan el catálogo: tocar un premio lo abre (ADR-0008).
export function Premios({ nuevo }: { nuevo: number }) {
  const [premios, setPremios] = useState<Premio[]>([])
  const [editando, setEditando] = useState<Premio>()
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    api<Premio[]>('/puntos/premios')
      .then(setPremios)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (nuevo) setEditando(NUEVO)
  }, [nuevo])

  return (
    <section className="premios" aria-label="Premios del canje">
      {premios.some((p) => p.ejemplo) && (
        <p className="muted premio-nota">Los premios de ejemplo quedan así hasta que la fundación fije sus valores.</p>
      )}
      {error && <ErrorMessage message={error} retry={cargar} />}
      <ul className="premios-grid">
        {premios.map((p) => (
          <li key={p.id} className="card premio clickable-card" data-activo={p.activo}>
            <span className="icon-tile">
              <Icon name="gift" />
            </span>
            <h3>{p.nombre}</h3>
            <strong className="premio-costo">
              {p.costo} <span>puntos</span>
            </strong>
            <span className="premio-etiquetas">
              <span className="status-badge">{p.activo ? 'Disponible' : 'No disponible'}</span>
              {p.ejemplo && <span className="status-badge premio-ejemplo">Ejemplo</span>}
            </span>
            <button
              type="button"
              className="icon-button card-action"
              aria-label={'Editar ' + p.nombre}
              onClick={() => setEditando(p)}
            >
              <Icon name="edit" />
            </button>
          </li>
        ))}
      </ul>
      {editando && (
        <FormularioPremio
          key={editando.id ?? 'nuevo-' + nuevo}
          premio={editando}
          onClose={() => setEditando(undefined)}
          alGuardar={cargar}
        />
      )}
    </section>
  )
}

function FormularioPremio({
  premio,
  onClose,
  alGuardar,
}: {
  premio: Premio
  onClose: () => void
  alGuardar: () => void
}) {
  const id = useId()
  const submit = useSubmission()
  const [datos, setDatos] = useState(premio)

  function guardar(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    const cuerpo = { nombre: datos.nombre.trim(), costo: datos.costo, activo: datos.activo }
    void submit.run(async () => {
      await (premio.id ? api('/puntos/premios/' + premio.id, 'PUT', cuerpo) : api('/puntos/premios', 'POST', cuerpo))
      await close(alGuardar)
    })
  }

  return (
    <Modal title={premio.id ? 'Editar premio' : 'Agregar premio'} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => guardar(event, close)}>
          <div className="field">
            <label htmlFor={id + '-nombre'}>Premio</label>
            <input
              id={id + '-nombre'}
              value={datos.nombre}
              placeholder="Plántula de la huerta"
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={id + '-costo'}>Puntos que cuesta</label>
            <input
              id={id + '-costo'}
              type="number"
              min={1}
              inputMode="numeric"
              value={datos.costo}
              onChange={(e) => setDatos({ ...datos, costo: Number(e.target.value) })}
            />
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={datos.activo}
              onChange={(e) => setDatos({ ...datos, activo: e.target.checked })}
            />
            Disponible para canjear
          </label>
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => void close()}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={submit.busy || datos.nombre.trim().length < 2 || datos.costo < 1}
            >
              {submit.busy ? 'Guardando…' : 'Guardar premio'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
