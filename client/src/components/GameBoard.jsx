import { useState, useCallback } from 'react'
import Hand from './Hand'
import Field from './Field'
import PhaseIndicator from './PhaseIndicator'
import CardPopup from './CardPopup'

export default function GameBoard({
  gameState,
  isYourTurn,
  currentPhase,
  selectedMonster,
  attackTargets,
  onPlayCard,
  onSelectMonster,
  onAttackTarget,
  onEndPhase,
  onSurrender,
  emit,
}) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  if (!gameState) return null

  const { player, opponent } = gameState

  const handleCardHover = useCallback((card) => {
    setHoveredCard(card)
  }, [])

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const canPlayCard = isYourTurn && currentPhase === 'Main 1'
  const canBattle = isYourTurn && currentPhase === 'Battle'
  const canSelectMonsterForAttack = canBattle && selectedMonster !== null

  const handleMonsterClick = (card, index) => {
    if (canBattle && selectedMonster === null) {
      // Select this monster to attack with
      onSelectMonster(index)
    } else if (canBattle && selectedMonster !== null) {
      // Already have a monster selected, this click is on defender
      if (attackTargets.includes(index)) {
        onAttackTarget(index)
      }
    }
  }

  const handleEmptySlotClick = (index, type) => {
    if (type === 'monster' && canPlayCard) {
      // Play a monster from hand to this slot
      onPlayCard(index, 'monster')
    }
  }

  return (
    <div
      className="min-h-screen bg-ygo-field p-4"
      onMouseMove={handleMouseMove}
    >
      {/* Top HUD - Opponent info */}
      <div className="bg-ygo-dark/80 rounded-lg p-3 mb-3 border border-ygo-red">
        <div className="flex justify-between items-center">
          <span className="text-red-400 font-bold">{opponent.name}</span>
          <span className="text-white">LP: <span className="text-red-400 font-bold">{opponent.lp}</span></span>
          <span className="text-gray-400">Deck: {opponent.deckCount || 0}</span>
          <span className="text-gray-400">Grave: {opponent.graveCount || 0}</span>
        </div>
      </div>

      {/* Opponent hand */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">Opponent's Hand ({opponent.hand?.length || 0} cards)</div>
        <Hand cards={opponent.hand || []} isOpponent={true} />
      </div>

      {/* Opponent field */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
        <div className="text-xs text-gray-400 mb-2 text-center">Opponent's Field</div>
        <Field
          monsters={opponent.field?.monsters || []}
          spells={opponent.field?.spells || []}
          isOpponent={true}
          attackTargets={attackTargets}
          onMonsterClick={(card, index) => {
            if (canSelectMonsterForAttack && attackTargets.includes(index)) {
              onAttackTarget(index)
            }
          }}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center my-4">
        <div className="h-px bg-ygo-gold flex-1"></div>
        <span className="px-4 text-ygo-gold font-bold">VS</span>
        <div className="h-px bg-ygo-gold flex-1"></div>
      </div>

      {/* Your field */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
        <div className="text-xs text-gray-400 mb-2 text-center">Your Field</div>
        <Field
          monsters={player.field?.monsters || []}
          spells={player.field?.spells || []}
          isOpponent={false}
          selectedMonster={selectedMonster}
          attackTargets={attackTargets}
          selectable={canPlayCard || canBattle}
          onMonsterClick={handleMonsterClick}
          onSpellClick={() => {}}
          onEmptySlotClick={handleEmptySlotClick}
        />
      </div>

      {/* Your hand */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">Your Hand ({player.hand?.length || 0} cards)</div>
        <Hand
          cards={player.hand || []}
          isOpponent={false}
          selectable={canPlayCard}
          onCardClick={(card) => {
            if (canPlayCard) {
              onPlayCard(card, 'hand')
            }
          }}
        />
      </div>

      {/* Bottom HUD - Your info */}
      <div className="bg-ygo-dark/80 rounded-lg p-3 mb-3 border border-ygo-blue">
        <div className="flex justify-between items-center">
          <span className="text-blue-400 font-bold">{player.name}</span>
          <span className="text-white">LP: <span className="text-blue-400 font-bold">{player.lp}</span></span>
          <span className="text-gray-400">Deck: {player.deckCount || 0}</span>
          <span className="text-gray-400">Grave: {player.graveCount || 0}</span>
        </div>
      </div>

      {/* Phase indicator and controls */}
      <div className="flex gap-3">
        <div className="flex-1">
          <PhaseIndicator
            currentPhase={currentPhase}
            onEndPhase={onEndPhase}
            isYourTurn={isYourTurn}
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onSurrender}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors text-sm"
          >
            Surrender
          </button>
        </div>
      </div>

      {/* Card popup on hover */}
      <CardPopup card={hoveredCard} position={mousePos} />
    </div>
  )
}