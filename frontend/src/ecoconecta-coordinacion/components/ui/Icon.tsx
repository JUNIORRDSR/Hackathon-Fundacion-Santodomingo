import type { SVGProps } from 'react'

const paths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v4h-7z M14 11h7v10h-7z M3 14h7v7H3z',
  clipboard:
    'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2' +
    ' M9 2h6a1 1 0 0 1 1 1v3H8V3a1 1 0 0 1 1-1z M8 11h8 M8 16h6',
  truck:
    'M5 17H2V5h13v12H9 M15 9h4l3 4v4h-2 M15 17h1 M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' +
    ' M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' +
    ' M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  book: 'M12 7a5 5 0 0 0-5-4H3v16h4a5 5 0 0 1 5 3 5 5 0 0 1 5-3h4V3h-4a5 5 0 0 0-5 4V22',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 2v4 M16 2v4 M3 10h18',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  check: 'm5 12 4 4L19 6',
  checkCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 12l3 3 5-6',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 9l6 6m0-6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  gift:
    'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z' +
    ' M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7z',
  more: 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-4.9A8.4 8.4 0 1 1 21 11.5z',
  pin: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  leaf: 'M20 4c-7 0-13 2-14 8-1 4 2 7 6 6 6-1 8-7 8-14z M4 21l10-10',
  recycle:
    'm8 7 2-3a2 2 0 0 1 3.5 0l3 5 M13 9l4 1 1-4 M18 12l2 3a2 2 0 0 1-1.75 3h-6' +
    ' M14 15l-3 3 3 3 M8 18H5a2 2 0 0 1-1.75-3l3-5 M3 11l4-1 1 4',
  chevron: 'm6 9 6 6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l4 4',
  inbox: 'M4 4h16l2 10v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5z M2 14h6l2 3h4l2-3h6',
  alert: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 7v6 M12 17h.01',
  plus: 'M12 5v14M5 12h14',
  edit: 'm14 5 5 5 M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  play: 'M8 5v14l11-7z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11v6 M12 7h.01',
  spark: 'M12 2c0 6-4 10-10 10 6 0 10 4 10 10 0-6 4-10 10-10-6 0-10-4-10-10z',
  scale: 'M12 3v17 M4 21h16 M3 7h18 M6 7l-4 8h8z M18 7l-4 8h8z',
  qr:
    'M3 8V5a2 2 0 0 1 2-2h3 M16 3h3a2 2 0 0 1 2 2v3 M21 16v3a2 2 0 0 1-2 2h-3 M8 21H5a2 2 0 0 1-2-2v-3' +
    ' M7 7h4v4H7z M13 13h4v4h-4z M13 7h4 M17 10v1 M7 13v4h4 M13 10h1',
  camera:
    'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z' +
    ' M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  printer: 'M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  )
}
