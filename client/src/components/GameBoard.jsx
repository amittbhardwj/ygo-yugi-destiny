import { useState, useCallback, useRef } from 'react'
import Hand from './Hand'
import Field from './Field'
import CardDetailPanel from './CardDetailPanel'
import PhaseButtons from './PhaseButtons'
import PlayCardModal from './PlayCardModal'

// Phase mapping for display
const PHASE_MAP = {
  'DP': 'Draw',
  'SP': 'Standby',
  'M1': 'Main 1',
  'BP': 'Battle',
  'M2': 'Main 2',
  'EP': 'End'
}

const SERVER_PHASE_MAP = {
  'draw': 'DP',
  'standby': 'SP',
  'main1': 'M1',
  'battle': 'BP',
  'main2': 'M2',
  'end': 'EP',
}

function normalizePhase(phase) {
  return SERVER_PHASE_MAP[phase] || phase
}

function LifePointsDisplay({ name, lp, isPlayer }) {
  return (
    <div className={`lp-wing-frame ${isPlayer ? 'lp-player' : 'lp-opponent'}`}>
      <div className="lp-content">
        <span className="lp-name">{name}</span>
        <span className="lp-value">{lp?.toLocaleString() || 0}</span>
        <span className="lp-label">LP</span>
      </div>
    </div>
  )
}

function GameOverlay({ message, subMessage }) {
  if (!message) return null
  return (
    <div className="game-overlay">
      <div className="game-overlay-box">
        <div className="overlay-title">{message}</div>
        {subMessage && <div className="overlay-sub">{subMessage}</div>}
      </div>
    </div>
  )
}

export default function GameBoard({
  gameState,
  isYourTurn,
  currentPhase,
  rawPhase,
  selectedMonster,
  attackTargets,
  onPlayCard,
  onSelectMonster,
  onAttackTarget,
  onEndPhase,
  onSurrender,
  onEndTurn,
  emit,
  overlayMessage = null,
}) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [showPlayModal, setShowPlayModal] = useState(false)
  const [pendingPlayCard, setPendingPlayCard] = useState(null)
  const [localOverlay, setLocalOverlay] = useState(null)
  const lastTapRef = useRef(null) // for double-tap detection
  // Merge local overlay with parent-provided overlay (parent wins for turn announcements)
  const overlay = overlayMessage || localOverlay

  if (!gameState) return null

  const { player, opponent } = gameState
  const normalizedPhase = normalizePhase(currentPhase)

  const handleCardHover = useCallback((card) => {
    setHoveredCard(card)
  }, [])

  // Use server phase (rawPhase) for playability checks to avoid double-normalization issues
  const canPlayCard = isYourTurn && (rawPhase === 'main1' || rawPhase === 'standby')
  const canBattle = isYourTurn && rawPhase === 'battle'

  const handleMonsterClick = (card, index) => {
    console.log('[handleMonsterClick] canBattle=', canBattle, 'selectedMonster=', selectedMonster, 'index=', index, 'card=', card?.name);
    if (canBattle && selectedMonster === null) {
      console.log('[handleMonsterClick] calling onSelectMonster(', index, ')');
      onSelectMonster(index)
    } else if (canBattle && selectedMonster !== null) {
      if (attackTargets.includes(index)) {
        onAttackTarget(index)
      }
    }
  }

  const handleEndPhaseClick = () => {
    setLocalOverlay({ message: 'ENDING PHASE...', subMessage: null })
    setTimeout(() => {
      onEndPhase()
      setLocalOverlay(null)
    }, 500)
  }

  const handleCardClickFromHand = (card) => {
    const now = Date.now()
    const DOUBLE_TAP_MS = 300
    const lastTap = lastTapRef.current

    // Always show card detail on tap
    setHoveredCard(card)

    // Double tap → show summon/set modal
    if (lastTap && now - lastTap < DOUBLE_TAP_MS) {
      lastTapRef.current = null
      if (canPlayCard) {
        setPendingPlayCard(card)
        setShowPlayModal(true)
      }
    } else {
      lastTapRef.current = now
      // Single tap: just show card detail (handled above)
      // Modal will show on double-tap above, or if canPlayCard is true and we want to bypass double-tap
      // For now: single tap = detail only, double tap = modal
    }
  }

  return (
    <div className="game-board-root">
      {/* Left Panel - Card Detail */}
      <div className="left-panel">
        <CardDetailPanel card={hoveredCard} />

        {/* Phase buttons below card detail */}
        <div className="phase-column">
          <div className="phase-title">PHASE</div>
          <PhaseButtons
            currentPhase={rawPhase}
            isYourTurn={isYourTurn}
            onEndPhase={handleEndPhaseClick}
          />
          {/* Explicit End Phase / End Turn buttons */}
          <div className="action-buttons">
            <button
              onClick={handleEndPhaseClick}
              disabled={!isYourTurn}
              className="action-btn action-btn-end-phase"
              title="Advance to next phase"
            >
              END PHASE
            </button>
            <button
              onClick={onEndTurn}
              disabled={!isYourTurn}
              className="action-btn action-btn-end-turn"
              title="End your turn"
            >
              END TURN
            </button>
          </div>
        </div>
      </div>

      {/* Main Field Area */}
      <div className="main-field">
        {/* Top - Opponent Info */}
        <div className="top-bar">
          <LifePointsDisplay name={opponent.name} lp={opponent.lp} isPlayer={false} />
          <div className="deck-info">
            <span className="deck-count">{opponent.deckCount || 0}</span>
            <span className="deck-label">DECK</span>
          </div>
          <div className="grave-info">
            <span className="grave-count">{opponent.grave?.length || 0}</span>
            <span className="grave-label">GRAVE</span>
          </div>
        </div>

        {/* Opponent Hand */}
        <div className="opponent-hand-area">
          <div className="hand-label">OPPONENT'S HAND</div>
          <Hand cards={opponent.hand || []} isOpponent={true} onHover={handleCardHover} />
        </div>

        {/* Opponent Field */}
        <div className="field-area opponent-field-area">
          <Field
            monsters={opponent.field?.monsters || []}
            spells={opponent.field?.spells || []}
            isOpponent={true}
            attackTargets={attackTargets}
            onMonsterClick={(card, index) => {
              if (canBattle && selectedMonster !== null && attackTargets.includes(index)) {
                onAttackTarget(index)
              }
            }}
            onCardHover={handleCardHover}
          />
        </div>

        {/* VS Divider */}
        <div className="vs-divider">
          <div className="vs-line"></div>
          <div className="vs-text">VS</div>
          <div className="vs-line"></div>
        </div>

        {/* Player Field */}
        <div className="field-area player-field-area">
          <Field
            monsters={player.field?.monsters || []}
            spells={player.field?.spells || []}
            isOpponent={false}
            selectedMonster={selectedMonster}
            attackTargets={attackTargets}
            selectable={canPlayCard || canBattle}
            onMonsterClick={handleMonsterClick}
            onSpellClick={() => {}}
            onEmptySlotClick={() => {}}
            onCardHover={handleCardHover}
          />
        </div>

        {/* Player Hand */}
        <div className="player-hand-area">
          <Hand
            cards={player.hand || []}
            isOpponent={false}
            selectable={canPlayCard}
            onHover={handleCardHover}
            onCardClick={handleCardClickFromHand}
          />
          <div className="hand-label">YOUR HAND ({player.hand?.length || 0})</div>
        </div>

        {/* Bottom - Player Info */}
        <div className="bottom-bar">
          <LifePointsDisplay name={player.name} lp={player.lp} isPlayer={true} />
          <div className="deck-info">
            <span className="deck-count">{player.deckCount || 0}</span>
            <span className="deck-label">DECK</span>
          </div>
          <div className="grave-info">
            <span className="grave-count">{player.grave?.length || 0}</span>
            <span className="grave-label">GRAVE</span>
          </div>
        </div>
      </div>

      {/* Game Overlay */}
      {overlay && <GameOverlay message={overlay.message} subMessage={overlay.subMessage} />}

      {/* Play Card Modal */}
      {showPlayModal && pendingPlayCard && (
        <PlayCardModal
          card={pendingPlayCard}
          onSummon={() => {
            const action = pendingPlayCard.type === 'Spell' || pendingPlayCard.type === 'Trap'
              ? 'activate'
              : 'summon'
            onPlayCard(pendingPlayCard, action)
            setShowPlayModal(false)
            setPendingPlayCard(null)
          }}
          onSet={() => {
            onPlayCard(pendingPlayCard, 'set')
            setShowPlayModal(false)
            setPendingPlayCard(null)
          }}
          onCancel={() => {
            setShowPlayModal(false)
            setPendingPlayCard(null)
          }}
        />
      )}
    </div>
  )
}