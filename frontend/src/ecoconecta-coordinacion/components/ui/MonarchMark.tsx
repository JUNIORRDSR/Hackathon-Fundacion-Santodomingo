import { useId } from 'react'
import monarch from '../../../../identidad-visual/Mariposa monarca - isotipo.webp'

// Isotipo de Villas de San Pablo. Las capas salen del mismo bitmap: las alas se pliegan sobre el eje del cuerpo,
// y el cuerpo y las antenas, encima, quedan quietos. Coordenadas del recorte original (1358 × 1024).
const parts = [
  { part: 'near', outline: 'M0 0H756V600L770 628L405 1024H0Z' },
  { part: 'far', outline: 'M770 628L812 612L850 568L950 522L1010 488L1042 470V0H1358V1024H405Z' },
  {
    part: 'body',
    outline:
      'M753 602L757 578L767 553L791 542L815 552L826 578L816 603L797 642L552 908L516 903L508 868Z ' +
      'M762 336L785 330L802 342L808 372L820 410L822 470L814 548L796 552L797 470L796 415L788 390L770 380L761 360Z ' +
      'M812 548L850 505L900 476L950 455L1000 442L1030 448L1032 465L1005 474L955 474L905 494L858 525L822 562Z',
  },
] as const

export function MonarchMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg className={className ? 'monarch ' + className : 'monarch'} viewBox="0 0 1358 1024" aria-hidden="true">
      <defs>
        <image id={id + '-bitmap'} href={monarch} width="1358" height="1024" />
        {parts.map(({ part, outline }) => (
          <clipPath id={id + '-' + part} key={part}>
            <path d={outline} />
          </clipPath>
        ))}
      </defs>
      {parts.map(({ part }) => (
        <g key={part} className={'monarch-' + part}>
          <use href={'#' + id + '-bitmap'} clipPath={`url(#${id}-${part})`} />
        </g>
      ))}
    </svg>
  )
}
