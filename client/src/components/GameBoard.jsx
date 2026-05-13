import { useState, useCallback } from 'react'
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

function LifePointsDisplay({ name, lp, isPlayer, damage = null }) {
  return (
    <div className={`lp-wing-frame ${isPlayer ? 'lp-player' : 'lp-opponent'} ${damage ? 'lp-damage-flash' : ''}`}>
      <div className="lp-content">
        <span className="lp-name">{name}</span>
        <span className="lp-value">{lp?.toLocaleString() || 0}</span>
        <span className="lp-label">LP</span>
      </div>
      {damage ? <span className="lp-floating-damage">-{damage}</span> : null}
    </div>
  )
}

function GameOverlay({ message, subMessage }) {
  if (!message) return null
  return (
    <div className="game-overlay" style={{ pointerEvents: 'none' }}>
      <div className="game-overlay-box">
        <div className="overlay-title">{message}</div>
        {subMessage && <div className="overlay-sub">{subMessage}</div>}
      </div>
    </div>
  )
}

function YugiGuide({ phase, isYourTurn }) {
  const prompt = isYourTurn
    ? phase === 'main1'
      ? 'Select a card from your hand, then choose Summon, Set, or Activate.'
      : phase === 'battle'
        ? 'Choose an attack-position monster, then select a target.'
        : 'Click the glowing phase orb when you are ready to continue.'
    : 'Yugi is thinking... watch the field and prepare your next move.'

  return (
    <div className="yugi-guide" aria-hidden="true">
      <div className="yugi-sprite">
        <div className="yugi-hair yugi-hair-back" />
        <div className="yugi-hair yugi-hair-left" />
        <div className="yugi-hair yugi-hair-right" />
        <div className="yugi-face" />
        <div className="yugi-body" />
        <div className="yugi-arm" />
      </div>
      <div className="yugi-speech">{prompt}</div>
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
  duelAnimation = null,
}) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [showPlayModal, setShowPlayModal] = useState(false)
  const [pendingPlayCard, setPendingPlayCard] = useState(null)
  const [localOverlay, setLocalOverlay] = useState(null)
  const [confirmEndTurn, setConfirmEndTurn] = useState(false)
  // Merge local overlay with parent-provided overlay (parent wins for turn announcements)
  const overlay = overlayMessage || localOverlay

  if (!gameState) return null

  const { player, opponent } = gameState
  const normalizedPhase = normalizePhase(currentPhase)
  const isAttackAnimation = duelAnimation?.kind === 'attack'
  const opponentDamage = isAttackAnimation && duelAnimation.damage > 0 ? duelAnimation.damage : null

  const handleCardHover = useCallback((card) => {
    setHoveredCard(card)
  }, [])

  // Use server phase (rawPhase) for playability checks to avoid double-normalization issues
  const canPlayCard = isYourTurn && (rawPhase === 'main1' || rawPhase === 'main2')
  const canBattle = isYourTurn && rawPhase === 'battle'

  const handleMonsterClick = (card, index) => {
    console.log('[handleMonsterClick] canBattle=', canBattle, 'isYourTurn=', isYourTurn, 'rawPhase=', rawPhase, 'selectedMonster=', selectedMonster, 'index=', index, 'card=', card?.name);
    if (canBattle && selectedMonster === null) {
      console.log('[handleMonsterClick] calling onSelectMonster(', index, ')');
      onSelectMonster(index)
    } else if (canBattle && selectedMonster !== null) {
      if (selectedMonster === index && attackTargets.length === 0) {
        emit('direct-attack', { attackerId: card.cardId })
        onSelectMonster(null)
        return
      }
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
    setHoveredCard(card)
    if (canPlayCard) {
      setPendingPlayCard(card)
      setShowPlayModal(true)
    }
  }

  return (
    <div className="game-board-root">
      <YugiGuide phase={rawPhase} isYourTurn={isYourTurn} />
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
              onClick={() => setConfirmEndTurn(true)}
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
          <LifePointsDisplay name={opponent.name} lp={opponent.lp} isPlayer={false} damage={opponentDamage} />
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
        <div className="field-area opponent-field-area field-egyptian">
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
            duelAnimation={duelAnimation}
          />
        </div>

        {/* VS Divider */}
        <div className="vs-divider">
          <div className="vs-line"></div>
          <div className="vs-text">VS</div>
          <div className="vs-line"></div>
        </div>

        {/* Player Field */}
        <div className="field-area player-field-area field-egyptian">
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
            duelAnimation={duelAnimation}
          />
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

        {/* Player Hand - kept at the very bottom like Power of Chaos */}
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
      </div>

      {/* Game Overlay */}
      {overlay && <GameOverlay message={overlay.message} subMessage={overlay.subMessage} />}

      {duelAnimation?.kind === 'command' && (
        <div className="poc-command-banner" key={duelAnimation.id}>{duelAnimation.message}</div>
      )}

      {duelAnimation?.kind === 'attack' && (
        <div className={`poc-attack-burst ${duelAnimation.targetId ? 'with-target' : 'direct-hit'}`} key={duelAnimation.id}>
          <span>{duelAnimation.targetId ? 'ATTACK!' : 'DIRECT ATTACK!'}</span>
        </div>
      )}

      {duelAnimation?.kind === 'coin' && (
        <div className="poc-coin-overlay" key={duelAnimation.id}>
          <div className={`poc-coin ${duelAnimation.side === 'heads' ? 'heads' : 'tails'}`} />
          <div className="poc-coin-result">
            {duelAnimation.side?.toUpperCase()} — {duelAnimation.winner === 'player1' ? 'YOU GO FIRST' : 'YUGI GOES FIRST'}
          </div>
        </div>
      )}

      {confirmEndTurn && (
        <div className="command-overlay">
          <div className="command-window">
            <div className="command-title">END TURN?</div>
            <button className="command-option" onClick={() => { setConfirmEndTurn(false); onEndTurn() }}>YES</button>
            <button className="command-option" onClick={() => setConfirmEndTurn(false)}>NO</button>
          </div>
        </div>
      )}

      {/* Play Card Modal */}
      {showPlayModal && pendingPlayCard && (
        <PlayCardModal
          card={pendingPlayCard}
          onSummon={() => {
            const cardType = (pendingPlayCard.type || '').toLowerCase()
            const action = cardType === 'spell' || cardType === 'trap'
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
