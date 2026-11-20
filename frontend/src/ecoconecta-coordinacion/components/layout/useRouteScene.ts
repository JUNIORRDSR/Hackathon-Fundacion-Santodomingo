import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { EcoPage } from '../../routes'
import { animateMotion, prefersReducedMotion } from '../ui/motion'

type SceneChange = { page: EcoPage; cancel: () => void }

export function useRouteScene(page: EcoPage, children: ReactNode, stage: RefObject<HTMLDivElement | null>) {
  const [visiblePage, setVisiblePage] = useState(page)
  const visibleContent = useRef(children)
  const change = useRef<SceneChange | undefined>(undefined)

  useLayoutEffect(() => {
    const element = stage.current
    if (page === visiblePage) {
      visibleContent.current = children
      if (change.current?.page !== page) {
        change.current?.cancel()
        change.current = undefined
      }
      return
    }
    if (change.current?.page === page) return
    change.current?.cancel()

    if (!element || prefersReducedMotion() || document.visibilityState === 'hidden') {
      change.current = undefined
      setVisiblePage(page)
      return
    }

    const pending: SceneChange = { page, cancel: () => {} }
    change.current = pending
    function release() {
      if (change.current !== pending) return
      change.current = undefined
      delete element?.dataset.routeTransition
    }

    if (document.startViewTransition) {
      element.dataset.routeTransition = 'true'
      const transition = document.startViewTransition(() => {
        if (change.current === pending) flushSync(() => setVisiblePage(page))
      })
      pending.cancel = () => {
        transition.skipTransition()
        delete element.dataset.routeTransition
      }
      void transition.ready.catch(() => {})
      void transition.finished.then(release, release)
    } else {
      const exit = animateMotion(
        element,
        [
          { opacity: 1, translate: '0 0', scale: 1 },
          { opacity: 0.9, translate: '0 -4px', scale: 0.997 },
        ],
        '--motion-route-exit',
        { fill: 'forwards' },
      )
      pending.cancel = () => exit?.cancel()
      if (!exit) {
        release()
        setVisiblePage(page)
      } else
        void exit.finished.then(
          () => {
            if (change.current !== pending) return
            release()
            flushSync(() => setVisiblePage(page))
            exit.cancel()
          },
          () => {},
        )
    }
  }, [children, page, stage, visiblePage])

  useLayoutEffect(
    () => () => {
      change.current?.cancel()
      change.current = undefined
    },
    [],
  )

  return { visiblePage, content: page === visiblePage ? children : visibleContent.current }
}
