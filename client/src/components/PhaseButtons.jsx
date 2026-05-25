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

          const getActiveClass = () => {
            if (phase.key === 'M1') return 'phase-btn-m1-active'
            if (phase.key === 'BP') return 'phase-btn-bp-active'
            return 'phase-btn-active'
          }

          return (
            <button
              key={phase.key}
              onClick={() => handleClick(index)}
              disabled={!canClick}
              className={`
                phase-btn-circle
                ${isActive ? getActiveClass() : ''}
                ${isPast ? 'phase-btn-past' : ''}
                ${!isYourTurn && !isActive ? 'opacity-40' : ''}
                ${canClick ? 'cursor-pointer hover:scale-105' : ''}
              `}
              title={`${phase.label} | turn=${isYourTurn}, idx=${index}, currIdx=${currentIndex}, hasFn=${!!onEndPhase}`}
            >
              <span className="phase-circle-label">
                {phase.key}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}