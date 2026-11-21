import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

export interface Column<T> {
  header: string
  cell: (item: T) => ReactNode
  width?: string
}

// Toda lista de trabajo es una tabla como la de Solicitudes: la fila entera abre el detalle con su acción.
export function DataTable<T>({
  items,
  columns,
  rowKey,
  rowLabel,
  onSelect,
}: {
  items: T[]
  columns: Column<T>[]
  rowKey: (item: T) => string
  rowLabel: (item: T) => string
  onSelect: (item: T) => void
}) {
  const template = columns.map((column) => column.width ?? 'minmax(0, 1fr)').join(' ') + ' 2.75rem'
  return (
    <div className="card request-list data-table" style={{ '--columns': template } as CSSProperties}>
      <div className="request-columns" aria-hidden="true">
        {columns.map((column) => (
          <span key={column.header}>{column.header}</span>
        ))}
        <span />
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {items.map((item) => (
          <li className="request-row" key={rowKey(item)}>
            {columns.map((column) => (
              <div className="data-cell" key={column.header}>
                {column.cell(item)}
              </div>
            ))}
            <button
              type="button"
              className="button button-quiet request-action"
              aria-label={rowLabel(item)}
              onClick={() => onSelect(item)}
            >
              <Icon name="chevron" className="request-chevron" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
