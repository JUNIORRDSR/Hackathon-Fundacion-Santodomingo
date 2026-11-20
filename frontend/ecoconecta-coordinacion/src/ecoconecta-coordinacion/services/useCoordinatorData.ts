import { useCallback, useEffect, useMemo, useState } from 'react'
import { errorText } from '../components/ui/Feedback'
import type { Collector, Coordinator, CoordinatorRepository, Request } from '../types'

type QueryState<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }
type Data = { requests: Request[]; collectors: Collector[] }
type QueryMode = 'requests' | 'collectors' | 'none'
type Loader<T> = (signal: AbortSignal) => Promise<T>

function useRepositoryQuery<T>(load: Loader<T>, enabled: boolean) {
  const [entry, setEntry] = useState<{ load: Loader<T>; state: QueryState<T> }>()
  const [attempt, setAttempt] = useState(0)
  const state = entry?.load === load ? entry.state : undefined

  useEffect(() => {
    if (!enabled || state) return
    const controller = new AbortController()
    const { signal } = controller
    async function fetchData() {
      try {
        const data = await load(signal)
        if (!signal.aborted) setEntry({ load, state: { status: 'ready', data } })
      } catch (error) {
        if (!signal.aborted) setEntry({ load, state: { status: 'error', error: errorText(error) } })
      }
    }
    void fetchData()
    return () => controller.abort()
  }, [attempt, enabled, load, state])

  function reload() {
    setEntry(undefined)
    setAttempt((value) => value + 1)
  }

  function update(apply: (current: T) => T) {
    setEntry((previous) => previous?.load === load && previous.state.status === 'ready'
      ? { load, state: { status: 'ready', data: apply(previous.state.data) } }
      : previous)
  }

  return { state, reload, update }
}

export function useCoordinatorData(coordinator: Coordinator, repository: CoordinatorRepository, mode: QueryMode) {
  const { id, nombre, grupo } = coordinator
  const scope = useMemo(() => ({ id, nombre, grupo }), [id, nombre, grupo])
  const loadRequests = useCallback(async (signal: AbortSignal) =>
    (await repository.listRequests(scope, signal)).filter((item) => item.tipo === scope.grupo),
  [repository, scope])
  const loadCollectors = useCallback(async (signal: AbortSignal) =>
    (await repository.listCollectors(scope, signal)).filter((item) => item.grupo === scope.grupo),
  [repository, scope])
  const requests = useRepositoryQuery(loadRequests, mode === 'requests')
  const collectors = useRepositoryQuery(loadCollectors, mode !== 'none')
  const requestState = mode === 'requests' ? requests.state : undefined
  const collectorState = collectors.state

  let state: QueryState<Data> = { status: 'loading' }
  if (collectorState?.status === 'error') state = collectorState
  else if (requestState?.status === 'error') state = requestState
  else if (collectorState?.status === 'ready' && (mode !== 'requests' || requestState?.status === 'ready')) {
    state = { status: 'ready', data: {
      requests: requestState?.status === 'ready' ? requestState.data : [],
      collectors: collectorState.data,
    } }
  }

  function reload() {
    if (collectorState?.status === 'error') collectors.reload()
    if (requestState?.status === 'error') requests.reload()
  }

  function updateRequest(saved: Request) {
    requests.update((items) => items.map((item) => item.id === saved.id ? saved : item))
  }

  function updateCollector(saved: Collector) {
    collectors.update((items) => items.some((item) => item.id === saved.id)
      ? items.map((item) => item.id === saved.id ? saved : item)
      : [...items, saved])
  }

  return { state, reload, updateRequest, updateCollector }
}
