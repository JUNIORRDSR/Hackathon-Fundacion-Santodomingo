import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Popover, ToggleGroup } from 'radix-ui'
import { timeMinutes } from '../../labels'
import { Icon } from './Icon'

const pattern = '(?:[01][0-9]|2[0-3]):[0-5][0-9]'
const twoDigits = (value: number) => String(value).padStart(2, '0')
const hours = Array.from({ length: 24 }, (_, index) => twoDigits(index))
const minutes = Array.from({ length: 60 }, (_, index) => twoDigits(index))

function formatEntry(text: string) {
  const match = /^(\d{1,2}):(\d{0,2})$/.exec(text.trim())
  if (match) return (match[2].length === 2 ? match[1].padStart(2, '0') : match[1]) + ':' + match[2]
  const digits = text.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits
}

function TimeOptions({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = list.current
    const active = element?.querySelector<HTMLButtonElement>('[data-state="on"]')
    if (!element || !active) return
    if (active.offsetTop < element.scrollTop) element.scrollTop = active.offsetTop
    const bottom = active.offsetTop + active.offsetHeight
    if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight
  }, [value])

  return (
    <div className="time-options">
      <span>{label}</span>
      <ToggleGroup.Root
        ref={list}
        type="single"
        orientation="vertical"
        aria-label={label}
        value={value}
        onValueChange={(option) => option && onChange(option)}
      >
        {options.map((option) => (
          <ToggleGroup.Item type="button" key={option} value={option}>
            {option}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  )
}

type InputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'disabled' | 'required' | 'aria-invalid' | 'aria-describedby'
>

export function TimeField({
  id,
  label,
  value,
  onChange,
  ...input
}: InputProps & {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [partHour, setPartHour] = useState('00')
  const [partMinute, setPartMinute] = useState('00')
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const locateContainer = useCallback((trigger: HTMLButtonElement | null) => {
    setContainer(trigger?.closest<HTMLElement>('dialog, .eco-app') ?? null)
  }, [])

  function toggle(next: boolean) {
    if (next) {
      const valid = timeMinutes(value) !== undefined
      setPartHour(valid ? value.slice(0, 2) : '00')
      setPartMinute(valid ? value.slice(3) : '00')
    }
    setOpen(next)
  }

  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      <Popover.Anchor asChild>
        <div className="time-field">
          <input
            {...input}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            pattern={pattern}
            placeholder="HH:MM"
            title="Usa el formato de 24 horas, por ejemplo 06:30"
            onChange={(event) => onChange(formatEntry(event.target.value))}
          />
          <Popover.Trigger
            ref={locateContainer}
            className="icon-button time-field-trigger"
            aria-label={`Elegir ${label.toLocaleLowerCase('es-CO')}`}
            disabled={input.disabled}
          >
            <Icon name="clock" />
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal container={container}>
        <Popover.Content
          className="picker-popover time-popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
        >
          <div className="time-columns">
            <TimeOptions label="Horas" options={hours} value={partHour} onChange={setPartHour} />
            <TimeOptions label="Minutos" options={minutes} value={partMinute} onChange={setPartMinute} />
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              onChange(partHour + ':' + partMinute)
              setOpen(false)
            }}
          >
            Aplicar hora
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
