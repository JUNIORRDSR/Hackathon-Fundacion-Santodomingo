import { useCallback, useState } from 'react'
import { Select } from 'radix-ui'
import { Icon } from './Icon'

export function FilterSelect({
  label,
  id,
  value,
  options,
  onChange,
  className = '',
  placeholder,
  disabled,
  required,
  invalid,
  describedBy,
}: {
  label: string
  id?: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const locateContainer = useCallback((trigger: HTMLButtonElement | null) => {
    setContainer(trigger?.closest<HTMLElement>('dialog, .eco-app') ?? null)
  }, [])

  return (
    <Select.Root
      disabled={disabled}
      value={value || !placeholder ? '_' + value : ''}
      onValueChange={(selection) => onChange(selection.slice(1))}
    >
      <Select.Trigger
        id={id}
        ref={locateContainer}
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={'picker-trigger ' + className}
      >
        <span className="picker-value">
          <Select.Value placeholder={placeholder} />
        </span>
        <Select.Icon asChild>
          <Icon name="chevron" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Content
          className="picker-popover picker-options"
          position="popper"
          align="start"
          sideOffset={6}
          collisionPadding={12}
        >
          <Select.ScrollUpButton className="picker-scroll" aria-hidden="true">
            <Icon name="chevron" />
          </Select.ScrollUpButton>
          <Select.Viewport className="picker-list">
            {options.map((option) => (
              <Select.Item key={option.value} value={'_' + option.value} className="picker-option">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Icon name="check" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="picker-scroll" aria-hidden="true">
            <Icon name="chevron" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
