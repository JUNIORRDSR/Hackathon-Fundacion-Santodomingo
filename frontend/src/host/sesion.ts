import { useEffect, useState } from 'react'
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
  const entrar = async (nombre: string, clave: string) =>
    setUsuario(await api<Usuario>('/acceso/entrar', 'POST', { usuario: nombre, clave }))
  const registrar = async (cuenta: NuevaCuenta) => setUsuario(await api<Usuario>('/acceso/registro', 'POST', cuenta))
  const salir = async () => {
    await api('/acceso/salir', 'POST')
    setUsuario(null)
  }
  return { usuario, cargando, entrar, registrar, salir }
}
