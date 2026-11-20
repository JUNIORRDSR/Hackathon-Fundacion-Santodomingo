import { useRef, useState } from 'react'
import { errorText } from './Feedback'

export function useSubmission() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(operation: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return { run, busy, error }
}
