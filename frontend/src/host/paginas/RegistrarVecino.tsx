import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import type { CloseModal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import type { Zone } from '../../ecoconecta-coordinacion'
import { api } from '../api'
import type { Vecino } from './Vecinos'

// Celular colombiano en E.164, como lo guarda el directorio: «300 123 4567» queda «+573001234567».
export function telefonoE164(texto: string) {
  const digitos = texto.replace(/\D/g, '')
  return '+' + (digitos.length === 10 && digitos.startsWith('3') ? '57' + digitos : digitos)
}

// Registro desde la tableta (ADR-0017): datos mínimos y la autorización firmada por quien registra.
export function RegistrarVecino({
  zonas,
  onClose,
  alRegistrar,
}: {
  zonas: Zone[]
  onClose: () => void
  alRegistrar: (vecino: Vecino) => void
}) {
  const id = useId()
  const [tipo, setTipo] = useState<Vecino['tipo']>('hogar')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState('')
  const [conjunto, setConjunto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [autorizo, setAutorizo] = useState(false)
  const submit = useSubmission()
  const activas = zonas.filter((z) => z.activo !== false)
  const conjuntos = (activas.find((z) => z.id === zona)?.conjuntos ?? []).filter((c) => c.activo !== false)

  function guardar(event: FormEvent, close: CloseModal) {
    event.preventDefault()
    void submit.run(async () => {
      const vecino = await api<Vecino>('/directorio/solicitantes', 'POST', {
        tipo,
        nombre: nombre.trim(),
        telefono: telefonoE164(telefono),
        zona_id: zona,
        conjunto_id: conjunto || null,
        direccion: direccion.trim(),
        autoriza_datos: autorizo,
      })
      await close(() => alRegistrar(vecino))
    })
  }

  return (
    <Modal title="Registrar vecino o negocio" onClose={onClose} busy={submit.busy}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => guardar(event, close)}>
          <fieldset className="field">
            <legend>Tipo</legend>
            <div className="tipo-registro">
              {(['hogar', 'unidad_productiva'] as const).map((t) => (
                <label key={t} className="outcome-option">
                  <input type="radio" name={id + '-tipo'} checked={tipo === t} onChange={() => setTipo(t)} />{' '}
                  {t === 'hogar' ? 'Hogar' : 'Negocio'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor={id + '-nombre'}>{tipo === 'hogar' ? 'Nombre de la persona' : 'Nombre del negocio'}</label>
            <input
              id={id + '-nombre'}
              required
              minLength={2}
              maxLength={60}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={id + '-telefono'}>WhatsApp</label>
            <input
              id={id + '-telefono'}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="300 123 4567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={id + '-zona'}>Zona</label>
            <div className="select-field">
              <select
                id={id + '-zona'}
                required
                value={zona}
                onChange={(e) => {
                  setZona(e.target.value)
                  setConjunto('')
                }}
              >
                <option value="">Elige la zona</option>
                {activas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </div>
          </div>
          {conjuntos.length > 0 && (
            <div className="field">
              <label htmlFor={id + '-conjunto'}>Conjunto o sector</label>
              <div className="select-field">
                <select id={id + '-conjunto'} required value={conjunto} onChange={(e) => setConjunto(e.target.value)}>
                  <option value="">Elige el conjunto o sector</option>
                  {conjuntos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" />
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor={id + '-direccion'}>Dirección</label>
            <input
              id={id + '-direccion'}
              required
              minLength={3}
              maxLength={120}
              placeholder={tipo === 'hogar' ? 'Torre 34 apto 402, o la casa' : 'Local 9'}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
          <label className="checkbox-field">
            <input type="checkbox" required checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} /> El
            vecino autorizó el uso de sus datos para coordinar sus recolecciones
          </label>
          <p className="muted">
            Queda firmado con tu nombre y la hora. Por WhatsApp le llega la bienvenida con el aviso de privacidad.
          </p>
          {submit.error && <ErrorMessage message={submit.error} />}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={submit.busy}>
              {submit.busy ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
