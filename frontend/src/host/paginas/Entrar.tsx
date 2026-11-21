import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { BrandLogo } from '../../ecoconecta-coordinacion/components/layout/BrandLogo'
import { Layout } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import { hashLink } from '../../ecoconecta-coordinacion/routes'
import type { NuevaCuenta } from '../sesion'
import { Registro } from './Registro'
import { CampoClave } from './CampoClave'

type Modo = 'entrar' | 'registro'

export function Entrar({
  onEntrar,
  onRegistrar,
  usuarioInicial = '',
  aviso = '',
}: {
  onEntrar: (usuario: string, clave: string) => Promise<void>
  onRegistrar: (cuenta: NuevaCuenta) => Promise<void>
  usuarioInicial?: string
  aviso?: string
}) {
  const [modo, setModo] = useState<Modo>('entrar')
  return (
    <Layout page="inicio" href={hashLink} demo={false}>
      <div className="acceso">
        {/* El mismo logo que la barra: al entrar viaja a la esquina con una View Transition (eco-logo). */}
        <div className="acceso-logo">
          <BrandLogo href="#/capacitacion?publica=1" />
        </div>
        <section className="card acceso-tarjeta" aria-labelledby="acceso-titulo">
          <MotionPills className="segmented-control acceso-modo" label="Entrar o crear cuenta" active={modo}>
            <button type="button" aria-pressed={modo === 'entrar'} onClick={() => setModo('entrar')}>
              Entrar
            </button>
            <button type="button" aria-pressed={modo === 'registro'} onClick={() => setModo('registro')}>
              Crear cuenta
            </button>
          </MotionPills>
          {modo === 'entrar' ? (
            <FormularioEntrar onEntrar={onEntrar} usuarioInicial={usuarioInicial} aviso={aviso} />
          ) : (
            <Registro onRegistrar={onRegistrar} />
          )}
        </section>
        <a className="acceso-guias" href="#/capacitacion?publica=1">
          <Icon name="book" /> Guías de separación, rutas y horarios
        </a>
      </div>
    </Layout>
  )
}

function FormularioEntrar({
  onEntrar,
  usuarioInicial,
  aviso,
}: {
  onEntrar: (usuario: string, clave: string) => Promise<void>
  usuarioInicial: string
  aviso: string
}) {
  const id = useId()
  const submit = useSubmission()
  const [usuario, setUsuario] = useState(usuarioInicial)
  const [clave, setClave] = useState('')

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(() => onEntrar(usuario.trim(), clave))
  }

  return (
    <form className="dialog-form" onSubmit={enviar}>
      <div>
        <h1 id="acceso-titulo" tabIndex={-1}>
          Entrar a la coordinación
        </h1>
        <p className="muted">Con tu usuario de coordinación.</p>
      </div>
      {aviso && (
        <p className="registro-aviso" role="status">
          {aviso}
        </p>
      )}
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
        <CampoClave
          id={id + '-clave'}
          autoComplete="current-password"
          autoFocus={!!usuarioInicial}
          value={clave}
          disabled={submit.busy}
          onChange={(event) => setClave(event.target.value)}
        />
      </div>
      {submit.error && <ErrorMessage message={submit.error} />}
      <button className="button button-primary" type="submit" disabled={submit.busy || !usuario || !clave}>
        {submit.busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
