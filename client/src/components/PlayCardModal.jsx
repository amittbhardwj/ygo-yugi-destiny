export default function PlayCardModal({ card, onSummon, onSet, onCancel }) {
  if (!card) return null

  const type = (card.type || '').toLowerCase()
  const isMonster = type === 'monster'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-ygo-dark border-2 border-ygo-gold rounded-xl p-6 shadow-2xl min-w-72">
        <h3 className="text-ygo-gold font-bold text-lg mb-1 text-center">Play Card</h3>
        <p className="text-gray-300 text-sm mb-4 text-center">{card.name}</p>

        {isMonster ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onSummon}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-ygo-red hover:bg-red-600 text-white font-bold rounded-lg transition-colors"
            >
              <span className="text-xl">⚔️</span>
              <span>SUMMON (Attack Position)</span>
            </button>
            <button
              onClick={onSet}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
            >
              <span className="text-xl">🛡️</span>
              <span>SET (Defense Position)</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={onSummon}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors"
            >
              <span className="text-xl">✨</span>
              <span>{type === 'spell' ? 'ACTIVATE' : 'ACTIVATE'}</span>
            </button>
            <button
              onClick={onSet}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg transition-colors"
            >
              <span className="text-xl">🔮</span>
              <span>SET (Face-Down)</span>
            </button>
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
