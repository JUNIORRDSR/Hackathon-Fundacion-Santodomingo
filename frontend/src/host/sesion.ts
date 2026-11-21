import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from './api'

export interface Usuario {
  id: string
  usuario: string
  nombre: string
  rol: 'coordinador' | 'administrador'
  colectivo: 'huerteros' | 'recicladores' | null
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
  useEffect(() => {
    api<Usuario>('/acceso/yo')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])
  const cambiar = (nuevo: Usuario | null) => conTransicion(() => setUsuario(nuevo))
  const entrar = async (nombre: string, clave: string) =>
    cambiar(await api<Usuario>('/acceso/entrar', 'POST', { usuario: nombre, clave }))
  const registrar = async (cuenta: NuevaCuenta) => cambiar(await api<Usuario>('/acceso/registro', 'POST', cuenta))
  const salir = async () => {
    await api('/acceso/salir', 'POST')
    cambiar(null)
  }
  return { usuario, cargando, entrar, registrar, salir }
}
