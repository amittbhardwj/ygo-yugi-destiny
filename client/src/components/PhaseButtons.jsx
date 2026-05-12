const PHASES = [
  { key: 'DP', label: 'Draw Phase' },
  { key: 'SP', label: 'Standby Phase' },
  { key: 'M1', label: 'Main Phase 1' },
  { key: 'BP', label: 'Battle Phase' },
  { key: 'M2', label: 'Main Phase 2' },
  { key: 'EP', label: 'End Phase' },
]

function normalizePhase(phase) {
  const map = { draw: 'DP', standby: 'SP', main1: 'M1', battle: 'BP', main2: 'M2', end: 'EP' }
  return map[phase] || phase
}

export default function PhaseButtons({ currentPhase, isYourTurn, onEndPhase }) {
  const normalizedPhase = normalizePhase(currentPhase)
  const currentIndex = PHASES.findIndex(p => p.key === normalizedPhase)

  console.log('[PB] render', { currentPhase, isYourTurn, normalizedPhase, currentIndex, onEndPhase: typeof onEndPhase })

  const handleClick = (index) => {
    console.log('[PB] handleClick', { index, isYourTurn, currentIndex, onEndPhase: typeof onEndPhase })
    if (isYourTurn && index === currentIndex && onEndPhase) {
      onEndPhase()
    }
  }

  return (
    <div className="phase-buttons-vertical">
      <div className="phase-buttons-inner">
        {PHASES.map((phase, index) => {
          const isActive = index === currentIndex
          const isPast = index < currentIndex
          const canClick = isYourTurn && index === currentIndex && onEndPhase

          return (
            <button
              key={phase.key}
              onClick={() => handleClick(index)}
              disabled={!canClick}
              className={`
                phase-circle-btn
                ${isActive ? 'phase-active' : ''}
                ${isPast ? 'phase-past' : ''}
                ${!isYourTurn && !isActive ? 'phase-inactive' : ''}
                ${canClick ? 'cursor-pointer hover:scale-105' : ''}
              `}
              title={`${phase.label} | turn=${isYourTurn}, idx=${index}, currIdx=${currentIndex}, hasFn=${!!onEndPhase}`}
            >
              <span className={`
                phase-circle-label
                ${isActive ? 'text-ygo-dark font-bold' : ''}
                ${isPast ? 'text-gray-500' : ''}
                ${!isYourTurn && !isActive ? 'text-gray-600' : ''}
              `}>
                {phase.key}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}