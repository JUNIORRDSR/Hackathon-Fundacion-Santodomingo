import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Layout } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import type { IconName } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { hashLink } from '../../ecoconecta-coordinacion/routes'

// El ciclo que coordina esta app, de punta a punta: es lo primero que ve quien entra a presentar.
const CICLO: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'inbox', titulo: 'El vecino pide', texto: 'Por WhatsApp, y escribe el código en su bolsa.' },
  { icono: 'truck', titulo: 'El colectivo recoge', texto: 'La coordinación asigna huertero o reciclador.' },
  { icono: 'scale', titulo: 'La huerta valida', texto: 'Busca el código de la bolsa y registra los kilos.' },
  { icono: 'gift', titulo: 'El vecino canjea', texto: 'Recibe sus puntos y pide su premio por WhatsApp.' },
]

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
    <Layout page="inicio" href={hashLink} demo={false}>
      <section className="card login" aria-labelledby={id + '-titulo'}>
        <div className="login-ciclo">
          <h2>Del balde a la huerta</h2>
          <ol>
            {CICLO.map(({ icono, titulo, texto }) => (
              <li key={titulo}>
                <Icon name={icono} />
                <div>
                  <strong>{titulo}</strong>
                  <span>{texto}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <form className="login-form" onSubmit={enviar}>
          <h1 id={id + '-titulo'} tabIndex={-1}>
            Entrar a la coordinación
          </h1>
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
          <button className="button button-primary" type="submit" disabled={submit.busy || !usuario || !clave}>
            {submit.busy ? 'Entrando…' : 'Entrar'}
          </button>
          <a className="login-publica" href="#/capacitacion?publica=1">
            <Icon name="book" /> Ver las guías de separación sin entrar
          </a>
        </form>
      </section>
    </Layout>
  )
}
