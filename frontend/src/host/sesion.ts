import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './api'

export interface Usuario {
  id: string
  usuario: string
  nombre: string
  rol: 'coordinador' | 'administrador'
  colectivo: 'huerteros' | 'recicladores' | null
  correo: string | null
  telefono: string | null
  activo: boolean
}

export interface NuevaCuenta {
  colectivo: 'huerteros' | 'recicladores'
  nombre: string
  usuario: string
  clave: string
  codigo: string
}

// Entrar y salir cambian toda la pantalla: con View Transition el logo viaja entre el centro y la esquina (eco-logo).
function conTransicion(cambio: () => void) {
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (quieto || !document.startViewTransition) return cambio()
  document.startViewTransition(() => flushSync(cambio))
}

// La sesión vive en una cookie firmada del backend (ADR-0004): aquí solo se pregunta quién es.
export function useSesion() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    api<Usuario | null>('/acceso/yo')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])
  useEffect(() => {
    if (!usuario) return
    const consulta = new AbortController()
    const actualizar = () =>
      void api<Usuario | null>('/acceso/yo', 'GET', undefined, consulta.signal)
        .then((nuevo) => {
          if (JSON.stringify(nuevo) !== JSON.stringify(usuario)) {
            setUsuario((anterior) => (anterior === usuario ? nuevo : anterior))
          }
        })
        .catch(() => {})
    const intervalo = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    return () => {
      consulta.abort()
      window.clearInterval(intervalo)
      window.removeEventListener('focus', actualizar)
    }
  }, [usuario])
  const cambiar = (nuevo: Usuario | null, mensaje = '') => {
    setAviso(mensaje)
    conTransicion(() => setUsuario(nuevo))
  }
  const entrar = async (nombre: string, clave: string) =>
    cambiar(await api<Usuario>('/acceso/entrar', 'POST', { usuario: nombre, clave }))
  const registrar = async (cuenta: NuevaCuenta) => cambiar(await api<Usuario>('/acceso/registro', 'POST', cuenta))
  const salir = async () => {
    await api('/acceso/salir', 'POST')
    cambiar(null)
  }
  return {
    usuario,
    cargando,
    aviso,
    entrar,
    registrar,
    salir,
    actualizarPerfil: setUsuario,
    claveCambiada: () => cambiar(null, 'Tu clave cambió. Vuelve a entrar con la nueva clave.'),
  }
}
