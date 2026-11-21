import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import type { CloseModal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import type { Zone } from '../../ecoconecta-coordinacion'
import { api } from '../api'

interface Edicion {
  titulo: string
  ruta: string
  metodo: 'POST' | 'PATCH'
  nombre?: string
  activo?: boolean
}
type Sector = NonNullable<Zone['conjuntos']>[number]

const editar = (titulo: string, ruta: string, lugar: { nombre: string; activo?: boolean }): Edicion => ({
  titulo,
  ruta,
  metodo: 'PATCH',
  nombre: lugar.nombre,
  activo: lugar.activo !== false,
})

export function Lugares({ nuevo }: { nuevo: number }) {
  const [zonas, setZonas] = useState<Zone[]>()
  const [edicion, setEdicion] = useState<Edicion>()
  const [eliminando, setEliminando] = useState<{ zonaId: string; sector: Sector }>()
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    setError('')
    api<Zone[]>('/directorio/zonas')
      .then(setZonas)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (nuevo) setEdicion({ titulo: 'Agregar zona', ruta: '/directorio/zonas', metodo: 'POST' })
  }, [nuevo])

  return (
    <section aria-label="Lugares del barrio">
      {error && <ErrorMessage message={error} retry={cargar} />}
      <div role="status">
        {aviso && (
          <p className="registro-aviso">
            <Icon name="checkCircle" /> {aviso}
          </p>
        )}
      </div>
      {zonas?.length === 0 && (
        <div className="card">
          <EmptyState title="Todavía no hay zonas">Agrega la primera zona del barrio.</EmptyState>
        </div>
      )}
      <ul className="lugares-grid">
        {zonas?.map((z) => (
          <li key={z.id} className="card lugar-zona" data-activo={z.activo !== false}>
            <div className="lugar-cabeza">
              <h2>{z.nombre}</h2>
              {z.activo === false && <span className="status-badge">Desactivada</span>}
              <button
                type="button"
                className="icon-button"
                aria-label={'Editar ' + z.nombre}
                onClick={() => setEdicion(editar('Editar ' + z.nombre, '/directorio/zonas/' + z.id, z))}
              >
                <Icon name="edit" />
              </button>
            </div>
            {z.conjuntos?.length ? (
              <ul className="lugar-conjuntos" aria-label={'Conjuntos de ' + z.nombre}>
                {z.conjuntos.map((c) => (
                  <li key={c.id} className="lugar-conjunto">
                    <div className="lugar-conjunto-nombre">
                      <strong>{c.nombre}</strong>
                      {c.activo === false && <span className="status-badge">Desactivado</span>}
                    </div>
                    <div className="lugar-conjunto-acciones">
                      <button
                        type="button"
                        className="button button-quiet"
                        aria-label={'Editar ' + c.nombre}
                        onClick={() => setEdicion(editar('Editar ' + c.nombre, '/directorio/conjuntos/' + c.id, c))}
                      >
                        <Icon name="edit" /> Editar
                      </button>
                      <button
                        type="button"
                        className="button button-quiet lugar-eliminar"
                        aria-label={'Eliminar ' + c.nombre}
                        onClick={() => {
                          setAviso('')
                          setEliminando({ zonaId: z.id, sector: c })
                        }}
                      >
                        <Icon name="trash" /> Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin conjuntos: los vecinos eligen la zona.</p>
            )}
            <button
              type="button"
              className="button button-secondary lugar-agregar"
              onClick={() =>
                setEdicion({
                  titulo: 'Agregar conjunto o sector en ' + z.nombre,
                  ruta: '/directorio/zonas/' + z.id + '/conjuntos',
                  metodo: 'POST',
                })
              }
            >
              <Icon name="plus" /> Agregar conjunto o sector
            </button>
          </li>
        ))}
      </ul>
      {edicion && <LugarForm edicion={edicion} onClose={() => setEdicion(undefined)} alGuardar={cargar} />}
      {eliminando && (
        <EliminarSector
          sector={eliminando.sector}
          onClose={() => setEliminando(undefined)}
          alEliminar={() => {
            const { zonaId, sector } = eliminando
            setZonas((list) =>
              list?.map((zona) =>
                zona.id === zonaId
                  ? { ...zona, conjuntos: zona.conjuntos?.filter((item) => item.id !== sector.id) }
                  : zona,
              ),
            )
            setAviso(`Se eliminó ${sector.nombre}.`)
          }}
        />
      )}
    </section>
  )
}

function EliminarSector({
  sector,
  onClose,
  alEliminar,
}: {
  sector: Sector
  onClose: () => void
  alEliminar: () => void
}) {
  const submit = useSubmission()
  return (
    <Modal title="Eliminar conjunto o sector" busy={submit.busy} onClose={onClose}>
      {(close) => (
        <div className="dialog-form">
          <p>
            ¿Quieres eliminar <strong>{sector.nombre}</strong>? Esta acción es permanente.
          </p>
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              autoFocus
              disabled={submit.busy}
              onClick={() => void close()}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button lugar-confirmar"
              disabled={submit.busy}
              onClick={() =>
                void submit.run(async () => {
                  await api('/directorio/conjuntos/' + sector.id, 'DELETE')
                  await close(alEliminar)
                })
              }
            >
              {submit.busy ? 'Eliminando…' : 'Eliminar conjunto o sector'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function LugarForm({ edicion, onClose, alGuardar }: { edicion: Edicion; onClose: () => void; alGuardar: () => void }) {
  const [nombre, setNombre] = useState(edicion.nombre ?? '')
  const [activo, setActivo] = useState(edicion.activo ?? true)
  const submit = useSubmission()
  const cambia = edicion.metodo === 'PATCH'

  function guardar(event: FormEvent, close: CloseModal) {
    event.preventDefault()
    void submit.run(async () => {
      await api(edicion.ruta, edicion.metodo, cambia ? { nombre: nombre.trim(), activo } : { nombre: nombre.trim() })
      await close(alGuardar)
    })
  }

  return (
    <Modal title={edicion.titulo} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => guardar(event, close)}>
          <div className="field">
            <label htmlFor="lugar-nombre">Nombre</label>
            <input
              id="lugar-nombre"
              required
              minLength={2}
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          {cambia && (
            <label className="checkbox-field">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo: se ofrece
              a los vecinos y a los encargados
            </label>
          )}
          {cambia && !activo && <p className="muted">No se borra: quienes viven ahí y su historial lo conservan.</p>}
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={submit.busy}>
              {submit.busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
