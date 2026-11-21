import { isLocalDate, timeMinutes } from '../labels'
import { createDemoData, demoZones } from '../mocks/demoData'
import type { CollectionRoute, Collector, Coordinator, CoordinatorRepository, Request, WasteType } from '../types'

type DemoRoute = CollectionRoute & { grupo: WasteType }
type DemoData = ReturnType<typeof createDemoData> & { routes?: DemoRoute[] }
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
    listZones: (signal) => load(() => demoZones, signal),
    cancel(coordinator, solicitudId, motivo) {
      return transact((data) => {
        const { index, request } = findRequest(data, coordinator, solicitudId)
        if (request.estado !== 'pendiente' && request.estado !== 'asignada') {
          throw new Error('La solicitud ya cambió de estado. Actualiza el panel.')
        }
        const updated: Request = { ...request, estado: 'cancelada', motivo: motivo.trim(), resultado: undefined }
        data.requests[index] = updated
        return updated
      })
    },
    listCollectors: (coordinator, signal) =>
      load(({ collectors }) => collectors.filter(({ grupo }) => grupo === coordinator.grupo), signal),
    listRoutes: (coordinator, signal) =>
      load(
        ({ routes = [], collectors }) =>
          routes
            .filter(({ grupo }) => grupo === coordinator.grupo)
            .map((route) => ({ ...route, disponible: collectors.some((c) => c.id === route.encargadoId && c.activo) })),
        signal,
      ),
    saveRoute(coordinator, input, id) {
      return transact((data) => {
        const routes = (data.routes ??= [])
        const index = routes.findIndex((route) => route.id === id && route.grupo === coordinator.grupo)
        const collector = data.collectors.find((c) => c.id === input.encargadoId && c.grupo === coordinator.grupo)
        if (id && index < 0) throw new Error('La ruta ya no está disponible en tu equipo.')
        if (!collector) throw new Error('Elige un responsable de tu equipo.')
        if (input.publicada && !collector.activo) throw new Error('Elige un responsable activo para publicar.')
        const saved: DemoRoute = {
          ...input,
          id: id ?? crypto.randomUUID(),
          grupo: coordinator.grupo,
          disponible: collector.activo,
        }
        if (id) routes[index] = saved
        else routes.push(saved)
        return saved
      })
    },
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
        const zonas = input.zonas.filter((zona) => demoZones.some((item) => item.id === zona))
        if (!nombre || !zonas.length) throw new Error('Escribe el nombre y elige al menos una zona.')
        const zona = demoZones
          .filter((item) => zonas.includes(item.id))
          .map((item) => item.nombre)
          .join(', ')
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
          zonas,
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
