import { useEffect, useId, useState } from 'react'
import { PageHeader } from '../../../ecoconecta-coordinacion/components/layout/Layout'
import { DataTable } from '../../../ecoconecta-coordinacion/components/ui/DataTable'
import {
  EmptyState,
  ErrorMessage,
  errorText,
  LoadingState,
} from '../../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../../ecoconecta-coordinacion/components/ui/Icon'
import { api } from '../../api'
import type { Usuario } from '../../sesion'
import { DialogoClave, DialogoPerfil } from './DialogosCuenta'
import './configuracion.css'

type Seleccion = { cuenta: Usuario; modo: 'perfil' | 'clave' }

export function Configuracion({
  usuario,
  onPerfil,
  onClavePropia,
}: {
  usuario: Usuario
  onPerfil: (cuenta: Usuario) => void
  onClavePropia: () => void
}) {
  const filtroEstado = useId()
  const [cuentas, setCuentas] = useState<Usuario[]>()
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todas')
  const [seleccion, setSeleccion] = useState<Seleccion>()
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const consulta = new AbortController()
    api<Usuario[]>('/acceso/usuarios', 'GET', undefined, consulta.signal)
      .then(setCuentas)
      .catch((causa) => {
        if (!consulta.signal.aborted) setError(errorText(causa))
      })
    return () => consulta.abort()
  }, [intento])

  const termino = busqueda.trim().toLocaleLowerCase('es')
  const otras = cuentas?.filter((cuenta) => cuenta.id !== usuario.id)
  const visibles = otras?.filter((cuenta) => {
    const coincideEstado = estado === 'todas' || cuenta.activo === (estado === 'activas')
    const datos = [cuenta.nombre, cuenta.usuario, cuenta.correo].filter(Boolean).join(' ').toLocaleLowerCase('es')
    return coincideEstado && datos.includes(termino)
  })

  function editar(cuenta: Usuario, modo: Seleccion['modo']) {
    setAviso('')
    setSeleccion({ cuenta, modo })
  }

  function perfilGuardado(cuenta: Usuario) {
    if (cuenta.id === usuario.id) onPerfil(cuenta)
    setCuentas((lista) => lista?.map((item) => (item.id === cuenta.id ? cuenta : item)))
    setAviso(cuenta.id === usuario.id ? 'Perfil actualizado.' : 'Cuenta actualizada.')
  }

  return (
    <>
      <PageHeader title="Configuración" description="Administra tu perfil y el acceso a EcoConecta." />
      <section className="card configuracion-perfil" aria-labelledby="configuracion-perfil">
        <div className="configuracion-identidad">
          <span className="icon-tile">
            <Icon name="user" />
          </span>
          <div>
            <h2 id="configuracion-perfil">Mi perfil</h2>
            <p className="muted">
              {usuario.nombre} · {usuario.usuario}
            </p>
          </div>
        </div>
        <div className="configuracion-acciones">
          <button type="button" className="button button-secondary" onClick={() => editar(usuario, 'clave')}>
            <Icon name="key" /> Cambiar mi clave
          </button>
          <button type="button" className="button button-primary" onClick={() => editar(usuario, 'perfil')}>
            <Icon name="edit" /> Editar mi perfil
          </button>
        </div>
      </section>
      <div role="status" className="configuracion-aviso">
        {aviso && (
          <>
            <Icon name="checkCircle" /> {aviso}
          </>
        )}
      </div>
      <section className="configuracion-usuarios" aria-labelledby="configuracion-usuarios">
        <div className="configuracion-cabecera">
          <h2 id="configuracion-usuarios">Usuarios del sistema</h2>
          <div className="configuracion-acciones configuracion-filtros">
            <label className="search-field">
              <Icon name="search" />
              <span className="sr-only">Buscar usuarios</span>
              <input
                type="search"
                placeholder="Nombre, usuario o correo"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </label>
            <div className="select-field">
              <label htmlFor={filtroEstado} className="sr-only">
                Filtrar por estado
              </label>
              <select id={filtroEstado} value={estado} onChange={(event) => setEstado(event.target.value)}>
                <option value="todas">Todos los estados</option>
                <option value="activas">Activas</option>
                <option value="inactivas">Inactivas</option>
              </select>
              <Icon name="chevron" />
            </div>
          </div>
        </div>
        {visibles?.length ? (
          <DataTable
            items={visibles}
            rowKey={(cuenta) => cuenta.id}
            rowLabel={(cuenta) => 'Editar cuenta de ' + cuenta.nombre}
            onSelect={(cuenta) => editar(cuenta, 'perfil')}
            columns={[
              {
                header: 'Cuenta',
                width: 'minmax(0, 1.5fr)',
                cell: (cuenta) => (
                  <div className="configuracion-cuenta">
                    <strong>{cuenta.nombre}</strong>
                    <span>{cuenta.usuario}</span>
                  </div>
                ),
              },
              {
                header: 'Permisos',
                cell: (cuenta) =>
                  cuenta.rol === 'administrador'
                    ? 'Administrador'
                    : cuenta.colectivo === 'huerteros'
                      ? 'Coord. de huerteros'
                      : 'Coord. de recicladores',
              },
              {
                header: 'Estado',
                width: 'minmax(6rem, .6fr)',
                cell: (cuenta) => (
                  <span className="status-badge">
                    <Icon name={cuenta.activo ? 'checkCircle' : 'clock'} />
                    {cuenta.activo ? 'Activa' : 'Inactiva'}
                  </span>
                ),
              },
              {
                header: 'Clave',
                width: '11.75rem',
                cell: (cuenta) => (
                  <button
                    type="button"
                    className="button button-quiet configuracion-restablecer"
                    aria-label={'Restablecer clave de ' + cuenta.nombre}
                    onClick={() => editar(cuenta, 'clave')}
                  >
                    <Icon name="key" /> Restablecer clave
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <div className="card data-feedback">
            {error ? (
              <ErrorMessage
                message={error}
                retry={() => {
                  setError('')
                  setIntento((anterior) => anterior + 1)
                }}
              />
            ) : !cuentas ? (
              <LoadingState />
            ) : (
              <EmptyState title={otras?.length ? 'Sin coincidencias' : 'No hay otros usuarios'}>
                {otras?.length
                  ? 'Cambia la búsqueda o el filtro de estado.'
                  : 'Las cuentas registradas aparecerán aquí.'}
              </EmptyState>
            )}
          </div>
        )}
      </section>
      {seleccion &&
        (seleccion.modo === 'perfil' ? (
          <DialogoPerfil
            cuenta={seleccion.cuenta}
            propio={seleccion.cuenta.id === usuario.id}
            onClose={() => setSeleccion(undefined)}
            onSaved={perfilGuardado}
          />
        ) : (
          <DialogoClave
            cuenta={seleccion.cuenta}
            propio={seleccion.cuenta.id === usuario.id}
            onClose={() => setSeleccion(undefined)}
            onSaved={() => {
              if (seleccion.cuenta.id === usuario.id) onClavePropia()
              else setAviso('Clave restablecida. La cuenta debe volver a iniciar sesión.')
            }}
          />
        ))}
    </>
  )
}
