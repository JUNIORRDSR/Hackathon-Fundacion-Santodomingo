import { useState } from 'react'
import { MonarchMark } from '../ui/MonarchMark'
import { BinIcon, SectionHeader } from './Secciones'
import { canecas, objetos } from './contenido'
import type { Caneca } from './contenido'

const ROUNDS = 8
const shuffle = () =>
  objetos
    .map((objeto) => ({ objeto, orden: Math.random() }))
    .sort((a, b) => a.orden - b.orden)
    .slice(0, ROUNDS)
    .map(({ objeto }) => objeto)
const binName = (id: Caneca) => canecas.find((caneca) => caneca.id === id)?.nombre.toLowerCase() ?? id

// «¿Dónde va?»: ocho objetos de la vida diaria; cada respuesta explica el porqué, también cuando se acierta.
export function SortingGame() {
  const [items, setItems] = useState(shuffle)
  const [round, setRound] = useState(0)
  const [answer, setAnswer] = useState<Caneca>()
  const [score, setScore] = useState(0)
  const item = items[round]
  const finished = round >= items.length

  function choose(bin: Caneca) {
    if (answer) return
    setAnswer(bin)
    if (bin === item.caneca) setScore((value) => value + 1)
  }
  function next() {
    setAnswer(undefined)
    setRound((value) => value + 1)
  }
  function restart() {
    setItems(shuffle())
    setRound(0)
    setScore(0)
    setAnswer(undefined)
  }

  return (
    <section className="card juego" aria-labelledby="juego-titulo" id="juego-donde-va">
      <div className="juego-cabeza">
        <SectionHeader kicker="Juego" title="¿Dónde va?" id="juego-titulo">
          <p>Elige la caneca correcta para cada objeto. Son {ROUNDS} rondas y cada una deja una lección.</p>
        </SectionHeader>
        <p className="juego-marcador" aria-live="polite">
          <strong>{score}</strong> aciertos
          <span>{finished ? 'Terminado' : `Ronda ${round + 1} de ${items.length}`}</span>
        </p>
      </div>
      <div className="juego-progreso" aria-hidden="true">
        <i style={{ width: (Math.min(round + (answer ? 1 : 0), items.length) / items.length) * 100 + '%' }} />
      </div>
      {finished ? (
        <div className="juego-final">
          <MonarchMark className="monarch-celebra" />
          <h3>
            {score} de {items.length} aciertos
          </h3>
          <p>
            {score === items.length
              ? '¡Separas como experto! Comparte el juego con tu familia.'
              : score >= items.length * 0.6
                ? 'Muy bien. Repasa el código de colores y vuelve a intentarlo.'
                : 'Vas aprendiendo: mira las guías de arriba y juega otra vez.'}
          </p>
          <button type="button" className="button button-primary" onClick={restart}>
            Jugar otra vez
          </button>
        </div>
      ) : (
        <div className="juego-ronda" key={round}>
          <div className="juego-objeto">
            <span className="juego-emoji" aria-hidden="true">
              {item.emoji}
            </span>
            <strong>{item.nombre}</strong>
          </div>
          <div className="juego-opciones" role="group" aria-label={'¿En qué caneca va: ' + item.nombre + '?'}>
            {canecas.map((caneca) => {
              const verdict = !answer
                ? undefined
                : caneca.id === item.caneca
                  ? 'bien'
                  : caneca.id === answer
                    ? 'mal'
                    : 'otra'
              return (
                <button
                  key={caneca.id}
                  type="button"
                  className="juego-opcion"
                  data-veredicto={verdict}
                  aria-pressed={answer === caneca.id}
                  onClick={() => choose(caneca.id)}
                >
                  <BinIcon type={caneca.id} />
                  <span>{caneca.nombre}</span>
                </button>
              )
            })}
          </div>
          <div className="juego-pista" aria-live="polite">
            {answer && (
              <>
                <p data-acierto={answer === item.caneca}>
                  <strong>{answer === item.caneca ? '¡Correcto!' : `Va en la ${binName(item.caneca)}.`}</strong>{' '}
                  {item.porque}
                </p>
                <button type="button" className="button button-primary" onClick={next} autoFocus>
                  {round + 1 < items.length ? 'Siguiente objeto' : 'Ver mi resultado'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
