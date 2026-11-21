import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import type { CloseModal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { api } from '../api'
import type { Vecino } from './Vecinos'

type Grupo = 'organico' | 'reciclable'
interface Encargado {
  id: string
  nombre: string
  activo: boolean
}
const normalizar = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

// RF-05 y RF-11: el vecino lleva sus residuos a la huerta (o al punto de acopio), aquí se pesan y gana sus puntos.
export function EntregaHuerta({ grupo }: { grupo: Grupo }) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState('')
  const lugar = grupo === 'organico' ? 'la huerta' : 'el punto de acopio'
  return (
    <>
      <button type="button" className="button button-primary" onClick={() => setAbierto(true)}>
        <Icon name="scale" /> Registrar entrega en {lugar}
      </button>
      {aviso && (
        <div className="confirmation-anchor">
          <p className="confirmation" role="status">
            <Icon name="check" /> {aviso}
          </p>
        </div>
      )}
      {abierto && (
        <FormularioEntrega
          grupo={grupo}
          lugar={lugar}
          onClose={() => setAbierto(false)}
          alRegistrar={(texto) => {
            setAviso(texto)
            window.dispatchEvent(new Event('solicitudes-cambiaron'))
          }}
        />
      )}
    </>
  )
}

function FormularioEntrega({
  grupo,
  lugar,
  onClose,
  alRegistrar,
}: {
  grupo: Grupo
  lugar: string
  onClose: () => void
  alRegistrar: (aviso: string) => void
}) {
  const id = useId()
  const [vecinos, setVecinos] = useState<Vecino[]>([])
  const [encargados, setEncargados] = useState<Encargado[]>([])
  const [buscar, setBuscar] = useState('')
  const [vecino, setVecino] = useState<Vecino>()
  const [kg, setKg] = useState('')
  const [encargado, setEncargado] = useState('')
  const submit = useSubmission()
  const colectivo = grupo === 'organico' ? 'huerteros' : 'recicladores'
  useEffect(() => {
    void Promise.all([
      api<Vecino[]>('/directorio/solicitantes?estado=habilitado'),
      api<Encargado[]>('/directorio/encargados?colectivo=' + colectivo),
    ]).then(([lista, equipo]) => {
      setVecinos(lista)
      setEncargados(equipo.filter((e) => e.activo))
    })
  }, [colectivo])
  const termino = normalizar(buscar)
  const digitos = termino.replace(/\D/g, '')
  const coincidencias =
    termino.length < 2
      ? []
      : vecinos
          .filter((v) => normalizar(v.nombre).includes(termino) || (digitos.length > 2 && v.telefono.includes(digitos)))
          .slice(0, 6)

  function guardar(event: FormEvent, close: CloseModal) {
    event.preventDefault()
    if (!vecino) return
    void submit.run(async () => {
      const kilos = Number(kg.replace(',', '.'))
      const entrega = await api<{ codigo: string }>('/solicitudes/entregas', 'POST', {
        solicitante_id: vecino.id,
        flujo: grupo,
        kg: kilos,
        encargado_id: encargado,
      })
      const puntos = (await api<Record<string, number>>('/puntos/por-codigo'))[entrega.codigo] ?? 0
      await close(() =>
        alRegistrar(`${vecino.nombre} entregó ${kg} kg (${entrega.codigo}): ganó ${puntos} puntos y le avisamos.`),
      )
    })
  }

  return (
    <Modal title={'Registrar entrega en ' + lugar} onClose={onClose} busy={submit.busy}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => guardar(event, close)}>
          {vecino ? (
            <div className="field">
              <span className="field-label">Vecino</span>
              <p className="entrega-vecino">
                <strong>{vecino.nombre}</strong> {vecino.direccion}
                <button type="button" className="button button-secondary" onClick={() => setVecino(undefined)}>
                  Cambiar
                </button>
              </p>
            </div>
          ) : (
            <div className="field">
              <label htmlFor={id + '-buscar'}>Vecino</label>
              <input
                id={id + '-buscar'}
                type="search"
                placeholder="Nombre o teléfono"
                autoComplete="off"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
              {coincidencias.length > 0 && (
                <ul className="entrega-coincidencias" aria-label="Vecinos que coinciden">
                  {coincidencias.map((v) => (
                    <li key={v.id}>
                      <button type="button" onClick={() => setVecino(v)}>
                        <strong>{v.nombre}</strong> {v.direccion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {termino.length >= 2 && coincidencias.length === 0 && (
                <span className="field-help">No hay vecinos habilitados con ese nombre o teléfono.</span>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor={id + '-kg'}>Kilos que pesó</label>
            <input
              id={id + '-kg'}
              inputMode="decimal"
              required
              pattern="[0-9]+([,.][0-9]+)?"
              placeholder="6,5"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={id + '-encargado'}>Recibió</label>
            <div className="select-field">
              <select id={id + '-encargado'} required value={encargado} onChange={(e) => setEncargado(e.target.value)}>
                <option value="">Elige quién la recibió</option>
                {encargados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </div>
          </div>
          <p className="muted">Gana sus puntos con la regla vigente y le llega el aviso por WhatsApp.</p>
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button type="button" className="button button-secondary" onClick={() => void close()}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={submit.busy || !vecino}>
              {submit.busy ? 'Registrando…' : 'Registrar entrega'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
