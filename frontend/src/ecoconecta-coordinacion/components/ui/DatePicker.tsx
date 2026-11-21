import { useCallback, useState } from 'react'
import { DayPicker } from '@daypicker/react'
import { es } from '@daypicker/react/locale/es'
import { Popover } from 'radix-ui'
import { formatDate } from '../../labels'
import type { LocalDate } from '../../types'
import { Icon } from './Icon'

const calendarLabel = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const compactDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' })
const labels = {
  labelPrevious: () => 'Mes anterior',
  labelNext: () => 'Mes siguiente',
  labelDayButton: (day: Date, modifiers: Record<string, boolean>) => {
    const label = calendarLabel.format(day)
    return [label, modifiers.today && 'hoy', modifiers.selected && 'fecha seleccionada'].filter(Boolean).join(', ')
  },
}

function dateKey(day: Date): LocalDate {
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${String(day.getFullYear()).padStart(4, '0')}-${month}-${date}`
}

export function DatePicker({
  label,
  value,
  today,
  onChange,
}: {
  label: string
  value: LocalDate
  today: LocalDate
  onChange: (value: LocalDate) => void
}) {
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const locateContainer = useCallback((trigger: HTMLButtonElement | null) => {
    setContainer(trigger?.closest<HTMLElement>('dialog, .eco-app') ?? null)
  }, [])
  const date = new Date(value + 'T12:00:00')
  const text = formatDate(value, true)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={locateContainer}
        className="picker-trigger date-picker-trigger"
        aria-label={`${label}, ${text}`}
      >
        <Icon name="calendar" />
        <span>{compactDate.format(new Date(value + 'T00:00:00Z'))}</span>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          className="picker-popover calendar-popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DayPicker
            mode="single"
            required
            autoFocus
            fixedWeeks
            showOutsideDays
            locale={es}
            lang="es-CO"
            weekStartsOn={1}
            labels={labels}
            today={new Date(today + 'T12:00:00')}
            defaultMonth={date}
            selected={date}
            components={{ Chevron: ({ orientation }) => <Icon name="chevron" data-orientation={orientation} /> }}
            onSelect={(day) => {
              onChange(dateKey(day))
              setOpen(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
