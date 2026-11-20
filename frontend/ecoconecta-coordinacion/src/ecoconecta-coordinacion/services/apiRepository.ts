import type { Collector, CoordinatorRepository, Request } from '../types'

type ApiRoutes = {
  [Key in keyof CoordinatorRepository]: (coordinatorId: string, resourceId?: string) => string | URL
}

export interface ApiRepositoryOptions {
  routes: ApiRoutes
  decodeRequests: (body: unknown) => Request[]
  decodeCollectors: (body: unknown) => Collector[]
  decodeRequest: (body: unknown) => Request
  decodeCollector: (body: unknown) => Collector
  fetcher?: typeof fetch
  credentials?: RequestCredentials
  idempotencyHeader?: string
}

export function createApiRepository({
  routes, decodeRequests, decodeCollectors, decodeRequest, decodeCollector,
  fetcher = fetch, credentials = 'same-origin', idempotencyHeader,
}: ApiRepositoryOptions): CoordinatorRepository {
  const pendingKeys = new Map<string, string>()

  async function send<T>(url: string | URL, decode: (body: unknown) => T, init: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetcher(url, { credentials, ...init })
    } catch (error) {
      if (init.signal?.aborted) throw error
      throw new Error('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Tu sesión no tiene acceso a esta operación. Vuelve a ingresar para continuar.')
    }
    if (response.status === 409) throw new Error('El registro cambió. Actualiza el panel y revisa el estado.')
    if (!response.ok) throw new Error('No se pudo completar la operación. Inténtalo de nuevo.')
    try {
      return decode(await response.json())
    } catch {
      throw new Error('No se pudo confirmar la respuesta del servidor. Actualiza el panel para revisar el estado.')
    }
  }

  async function write<T>(
    scope: string, url: string | URL, decode: (body: unknown) => T, method: string, input: object,
  ): Promise<T> {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    const body = JSON.stringify(input)
    const signature = JSON.stringify([scope, method, String(url), body])
    if (idempotencyHeader) {
      const key = pendingKeys.get(signature) ?? crypto.randomUUID()
      pendingKeys.set(signature, key)
      headers.set(idempotencyHeader, key)
    }
    const result = await send(url, decode, { method, headers, body })
    pendingKeys.delete(signature)
    return result
  }

  return {
    listRequests: (c, signal) => send(routes.listRequests(c.id), decodeRequests, { signal }),
    listCollectors: (c, signal) => send(routes.listCollectors(c.id), decodeCollectors, { signal }),
    assign: (c, assignment) => write(
      c.id, routes.assign(c.id, assignment.solicitudId), decodeRequest, 'POST', assignment,
    ),
    saveResult: (c, result) => write(
      c.id, routes.saveResult(c.id, result.solicitudId), decodeRequest, 'POST', result,
    ),
    saveCollector: (c, input, id) => write(
      c.id, routes.saveCollector(c.id, id), decodeCollector, id ? 'PATCH' : 'POST', input,
    ),
  }
}
