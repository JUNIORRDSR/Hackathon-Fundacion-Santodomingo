import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import type { NuevaCuenta } from '../sesion'
import { CampoClave } from './CampoClave'

const VACIA: NuevaCuenta = { colectivo: 'huerteros', nombre: '', usuario: '', clave: '', codigo: '' }
const CAMPOS: { campo: 'nombre' | 'usuario' | 'clave' | 'codigo'; etiqueta: string; ayuda?: string }[] = [
  { campo: 'nombre', etiqueta: 'Tu nombre' },
  { campo: 'usuario', etiqueta: 'Usuario', ayuda: 'Con este nombre entrarás; sin espacios.' },
  { campo: 'clave', etiqueta: 'Clave', ayuda: 'Mínimo 8 caracteres.' },
  { campo: 'codigo', etiqueta: 'Código de la fundación', ayuda: 'Te lo da la administración del piloto.' },
]

// Cada coordinador ve solo su colectivo; el código de la fundación evita cuentas de desconocidos (ADR-0009).
export function Registro({ onRegistrar }: { onRegistrar: (cuenta: NuevaCuenta) => Promise<void> }) {
  const id = useId()
  const submit = useSubmission()
  const [cuenta, setCuenta] = useState(VACIA)
  const completa = cuenta.nombre.trim() && cuenta.usuario.trim() && cuenta.clave.length >= 8 && cuenta.codigo.trim()

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(() => onRegistrar(cuenta))
  }

  return (
    <form className="dialog-form" onSubmit={enviar}>
      <div>
        <h1 id="acceso-titulo" tabIndex={-1}>
          Crear tu cuenta
        </h1>
        <p className="muted">Elige el colectivo que coordinas: verás solo sus solicitudes.</p>
      </div>
      <fieldset disabled={submit.busy}>
        <legend>Colectivo</legend>
        <div className="outcome-options">
          {(['huerteros', 'recicladores'] as const).map((colectivo) => (
            <label className="outcome-option acceso-colectivo" key={colectivo}>
              <input
                type="radio"
                name={id + '-colectivo'}
                checked={cuenta.colectivo === colectivo}
                onChange={() => setCuenta({ ...cuenta, colectivo })}
              />
              <Icon name={colectivo === 'huerteros' ? 'leaf' : 'recycle'} />
              <span>
                {colectivo === 'huerteros' ? 'Huerteros' : 'Recicladores'}
                <small>{colectivo === 'huerteros' ? 'Orgánicos para la huerta' : 'Reciclables aprovechables'}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {CAMPOS.map(({ campo, etiqueta, ayuda }) => (
        <div className="field" key={campo}>
          <label htmlFor={id + campo}>{etiqueta}</label>
          {(() => {
            const comunes = {
              id: id + campo,
              value: cuenta[campo],
              disabled: submit.busy,
              'aria-describedby': ayuda ? id + campo + '-ayuda' : undefined,
              onChange: (event: { target: { value: string } }) => setCuenta({ ...cuenta, [campo]: event.target.value }),
            }
            return campo === 'clave' ? (
              <CampoClave {...comunes} autoComplete="new-password" />
            ) : (
              <input {...comunes} autoComplete={campo === 'usuario' ? 'username' : 'off'} />
            )
          })()}
          {ayuda && (
            <span className="field-help" id={id + campo + '-ayuda'}>
              {ayuda}
            </span>
          )}
        </div>
      ))}
      {submit.error && <ErrorMessage message={submit.error} />}
      <button className="button button-primary" type="submit" disabled={submit.busy || !completa}>
        {submit.busy ? 'Creando…' : 'Crear cuenta y entrar'}
      </button>
    </form>
  )
}
