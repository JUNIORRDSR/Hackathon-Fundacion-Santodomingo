import { useEffect, useState } from 'react'
import { errorText } from '../components/ui/Feedback'
import type { Collector, Coordinator, CoordinatorRepository, Request, Zone } from '../types'

type Data = { requests: Request[]; collectors: Collector[]; zones: Zone[] }
type LoadingState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: Data }

export function useCoordinatorData(coordinator: Coordinator, repository: CoordinatorRepository, loadRequests: boolean) {
  const { id, nombre, grupo } = coordinator
  const [state, setState] = useState<LoadingState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const scope = { id, nombre, grupo }
    const signal = controller.signal
    const requests = loadRequests ? repository.listRequests(scope, signal) : Promise.resolve([])
    Promise.all([requests, repository.listCollectors(scope, signal), repository.listZones(signal)])
      .then(([requests, collectors, zones]) => {
        if (signal.aborted) return
        setState({
          status: 'ready',
          data: {
            requests: requests.filter((item) => item.tipo === grupo),
            collectors: collectors.filter((item) => item.grupo === grupo),
            zones,
          },
        })
      })
      .catch((error: unknown) => {
        if (!signal.aborted) setState({ status: 'error', error: errorText(error) })
      })
    return () => controller.abort()
  }, [id, nombre, grupo, repository, attempt, loadRequests])

  function reload() {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  function updateRequest(saved: Request) {
    setState((previous) =>
      previous.status === 'ready'
        ? {
            status: 'ready',
            data: {
              ...previous.data,
              requests: previous.data.requests.map((item) => (item.id === saved.id ? saved : item)),
            },
          }
        : previous,
    )
  }

  function updateCollector(saved: Collector) {
    setState((previous) => {
      if (previous.status !== 'ready') return previous
      const collectors = previous.data.collectors.some((item) => item.id === saved.id)
        ? previous.data.collectors.map((item) => (item.id === saved.id ? saved : item))
        : [...previous.data.collectors, saved]
      return { status: 'ready', data: { ...previous.data, collectors } }
    })
  }

  return { state, reload, updateRequest, updateCollector }
}
