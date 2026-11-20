import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'

export function Entrar({ onEntrar }: { onEntrar: (usuario: string, clave: string) => Promise<void> }) {
  const id = useId()
  const submit = useSubmission()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(() => onEntrar(usuario.trim(), clave))
  }

  return (
    <form className="card dialog-form" onSubmit={enviar}>
      <h1 tabIndex={-1}>Entrar a la coordinación</h1>
      <p className="muted">Usa el usuario de tu equipo. Si no lo tienes, pídelo a la fundación.</p>
      <div className="field">
        <label htmlFor={id + '-usuario'}>Usuario</label>
        <input
          id={id + '-usuario'}
          autoComplete="username"
          value={usuario}
          disabled={submit.busy}
          onChange={(event) => setUsuario(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={id + '-clave'}>Clave</label>
        <input
          id={id + '-clave'}
          type="password"
          autoComplete="current-password"
          value={clave}
          disabled={submit.busy}
          onChange={(event) => setClave(event.target.value)}
        />
      </div>
      {submit.error && <ErrorMessage message={submit.error} />}
      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={submit.busy || !usuario || !clave}>
          {submit.busy ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
