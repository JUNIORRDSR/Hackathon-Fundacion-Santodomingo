import { useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { formatDay, isLocalDate, shiftDate, statusLabels, timeMinutes } from '../../labels'
import type { Collector, LocalDate, Request } from '../../types'
import { EmptyState } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { MotionPills } from '../ui/MotionPills'
import { getCollectorNames, getTimelineData } from './timelineData'
import type { PlannedRequest } from './timelineData'
import { useTimelineMotion } from './useTimelineMotion'
import { AgendaList, CollectorAvatar } from './AgendaList'

type View = 'timeline' | 'agenda'
const compactQuery = '(max-width: 730px)'
const prefersAgenda = () => window.matchMedia(compactQuery).matches

function subscribeToWidth(callback: () => void) {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function TimelineGrid({
  requests,
  names,
  clock,
  selectedId,
  onSelect,
}: {
  requests: PlannedRequest[]
  names: Map<string, string>
  clock?: string
  selectedId?: string
  onSelect: (item: Request) => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const layout = JSON.stringify(requests.map(({ id, asignacion }) => [id, asignacion.recolectorId, asignacion.hora]))
  useTimelineMotion(canvas, layout)
  const { byCollector, withoutTime, start, end, range, ticks } = getTimelineData(requests)
  const now = timeMinutes(clock)
  const visibleNow = now !== undefined && now >= start && now <= end ? now : undefined
  const tickLabels = ticks.filter((minute) => visibleNow === undefined || Math.abs(minute - visibleNow) > range * 0.08)
  const position = (minute: number) => (100 * (minute - start)) / range + '%'
  return (
    <>
      {byCollector.size > 0 && (
        <div className="timeline-scroll" role="region" aria-label="Cronograma por hora" tabIndex={0}>
          <div className="timeline-canvas" ref={canvas}>
            <div className="timeline-axis">
              <span>Recolector</span>
              <div className="timeline-track">
                {tickLabels.map((minute) => (
                  <time className="timeline-tick" key={minute} style={{ left: position(minute) }}>
                    {String(minute / 60).padStart(2, '0')}:00
                  </time>
                ))}
              </div>
            </div>
            <div className="timeline-gridlines" aria-hidden="true">
              <div className="timeline-track">
                {ticks.map((minute) => (
                  <i key={minute} style={{ left: position(minute) }} />
                ))}
              </div>
            </div>
            {[...names].map(([id, name]) => {
              const tracks = byCollector.get(id)
              if (!tracks) return null
              return (
                <div className="timeline-lane" key={id}>
                  <div className="timeline-collector" title={name}>
                    <CollectorAvatar name={name} />
                    <span>{name}</span>
                  </div>
                  <div className="timeline-tracks">
                    {tracks.map((tasks, track) => (
                      <div className="timeline-track timeline-task-row" key={track}>
                        {tasks.map(({ request, minute }) => {
                          const label =
                            request.asignacion.hora + ' · ' + request.solicitante + ' · ' + statusLabels[request.estado]
                          const icon =
                            request.estado === 'recolectada'
                              ? 'check'
                              : request.estado === 'rechazada'
                                ? 'close'
                                : 'truck'
                          return (
                            <button
                              key={request.id}
                              type="button"
                              className={'timeline-task timeline-task-' + request.estado}
                              aria-haspopup="dialog"
                              data-selected={selectedId === request.id}
                              data-timeline-task={request.id}
                              aria-label={label}
                              title={label}
                              style={{ '--task-position': position(minute) } as CSSProperties}
                              onClick={() => onSelect(request)}
                            >
                              <span className="timeline-task-icon">
                                <Icon name={icon} />
                              </span>
                              <span>{request.solicitante}</span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {clock && visibleNow !== undefined && (
              <div className="timeline-now-layer" aria-hidden="true">
                <div className="timeline-track">
                  <div className="timeline-now" style={{ left: position(visibleNow) }}>
                    <span>{clock}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {withoutTime.length > 0 && (
        <div className="timeline-unscheduled">
          <h3>Recolecciones sin hora</h3>
          <AgendaList requests={withoutTime} names={names} selectedId={selectedId} onSelect={onSelect} />
        </div>
      )}
    </>
  )
}

function DateSelector({
  date,
  today,
  onChange,
}: {
  date: LocalDate
  today: LocalDate
  onChange: (value: LocalDate) => void
}) {
  return (
    <div className="date-selector" role="group" aria-label="Día de la planificación">
      <button
        type="button"
        className="icon-button date-previous"
        aria-label="Día anterior"
        onClick={() => onChange(shiftDate(date, -1))}
      >
        <Icon name="chevron" />
      </button>
      <input
        type="date"
        value={date}
        aria-label="Fecha de planificación"
        onChange={(event) => {
          if (isLocalDate(event.target.value)) onChange(event.target.value)
        }}
      />
      <button
        type="button"
        className="icon-button date-next"
        aria-label="Día siguiente"
        onClick={() => onChange(shiftDate(date, 1))}
      >
        <Icon name="chevron" />
      </button>
      <button type="button" className="button button-secondary today-button" onClick={() => onChange(today)}>
        Hoy
      </button>
    </div>
  )
}

export function ScheduleTimeline({
  planned,
  collectors,
  today,
  clock,
  selectedId,
  onSelect,
}: {
  planned: PlannedRequest[]
  collectors: Collector[]
  today: LocalDate
  clock: string
  selectedId?: string
  onSelect: (item: Request) => void
}) {
  const headingId = useId()
  const [selectedDate, setSelectedDate] = useState<LocalDate>()
  const [collectorId, setCollectorId] = useState('')
  const [selectedView, setSelectedView] = useState<View>()
  const compact = useSyncExternalStore(subscribeToWidth, prefersAgenda, () => false)

  const firstUpcoming = planned.find(({ asignacion }) => asignacion.fecha >= today)
  const date = selectedDate ?? firstUpcoming?.asignacion.fecha ?? planned.at(-1)?.asignacion.fecha ?? today
  const view = selectedView ?? (compact ? 'agenda' : 'timeline')
  const names = getCollectorNames(collectors, planned)
  const visible = planned.filter(
    ({ asignacion }) => asignacion.fecha === date && (!collectorId || asignacion.recolectorId === collectorId),
  )
  return (
    <section className="card bento-panel timeline-panel" aria-labelledby={headingId}>
      <div className="panel-heading timeline-heading">
        <div>
          <h2 id={headingId}>Planificación de recolecciones</h2>
          <p>
            <span aria-live="polite">{formatDay(date)}</span>
            {date === today ? ' · ' + clock + ' en Barranquilla' : ''}
          </p>
        </div>
        <MotionPills className="segmented-control" label="Vista de la planificación" active={view}>
          <button type="button" aria-pressed={view === 'timeline'} onClick={() => setSelectedView('timeline')}>
            Cronograma
          </button>
          <button type="button" aria-pressed={view === 'agenda'} onClick={() => setSelectedView('agenda')}>
            Agenda
          </button>
        </MotionPills>
      </div>
      <div className="timeline-toolbar">
        <DateSelector date={date} today={today} onChange={setSelectedDate} />
        <div className="select-field timeline-filter">
          <select
            aria-label="Filtrar por recolector"
            value={collectorId}
            onChange={(event) => setCollectorId(event.target.value)}
          >
            <option value="">Todo el equipo</option>
            {[...names].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </div>
      </div>
      <div className="view-content" key={JSON.stringify([view, date, collectorId])}>
        {visible.length === 0 ? (
          <EmptyState title="Sin recolecciones para este día" icon="calendar">
            Elige otra fecha o cambia el filtro de recolector.
          </EmptyState>
        ) : view === 'agenda' ? (
          <AgendaList requests={visible} names={names} selectedId={selectedId} onSelect={onSelect} />
        ) : (
          <TimelineGrid
            requests={visible}
            names={names}
            clock={date === today ? clock : undefined}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </div>
    </section>
  )
}
