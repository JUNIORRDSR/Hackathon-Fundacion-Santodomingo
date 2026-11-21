import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../../ecoconecta-coordinacion/components/ui/Feedback'
import { FilterSelect } from '../../../ecoconecta-coordinacion/components/ui/FilterSelect'
import { Modal } from '../../../ecoconecta-coordinacion/components/ui/Modal'
import type { CloseModal } from '../../../ecoconecta-coordinacion/components/ui/Modal'
import { useSubmission } from '../../../ecoconecta-coordinacion/components/ui/useSubmission'
import { api } from '../../api'
import type { Usuario } from '../../sesion'
import { CampoClave } from '../CampoClave'

const CAMPOS = [
  { nombre: 'nombre', etiqueta: 'Nombre completo', tipo: 'text', autofill: 'name', min: 2, max: 80 },
  { nombre: 'usuario', etiqueta: 'Usuario de ingreso', tipo: 'text', autofill: 'username', min: 3, max: 40 },
  { nombre: 'correo', etiqueta: 'Correo electrónico (opcional)', tipo: 'email', autofill: 'email', max: 254 },
  { nombre: 'telefono', etiqueta: 'Teléfono (opcional)', tipo: 'tel', autofill: 'tel', max: 32 },
] as const

const ROLES = [
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'administrador', label: 'Administrador' },
]
const COLECTIVOS = [
  { value: 'huerteros', label: 'Huerteros' },
  { value: 'recicladores', label: 'Recicladores' },
]
const ESTADOS = [
  { value: 'si', label: 'Activa' },
  { value: 'no', label: 'Inactiva' },
]

type DialogoProps = { cuenta: Usuario; propio: boolean; onClose: () => void }

function Acciones({ close, busy, accion }: { close: CloseModal; busy: boolean; accion: string }) {
  return (
    <div className="form-actions">
      <button type="button" className="button button-quiet" disabled={busy} onClick={() => void close()}>
        Cancelar
      </button>
      <button type="submit" className="button button-primary" disabled={busy}>
        {busy ? 'Guardando…' : accion}
      </button>
    </div>
  )
}

export function DialogoPerfil({
  cuenta,
  propio,
  onClose,
  onSaved,
}: DialogoProps & { onSaved: (cuenta: Usuario) => void }) {
  const id = useId()
  const [rol, setRol] = useState(cuenta.rol)
  const [colectivo, setColectivo] = useState<string>(cuenta.colectivo ?? '')
  const [estado, setEstado] = useState(cuenta.activo ? 'si' : 'no')
  const [solicitarColectivo, setSolicitarColectivo] = useState(false)
  const submit = useSubmission()
  const faltaColectivo = solicitarColectivo && rol === 'coordinador' && !colectivo

  function guardar(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    if (!propio && rol === 'coordinador' && !colectivo) {
      setSolicitarColectivo(true)
      document.getElementById(id + 'colectivo')?.focus()
      return
    }
    const datos = new FormData(event.currentTarget)
    const perfil = Object.fromEntries(CAMPOS.map(({ nombre }) => [nombre, String(datos.get(nombre)).trim()]))
    const permisos = { rol, colectivo: rol === 'coordinador' ? colectivo : null, activo: estado === 'si' }
    const ruta = propio ? '/acceso/yo' : '/acceso/usuarios/' + cuenta.id
    void submit.run(async () => {
      const guardado = await api<Usuario>(ruta, 'PUT', propio ? perfil : { ...perfil, ...permisos })
      await close(() => onSaved(guardado))
    })
  }

  return (
    <Modal title={propio ? 'Editar mi perfil' : 'Editar cuenta'} busy={submit.busy} onClose={onClose}>
      {(close) => (
        <form className="dialog-form" onSubmit={(event) => guardar(event, close)}>
          <fieldset className="configuracion-campos" disabled={submit.busy}>
            <legend>Datos personales</legend>
            <div className="form-grid">
              {CAMPOS.map((campo) => (
                <div className="field" key={campo.nombre}>
                  <label htmlFor={id + campo.nombre}>{campo.etiqueta}</label>
                  <input
                    id={id + campo.nombre}
                    name={campo.nombre}
                    type={campo.tipo}
                    autoComplete={propio ? campo.autofill : 'off'}
                    defaultValue={cuenta[campo.nombre] ?? ''}
                    minLength={'min' in campo ? campo.min : undefined}
                    maxLength={campo.max}
                    required={'min' in campo}
                  />
                </div>
              ))}
            </div>
          </fieldset>
          {!propio && (
            <fieldset className="configuracion-campos" disabled={submit.busy}>
              <legend>Permisos y estado</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={id + 'rol'}>Rol</label>
                  <FilterSelect
                    id={id + 'rol'}
                    label="Rol"
                    value={rol}
                    options={ROLES}
                    onChange={(value) => setRol(value as Usuario['rol'])}
                    disabled={submit.busy}
                  />
                </div>
                {rol === 'coordinador' && (
                  <div className="field">
                    <label htmlFor={id + 'colectivo'}>Colectivo</label>
                    <FilterSelect
                      id={id + 'colectivo'}
                      label="Colectivo"
                      value={colectivo}
                      options={COLECTIVOS}
                      onChange={setColectivo}
                      placeholder="Elige un colectivo"
                      required
                      invalid={faltaColectivo || undefined}
                      describedBy={faltaColectivo ? id + 'colectivo-error' : undefined}
                      disabled={submit.busy}
                    />
                    {faltaColectivo && (
                      <span className="field-error" role="alert" id={id + 'colectivo-error'}>
                        Elige un colectivo.
                      </span>
                    )}
                  </div>
                )}
                <div className="field">
                  <label htmlFor={id + 'activo'}>Estado de la cuenta</label>
                  <FilterSelect
                    id={id + 'activo'}
                    label="Estado de la cuenta"
                    value={estado}
                    options={ESTADOS}
                    onChange={setEstado}
                    describedBy={id + 'estado'}
                    disabled={submit.busy}
                  />
                  <span id={id + 'estado'} className="field-help">
                    Al desactivarla, se cierran sus sesiones.
                  </span>
                </div>
              </div>
            </fieldset>
          )}
          {submit.error && <ErrorMessage message={submit.error} />}
          <Acciones close={close} busy={submit.busy} accion="Guardar cambios" />
        </form>
      )}
    </Modal>
  )
}

export function DialogoClave({ cuenta, propio, onClose, onSaved }: DialogoProps & { onSaved: () => void }) {
  const id = useId()
  const submit = useSubmission()
  const accion = propio ? 'Cambiar mi clave' : 'Restablecer clave'

  function guardar(event: FormEvent<HTMLFormElement>, close: CloseModal) {
    event.preventDefault()
    const datos = new FormData(event.currentTarget)
    const clave = datos.get('clave')
    void submit.run(async () => {
      if (clave !== datos.get('confirmacion')) throw new Error('Las claves no coinciden.')
      if (propio) await api('/acceso/yo/clave', 'PUT', { clave, actual: datos.get('actual') })
      else await api(`/acceso/usuarios/${cuenta.id}/clave`, 'PUT', { clave })
      await close(onSaved)
    })
  }

  return (
    <Modal title={accion} busy={submit.busy} onClose={onClose}>
      {(close) => (
        <form className="dialog-form" aria-label={accion} onSubmit={(event) => guardar(event, close)}>
          <p className="muted">
            {propio
              ? 'Volverás a iniciar sesión con tu nueva clave.'
              : `Vas a asignar una nueva clave a ${cuenta.nombre}. Sus sesiones se cerrarán al guardar.`}
          </p>
          {propio && (
            <div className="field">
              <label htmlFor={id + 'actual'}>Clave actual</label>
              <CampoClave
                id={id + 'actual'}
                name="actual"
                autoComplete="current-password"
                maxLength={128}
                required
                disabled={submit.busy}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor={id + 'clave'}>Nueva clave</label>
            <CampoClave
              id={id + 'clave'}
              name="clave"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              disabled={submit.busy}
              aria-describedby={id + 'ayuda'}
            />
            <span className="field-help" id={id + 'ayuda'}>
              Entre 8 y 128 caracteres.
            </span>
          </div>
          <div className="field">
            <label htmlFor={id + 'confirmacion'}>Confirmar nueva clave</label>
            <CampoClave
              id={id + 'confirmacion'}
              name="confirmacion"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              disabled={submit.busy}
            />
          </div>
          {submit.error && <ErrorMessage message={submit.error} />}
          <Acciones close={close} busy={submit.busy} accion={accion} />
        </form>
      )}
    </Modal>
  )
}
