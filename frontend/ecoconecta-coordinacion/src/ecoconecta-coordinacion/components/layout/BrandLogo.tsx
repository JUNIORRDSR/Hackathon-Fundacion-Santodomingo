import { useId, useRef, useState } from 'react'
import logo from '../../../../identidad-visual/Logo EcoConecta - Verde bosque.png'

const width = 2172
const height = 724

// The outlines isolate the wings without redrawing the rest of the original PNG.
const wings = [
  {
    side: 'left',
    outline: 'M198 36H391L417 151L416 223L407 254L406 269L383 283L333 324L307 353H197Z',
  },
  {
    side: 'right',
    outline: 'M425 228L441 159L480 119L527 106L555 135L552 177L539 199L525 218L497 233L439 258L419 261L426 242Z '
      + 'M407 269L424 282L417 332L374 384H313L313 353L344 323L381 290Z',
  },
] as const

export function BrandLogo({ href }: { href: string }) {
  const id = useId()
  const image = useRef<HTMLImageElement>(null)
  const [flapping, setFlapping] = useState(false)
  const bitmap = id + '-bitmap'

  function flap() {
    if (image.current?.naturalWidth) setFlapping(true)
  }

  return (
    <a className="brand-link" href={href} aria-label="EcoConecta Villas de San Pablo"
      onPointerEnter={flap} onFocus={flap}>
      <span className="brand-mark" data-flapping={flapping}>
        <img ref={image} src={logo} alt="" width={width} height={height} onLoad={flap} />
        <svg className="brand-motion" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <image id={bitmap} href={logo} width={width} height={height} />
            {wings.map(({ side, outline }) => (
              <clipPath id={id + '-' + side} key={side}><path d={outline} /></clipPath>
            ))}
          </defs>
          <g className="brand-wing-cover">
            {wings.map(({ side, outline }) => <path key={side} d={outline} />)}
          </g>
          {wings.map(({ side }) => (
            <g key={side} className={'brand-wing brand-wing-' + side} onAnimationEnd={() => setFlapping(false)}>
              <use href={'#' + bitmap} clipPath={`url(#${id}-${side})`} />
            </g>
          ))}
        </svg>
      </span>
    </a>
  )
}
