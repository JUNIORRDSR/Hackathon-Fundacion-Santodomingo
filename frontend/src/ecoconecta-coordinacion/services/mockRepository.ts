import { isLocalDate, timeMinutes } from '../labels'
import { createDemoData } from '../mocks/demoData'
import type { Collector, Coordinator, CoordinatorRepository, Request } from '../types'

type DemoData = ReturnType<typeof createDemoData>
const storageKey = 'ecoconecta-coordinacion-demo-v1'
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 180))

export function createMockRepository(storage?: Storage): CoordinatorRepository {
  let memory = createDemoData()
  let persistence = storage

  function read(): DemoData {
    try {
      const saved = persistence?.getItem(storageKey)
      if (saved) return JSON.parse(saved) as DemoData
    } catch {
      persistence = undefined
    }
    return memory
  }

  function commit(data: DemoData) {
    if (persistence) {
      try {
        persistence.setItem(storageKey, JSON.stringify(data))
      } catch {
        throw new Error(
          'No se pudo guardar en este navegador. Libera espacio o revisa sus permisos e inténtalo de nuevo.',
        )
      }
    }
    memory = data
  }

  async function transact<T>(apply: (data: DemoData) => T): Promise<T> {
    await wait()
    const update = () => {
      const data = structuredClone(read())
      const result = apply(data)
      commit(data)
      return result
    }
    if (persistence && typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(storageKey, update)
    }
    return update()
  }

  function findRequest(data: DemoData, coordinator: Coordinator, id: string) {
    const index = data.requests.findIndex((item) => item.id === id && item.tipo === coordinator.grupo)
    if (index < 0) throw new Error('La solicitud no está disponible para tu equipo.')
    return { index, request: data.requests[index] }
  }

  async function load<T>(select: (data: DemoData) => T, signal?: AbortSignal) {
    await wait()
    signal?.throwIfAborted()
    return structuredClone(select(read()))
  }

  return {
    listRequests: (coordinator, signal) =>
      load(({ requests }) => requests.filter(({ tipo }) => tipo === coordinator.grupo), signal),
    listCollectors: (coordinator, signal) =>
      load(({ collectors }) => collectors.filter(({ grupo }) => grupo === coordinator.grupo), signal),
    assign(coordinator, assignment) {
      return transact((data) => {
        const { index, request } = findRequest(data, coordinator, assignment.solicitudId)
        if (
          request.estado === 'asignada' &&
          request.asignacion.recolectorId === assignment.recolectorId &&
          request.asignacion.fecha === assignment.fecha &&
          request.asignacion.hora === assignment.hora
        )
          return request
        if (request.estado !== 'pendiente') throw new Error('La solicitud ya cambió de estado. Actualiza el panel.')
        const collector = data.collectors.find(
          ({ id, grupo, activo }) => id === assignment.recolectorId && grupo === coordinator.grupo && activo,
        )
        if (!collector) throw new Error('Elige un recolector activo de tu equipo.')
        if (!isLocalDate(assignment.fecha)) throw new Error('Ingresa una fecha válida.')
        if (assignment.hora !== undefined && timeMinutes(assignment.hora) === undefined) {
          throw new Error('Ingresa una hora válida.')
        }
        const updated: Request = { ...request, estado: 'asignada', asignacion: { ...assignment } }
        data.requests[index] = updated
        return updated
      })
    },
    saveResult(coordinator, result) {
      return transact((data) => {
        const { index, request } = findRequest(data, coordinator, result.solicitudId)
        const stored = request.resultado
        if (
          (stored?.estado === 'recolectada' && result.estado === 'recolectada' && stored.pesoKg === result.pesoKg) ||
          (stored?.estado === 'rechazada' &&
            result.estado === 'rechazada' &&
            stored.motivoRechazo === result.motivoRechazo.trim())
        )
          return request
        if (request.estado !== 'asignada') throw new Error('La recolección ya cambió de estado. Actualiza el panel.')
        let updated: Request
        if (result.estado === 'recolectada') {
          if (!Number.isFinite(result.pesoKg) || result.pesoKg <= 0) throw new Error('Ingresa un peso mayor que cero.')
          updated = { ...request, estado: 'recolectada', resultado: { ...result } }
        } else {
          const motivoRechazo = result.motivoRechazo.trim()
          if (!motivoRechazo) throw new Error('Escribe el motivo del rechazo.')
          updated = { ...request, estado: 'rechazada', resultado: { ...result, motivoRechazo } }
        }
        data.requests[index] = updated
        return updated
      })
    },
    saveCollector(coordinator, input, id) {
      return transact((data) => {
        const nombre = input.nombre.trim()
        const zona = input.zona.trim()
        if (!nombre || !zona) throw new Error('Escribe el nombre y la zona.')
        const index = data.collectors.findIndex((entry) => entry.id === id && entry.grupo === coordinator.grupo)
        if (id && index < 0) throw new Error('El recolector ya no está disponible en tu equipo.')
        const saved: Collector = {
          id:
            id ??
            'demo-recolector-' +
              Date.now().toString(36) +
              '-' +
              crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
          grupo: coordinator.grupo,
          nombre,
          zona,
          activo: input.activo,
        }
        if (id) data.collectors[index] = saved
        else data.collectors.push(saved)
        return saved
      })
    },
  }
}
