const PHASES = ['Draw', 'Standby', 'Main 1', 'Battle', 'Main 2', 'End']

export default function PhaseIndicator({ currentPhase, onEndPhase, isYourTurn }) {
  const currentIndex = PHASES.indexOf(currentPhase)

  return (
    <div className="bg-ygo-dark border border-ygo-gold rounded-lg p-3">
      {/* Turn indicator */}
      <div className={`text-center font-bold mb-2 ${isYourTurn ? 'text-green-400' : 'text-red-400'}`}>
        {isYourTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
      </div>

      {/* Phase steps */}
      <div className="flex items-center gap-1">
        {PHASES.map((phase, index) => {
          const isActive = index === currentIndex
          const isPast = index < currentIndex

          return (
            <div key={phase} className="flex items-center">
              <div
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  ${isActive ? 'bg-ygo-gold text-ygo-dark' : ''}
                  ${isPast ? 'bg-gray-700 text-gray-400' : ''}
                  ${!isActive && !isPast ? 'bg-gray-800 text-gray-500' : ''}
                `}
              >
                {phase}
              </div>
              {index < PHASES.length - 1 && (
                <span className="text-gray-600 mx-1">→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* End phase button */}
      {isYourTurn && currentPhase !== 'End' && (
        <button
          onClick={onEndPhase}
          className="mt-3 w-full py-2 bg-ygo-red hover:bg-red-600 text-white font-bold rounded transition-colors"
        >
          END PHASE
        </button>
      )}
    </div>
  )
}