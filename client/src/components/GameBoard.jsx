import { useState, useCallback, useEffect, useRef } from 'react'
import Hand from './Hand'
import Field from './Field'
import CardDetailPanel from './CardDetailPanel'
import PhaseButtons from './PhaseButtons'
import PlayCardModal from './PlayCardModal'
import AttackArrow from './AttackArrow'
import cardImageMap from '../../../server/cardImageMap.json'

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

function LifePointsDisplay({ lp, isPlayer, damage = null }) {
  const lpValue = lp || 0
  const lpString = String(lpValue).padStart(4, '0')
  const digits = lpString.split('')

  return (
    <div className={`lp-wing-frame-poc flex items-center justify-start gap-2 ${isPlayer ? 'lp-player-poc' : 'lp-opponent-poc'} ${damage ? 'damage-flash' : ''}`}>
      <div className="lp-winged-orb relative shrink-0">
        <div className="winged-disc-wings" />
        <div className="winged-disc-orb" />
      </div>
      <div className="flex gap-1 bg-black/30 p-1 border border-[#c6a34a]/30 rounded-md shadow-inner relative">
        {digits.map((digit, i) => (
          <div key={i} className="lp-digit-urn">
            {digit}
          </div>
        ))}
        {damage ? <span className="floating-damage-poc">-{damage}</span> : null}
      </div>
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

function DuelistResource({ label, count, tone = 'neutral', onClick }) {
  return (
    <button
      type="button"
      className={`duel-resource duel-resource-${tone}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="duel-resource-count">{count || 0}</span>
      <span className="duel-resource-label">{label}</span>
    </button>
  )
}

function DeckSidePanel({ cards = [], onCardSelect }) {
  return (
    <div className="mt-3 rounded border border-egyptian-gold/30 bg-black/40 p-2 text-xs max-h-48 overflow-y-auto">
      <div className="text-egyptian-gold font-bold mb-2">YOUR DECK ({cards.length})</div>
      {cards.length === 0 ? (
        <div className="text-gray-500">Deck empty</div>
      ) : (
        <div className="space-y-1">
          {cards.map((card, index) => (
            <button
              key={card.cardId || card.uid || `${card.id}-${index}`}
              type="button"
              className="w-full text-left px-2 py-1 rounded bg-gray-900/60 hover:bg-egyptian-gold/20 text-gray-200 flex justify-between gap-2"
              onMouseEnter={() => onCardSelect(card)}
              onFocus={() => onCardSelect(card)}
              onClick={() => onCardSelect(card)}
              title={card.description || card.name}
            >
              <span className="truncate">{index + 1}. {card.name || 'Unknown card'}</span>
              <span className="text-gray-500 uppercase shrink-0">{card.type || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function findFreshCard(card, gameState) {
  if (!card) return null
  const id = card.cardId || card.uid || card.id
  if (!id) return card

  const zones = []
  for (const side of [gameState?.player, gameState?.opponent]) {
    if (!side) continue
    zones.push(
      side.hand,
      side.deck,
      side.grave,
      side.field?.monsters,
      side.field?.spells,
    )
  }

  for (const zone of zones) {
    const fresh = zone?.find(c => (c?.cardId || c?.uid || c?.id) === id)
    if (fresh) return fresh
  }
  return card
}

function TrapCountdown({ duration, onTimeUp }) {
  const [seconds, setSeconds] = useState(duration)

  useEffect(() => {
    setSeconds(duration)
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (onTimeUp) onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [duration, onTimeUp])

  const percentage = (seconds / duration) * 100

  return (
    <div className="w-full px-4 mb-4" aria-live="polite">
      <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
        <span>Response Time:</span>
        <span className="font-bold text-ygo-gold animate-pulse">{seconds}s</span>
      </div>
      <div className="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden border border-purple-950/40">
        <div 
          className="bg-gradient-to-r from-red-600 via-purple-600 to-ygo-gold h-full transition-all duration-1000 ease-linear" 
          style={{ width: `${percentage}%` }}
        />
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
  duelAnimation = null,
  trapPrompt = null,
  waitingForTrap = false,
}) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [showPlayModal, setShowPlayModal] = useState(false)
  const [pendingPlayCard, setPendingPlayCard] = useState(null)
  const [localOverlay, setLocalOverlay] = useState(null)
  const [confirmEndTurn, setConfirmEndTurn] = useState(false)

  const [showTrapReaction, setShowTrapReaction] = useState(false)
  const lastLogLengthRef = useRef(0)

  // Target selection state
  const [isTargetingMode, setIsTargetingMode] = useState(false)
  const [targetingCard, setTargetingCard] = useState(null)
  const [targetingType, setTargetingType] = useState('') // 'opponent_monster', 'any_monster', 'graveyard'
  const [targetingMessage, setTargetingMessage] = useState('')

  // Graveyard Viewer state
  const [showGraveViewer, setShowGraveViewer] = useState(null) // 'player', 'opponent', or null

  // Tribute selection state
  const [tributeSelection, setTributeSelection] = useState(null) // { card, action, required, selectedIds: [] }

  const { player, opponent } = gameState || {}

  // LP Damage flashing states
  const [prevPlayerLp, setPrevPlayerLp] = useState(player?.lp || 8000)
  const [prevOpponentLp, setPrevOpponentLp] = useState(opponent?.lp || 8000)
  const [playerDamageFlash, setPlayerDamageFlash] = useState(false)
  const [opponentDamageFlash, setOpponentDamageFlash] = useState(false)

  // Mouse tracking for attack arrow
  const [mouseCoords, setMouseCoords] = useState(null)

  const handleMouseMove = useCallback((e) => {
    if (selectedMonster !== null) {
      setMouseCoords({ x: e.clientX, y: e.clientY })
    }
  }, [selectedMonster])

  useEffect(() => {

    if (player?.lp < prevPlayerLp) {
      setPlayerDamageFlash(true)
      const timer = setTimeout(() => setPlayerDamageFlash(false), 1000)
      setPrevPlayerLp(player.lp)
      return () => clearTimeout(timer)
    } else if (player?.lp !== prevPlayerLp) {
      setPrevPlayerLp(player?.lp || 8000)
    }
  }, [player?.lp, prevPlayerLp])

  useEffect(() => {
    if (opponent?.lp < prevOpponentLp) {
      setOpponentDamageFlash(true)
      const timer = setTimeout(() => setOpponentDamageFlash(false), 1000)
      setPrevOpponentLp(opponent.lp)
      return () => clearTimeout(timer)
    } else if (opponent?.lp !== prevOpponentLp) {
      setPrevOpponentLp(opponent?.lp || 8000)
    }
  }, [opponent?.lp, prevOpponentLp])

  const requiresTarget = (card) => {
    if (!card) return false
    const effect = card.effect || ''
    const id = card.id || ''
    return (
      effect === 'special_summon_grave' ||
      effect === 'take_control_opponent_monster' || id === 's4' ||
      effect === 'destroy_monster' || id === 's35'
    )
  }

  const startTargeting = (card) => {
    setIsTargetingMode(true)
    setTargetingCard(card)
    const effect = card.effect || ''
    const id = card.id || ''
    if (effect === 'special_summon_grave') {
      setTargetingType('graveyard')
      setTargetingMessage('Select a monster in either Graveyard to Special Summon.')
      setShowGraveViewer('player')
    } else if (effect === 'take_control_opponent_monster' || id === 's4') {
      setTargetingType('opponent_monster')
      setTargetingMessage("Select an opponent's monster to take control of.")
    } else {
      setTargetingType('any_monster')
      setTargetingMessage('Select a monster on the field to destroy.')
    }
  }

  const handleTargetSelected = (targetCard) => {
    if (!isTargetingMode || !targetingCard) return
    emit('activate-spell', { cardId: targetingCard.cardId, targetId: targetCard.cardId })
    setIsTargetingMode(false)
    setTargetingCard(null)
    setShowGraveViewer(null)
  }

  useEffect(() => {
    if (gameState?.log?.length > lastLogLengthRef.current) {
      const newLogs = gameState.log.slice(lastLogLengthRef.current)
      lastLogLengthRef.current = gameState.log.length
      
      if (newLogs.some(l => l.includes(' activated!'))) {
        setShowTrapReaction(true)
        setTimeout(() => setShowTrapReaction(false), 2000)
      }
    }
  }, [gameState?.log])
  // Merge local overlay with parent-provided overlay (parent wins for turn announcements)
  const overlay = overlayMessage || localOverlay

  if (!gameState) return null

  const detailCard = findFreshCard(hoveredCard, gameState)
  const normalizedPhase = normalizePhase(currentPhase)
  const isAttackAnimation = duelAnimation?.kind === 'attack'
  const opponentDamage = isAttackAnimation && duelAnimation.damage > 0 ? duelAnimation.damage : null

  const handleCardHover = useCallback((card) => {
    setHoveredCard(card)
  }, [])

  // Use server phase (rawPhase) for playability checks to avoid double-normalization issues
  const canPlayCard = isYourTurn && (rawPhase === 'main1' || rawPhase === 'main2')
  const canBattle = isYourTurn && rawPhase === 'battle'
  const turnLabel = isYourTurn ? 'Your Turn' : "Yugi's Turn"

  const handleMonsterClick = (card, index) => {
    setHoveredCard(card)
    if (tributeSelection) {
      const isSelected = tributeSelection.selectedIds.includes(card.cardId)
      let newSelectedIds = [...tributeSelection.selectedIds]
      if (isSelected) {
        newSelectedIds = newSelectedIds.filter(id => id !== card.cardId)
      } else {
        newSelectedIds.push(card.cardId)
      }

      if (newSelectedIds.length === tributeSelection.required) {
        onPlayCard(tributeSelection.card, tributeSelection.action, newSelectedIds)
        setTributeSelection(null)
      } else {
        setTributeSelection({
          ...tributeSelection,
          selectedIds: newSelectedIds
        })
      }
      return
    }
    if (isTargetingMode) {
      if (targetingType === 'any_monster') {
        handleTargetSelected(card)
      }
      return
    }
    if (canBattle && selectedMonster === null) {
      onSelectMonster(index)
    } else if (canBattle && selectedMonster !== null) {
      if (selectedMonster === index && attackTargets.length > 0) {
        onSelectMonster(null)
        return
      }
      if (selectedMonster !== index && !attackTargets.includes(index)) {
        onSelectMonster(index)
        return
      }
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

  const handleSpellClick = (card) => {
    setHoveredCard(card)
    if (isTargetingMode) {
      if (targetingType === 'any_monster') {
        handleTargetSelected(card)
      }
      return
    }
    if (!isYourTurn) return
    const type = (card?.type || '').toLowerCase()
    if (type === 'spell' && canPlayCard) {
      if (requiresTarget(card)) {
        startTargeting(card)
      } else {
        onPlayCard(card, 'activate')
      }
    } else if (type === 'trap') {
      onPlayCard(card, 'activate-trap')
    }
  }

  return (
    <div className={`game-board-root ${selectedMonster !== null && canBattle ? 'cursor-crosshair' : ''}`} onMouseMove={handleMouseMove}>
      <YugiGuide phase={rawPhase} isYourTurn={isYourTurn} />
      
      {/* Left Panel - Card Detail & LP */}
      <div className="left-panel flex flex-col justify-between h-full py-2 z-10 shrink-0">
        <LifePointsDisplay 
          lp={opponent.lp} 
          isPlayer={false} 
          damage={opponentDamageFlash ? (prevOpponentLp - opponent.lp) : null} 
        />
        
        <CardDetailPanel card={detailCard} />
        
        <LifePointsDisplay 
          lp={player.lp} 
          isPlayer={true} 
          damage={playerDamageFlash ? (prevPlayerLp - player.lp) : null} 
        />
      </div>

      {/* Column 2: LP & Phase Column (vertical stack of LP and Phase selector) */}
      <div className="lp-phase-column flex flex-col justify-center items-center py-2 self-stretch w-[70px] shrink-0 z-10">
        <div className="phase-column flex flex-col items-center justify-center p-1 w-full">
          <div className="phase-title mb-2 text-[10px] tracking-wider uppercase font-bold text-[#c6a34a]">Phase</div>
          <PhaseButtons
            currentPhase={rawPhase}
            isYourTurn={isYourTurn}
            onEndPhase={handleEndPhaseClick}
          />
          <div className="action-buttons mt-3 flex flex-col gap-1.5 w-full items-center">
            <button
              onClick={handleEndPhaseClick}
              disabled={!isYourTurn}
              className="phase-action-btn"
              title="Advance to next phase"
            >
              NEXT
            </button>
            <button
              onClick={() => setConfirmEndTurn(true)}
              disabled={!isYourTurn}
              className="phase-action-btn"
              title="End your turn"
            >
              END
            </button>
          </div>
        </div>
      </div>

      {/* Column 3: Main Field Area */}
      <div className="main-field flex flex-col justify-between flex-1">
        <div className="field-watermark">𓂀</div>

        {isTargetingMode && (
          <div className="bg-red-950/90 border-b border-ygo-gold text-white p-3 text-center flex justify-between items-center z-40 relative animate-pulse">
            <div className="flex items-center gap-2 justify-center w-full relative">
              <span className="text-yellow-400 text-xl">🔺</span>
              <span className="font-bold text-sm tracking-wide">{targetingMessage}</span>
              <button
                onClick={() => {
                  setIsTargetingMode(false)
                  setTargetingCard(null)
                  setShowGraveViewer(null)
                }}
                className="absolute right-0 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-xs font-extrabold uppercase rounded border border-red-500 transition-colors cursor-pointer"
              >
                Cancel Target
              </button>
            </div>
          </div>
        )}

        {tributeSelection && (
          <div className="bg-amber-950/95 border-b border-ygo-gold text-white p-3 text-center flex justify-between items-center z-40 relative animate-pulse">
            <div className="flex items-center gap-2 justify-center w-full relative">
              <span className="text-yellow-400 text-xl">🔱</span>
              <span className="font-bold text-sm tracking-wide">
                Select {tributeSelection.required - tributeSelection.selectedIds.length} monster(s) on your field to tribute for {tributeSelection.card.name}.
              </span>
              <button
                onClick={() => {
                  setTributeSelection(null)
                }}
                className="absolute right-0 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-xs font-extrabold uppercase rounded border border-red-500 transition-colors cursor-pointer"
              >
                Cancel Summon
              </button>
            </div>
          </div>
        )}

        {/* Opponent Hand */}
        <div className="opponent-hand-area">
          <div className="hand-label">OPPONENT'S HAND</div>
          <Hand cards={opponent.hand || []} isOpponent={true} onHover={handleCardHover} />
        </div>

        <div className="flex gap-4 items-stretch justify-center relative mt-1 mb-1">
          {/* Unified Duel Board Mat */}
          <div className="flex-grow unified-field-mat field-egyptian relative">
            {/* Side Zones (Deck / Graveyard / Extra) placed relative to this mat */}
            
            {/* Opponent Deck (Top Left) */}
            <div className="field-side-zone opponent-deck-zone">
              {opponent.deckCount > 0 ? (
                <img
                  src="https://images.ygoprodeck.com/images/cards/back_high.jpg"
                  alt="Opponent Deck"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>DECK</span>
              )}
              {opponent.deckCount > 0 && (
                <div className="field-zone-count-badge">{opponent.deckCount}</div>
              )}
            </div>

            {/* Opponent Graveyard (Middle Left) */}
            <div 
              className="field-side-zone opponent-grave-zone" 
              onClick={() => setShowGraveViewer('opponent')}
            >
              {opponent.grave && opponent.grave.length > 0 ? (
                <img
                  src={cardImageMap[opponent.grave[opponent.grave.length - 1].id] || opponent.grave[opponent.grave.length - 1].imgUrl}
                  alt="Opponent Graveyard"
                  className="w-full h-full object-cover"
                  onMouseEnter={() => handleCardHover(opponent.grave[opponent.grave.length - 1])}
                />
              ) : (
                <span>GRAVE</span>
              )}
              {opponent.grave && opponent.grave.length > 0 && (
                <div className="field-zone-count-badge">{opponent.grave.length}</div>
              )}
            </div>

            {/* Player Extra/Fusion Deck placeholder (Bottom Left) */}
            <div className="field-side-zone player-fusion-zone">
              <span>FUSION</span>
            </div>

            {/* Opponent Extra/Fusion Deck placeholder (Top Right) */}
            <div className="field-side-zone opponent-fusion-zone">
              <span>FUSION</span>
            </div>

            {/* Player Graveyard (Middle Right) */}
            <div 
              className="field-side-zone player-grave-zone" 
              onClick={() => setShowGraveViewer('player')}
            >
              {player.grave && player.grave.length > 0 ? (
                <img
                  src={cardImageMap[player.grave[player.grave.length - 1].id] || player.grave[player.grave.length - 1].imgUrl}
                  alt="Player Graveyard"
                  className="w-full h-full object-cover"
                  onMouseEnter={() => handleCardHover(player.grave[player.grave.length - 1])}
                />
              ) : (
                <span>GRAVE</span>
              )}
              {player.grave && player.grave.length > 0 && (
                <div className="field-zone-count-badge">{player.grave.length}</div>
              )}
            </div>

            {/* Player Deck (Bottom Right) */}
            <div className="field-side-zone player-deck-zone">
              {player.deckCount > 0 ? (
                <img
                  src="https://images.ygoprodeck.com/images/cards/back_high.jpg"
                  alt="Player Deck"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>DECK</span>
              )}
              {player.deckCount > 0 && (
                <div className="field-zone-count-badge">{player.deckCount}</div>
              )}
            </div>

            {/* Opponent Field Grid */}
            <Field
              monsters={opponent.field?.monsters || []}
              spells={opponent.field?.spells || []}
              isOpponent={true}
              attackTargets={attackTargets}
              selectable={isTargetingMode}
              onMonsterClick={(card, index) => {
                if (isTargetingMode) {
                  if (targetingType === 'opponent_monster' || targetingType === 'any_monster') {
                    handleTargetSelected(card)
                  }
                } else if (canBattle && selectedMonster !== null && attackTargets.includes(index)) {
                  onAttackTarget(index)
                }
              }}
              onSpellClick={(card, index) => {
                if (isTargetingMode && targetingType === 'any_monster') {
                  handleTargetSelected(card)
                }
              }}
              onCardHover={handleCardHover}
              duelAnimation={duelAnimation}
            />

            {/* Central Divider Mat Line with Millennium Eye watermark */}
            <div className="field-center-divider">
              <div className="field-center-line" />
              <div className="field-center-eye">𓂀</div>
              <div className="field-center-line" />
            </div>

            {/* Player Field Grid */}
            <Field
              monsters={player.field?.monsters || []}
              spells={player.field?.spells || []}
              isOpponent={false}
              selectedMonster={selectedMonster}
              attackTargets={attackTargets}
              selectable={canPlayCard || canBattle || isTargetingMode || !!tributeSelection}
              onMonsterClick={handleMonsterClick}
              onSpellClick={handleSpellClick}
              onEmptySlotClick={() => {}}
              onCardHover={handleCardHover}
              duelAnimation={duelAnimation}
              tributeSelectedIds={tributeSelection ? tributeSelection.selectedIds : []}
            />
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
            if (cardType === 'monster') {
              const level = pendingPlayCard.level || 0
              const requiredTributes = level >= 7 ? 2 : (level >= 5 ? 1 : 0)
              if (requiredTributes > 0) {
                const playerMonsters = player.field.monsters.filter(Boolean)
                if (playerMonsters.length < requiredTributes) {
                  alert(`Not enough monsters on the field to tribute for ${pendingPlayCard.name}! (Requires ${requiredTributes})`)
                  setShowPlayModal(false)
                  setPendingPlayCard(null)
                  return
                }
                setTributeSelection({
                  card: pendingPlayCard,
                  action: 'summon',
                  required: requiredTributes,
                  selectedIds: []
                })
                setShowPlayModal(false)
                setPendingPlayCard(null)
                return
              }
            }
            if (cardType === 'spell' && requiresTarget(pendingPlayCard)) {
              startTargeting(pendingPlayCard)
              setShowPlayModal(false)
              setPendingPlayCard(null)
              return
            }
            const action = cardType === 'spell' || cardType === 'trap'
              ? 'activate'
              : 'summon'
            onPlayCard(pendingPlayCard, action)
            setShowPlayModal(false)
            setPendingPlayCard(null)
          }}
          onSet={() => {
            const cardType = (pendingPlayCard.type || '').toLowerCase()
            if (cardType === 'monster') {
              const level = pendingPlayCard.level || 0
              const requiredTributes = level >= 7 ? 2 : (level >= 5 ? 1 : 0)
              if (requiredTributes > 0) {
                const playerMonsters = player.field.monsters.filter(Boolean)
                if (playerMonsters.length < requiredTributes) {
                  alert(`Not enough monsters on the field to tribute for ${pendingPlayCard.name}! (Requires ${requiredTributes})`)
                  setShowPlayModal(false)
                  setPendingPlayCard(null)
                  return
                }
                setTributeSelection({
                  card: pendingPlayCard,
                  action: 'set',
                  required: requiredTributes,
                  selectedIds: []
                })
                setShowPlayModal(false)
                setPendingPlayCard(null)
                return
              }
            }
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

      {/* Character Reaction Cut-in */}
      {showTrapReaction && (
        <div className="reaction-cut-in-overlay">
          <div className="reaction-cut-in yugi-themed-cut-in flex items-center justify-center">
            <div className="yugi-cut-in-puzzle animate-pulse">𓂀</div>
            <div className="yugi-cut-in-content">
              <div className="yugi-cut-in-title">TRAP ACTIVATED!</div>
              <div className="yugi-cut-in-subtitle">"Not so fast! I activate my Trap!"</div>
            </div>
          </div>
        </div>
      )}

      {/* Graveyard Viewer Modal */}
      {showGraveViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="bg-ygo-dark border-2 border-ygo-gold rounded-xl p-6 shadow-2xl w-[90%] max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-egyptian-gold/30 pb-2">
              <h3 className="text-ygo-gold font-bold text-xl uppercase">
                {showGraveViewer === 'player' ? 'Your Graveyard' : "Opponent's Graveyard"} ({
                  (showGraveViewer === 'player' ? player.grave : opponent.grave)?.length || 0
                } cards)
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowGraveViewer(showGraveViewer === 'player' ? 'opponent' : 'player')}
                  className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-ygo-gold font-bold border border-ygo-gold rounded text-xs transition-colors"
                >
                  Switch to {showGraveViewer === 'player' ? "Opponent's" : "Your"} Grave
                </button>
                <button
                  onClick={() => setShowGraveViewer(null)}
                  className="text-gray-400 hover:text-white font-bold text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {isTargetingMode && targetingType === 'graveyard' && (
              <div className="bg-amber-950/80 text-yellow-300 p-2.5 rounded text-sm text-center mb-4 border border-yellow-600/50">
                🔺 <strong>Target Selection Mode:</strong> Click any monster in either graveyard to Special Summon it.
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 bg-black/40 rounded border border-gray-800/80">
              {((showGraveViewer === 'player' ? player.grave : opponent.grave) || []).length === 0 ? (
                <div className="text-gray-500 text-center py-12">No cards in Graveyard</div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 justify-items-center">
                  {((showGraveViewer === 'player' ? player.grave : opponent.grave) || []).map((card, idx) => {
                    const isMonster = (card.type || '').toLowerCase() === 'monster'
                    const isSelectableTarget = isTargetingMode && targetingType === 'graveyard' && isMonster

                    return (
                      <div
                        key={card.cardId || card.uid || idx}
                        className={`flex flex-col items-center p-1 rounded transition-all ${
                          isSelectableTarget ? 'cursor-pointer scale-100 hover:scale-105 border border-yellow-500 bg-yellow-500/10' : ''
                        }`}
                        onClick={() => {
                          if (isSelectableTarget) {
                            handleTargetSelected(card)
                          }
                        }}
                      >
                        <Card
                          card={card}
                          faceDown={false}
                          size="hand"
                          onHover={handleCardHover}
                        />
                        <span className="text-[10px] text-gray-400 mt-1 truncate w-16 text-center" title={card.name}>{card.name}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGraveViewer(null)}
              className="mt-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Trap Activation Prompt Modal */}
      {trapPrompt && (
        <div className="command-overlay z-50">
          <div className="command-window min-w-[320px] max-w-[450px]">
            <div className="command-title text-ygo-gold tracking-widest font-extrabold animate-pulse">
              {trapPrompt.event === 'counter-trap' ? 'COUNTER TRAP?' : 'ACTIVATE TRAP?'}
            </div>
            <div className="text-gray-300 text-xs text-center px-4 mb-4 leading-relaxed">
              {trapPrompt.event === 'counter-trap'
                ? `Opponent is activating ${trapPrompt.triggerCard?.name || 'a Trap'}! Choose a Counter-Trap to negate it:`
                : 'Your opponent declared an attack or summon! Choose a Trap Card to activate in response:'
              }
            </div>

            {trapPrompt.timeout && (
              <TrapCountdown duration={trapPrompt.timeout} />
            )}

            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto px-2 mb-4">
              {trapPrompt.traps.map(trap => (
                <button
                  key={trap.cardId}
                  className="command-option text-left px-4 py-3 bg-purple-950/80 hover:bg-purple-900 border border-purple-500 hover:border-ygo-gold text-white font-bold rounded flex flex-col gap-1 transition-all"
                  onClick={() => {
                    emit('resolve-trap-prompt', { activate: true, cardId: trap.cardId })
                  }}
                >
                  <span className="text-ygo-gold text-sm">🔮 {trap.name}</span>
                  <span className="text-gray-400 text-[10px] font-normal leading-tight">{trap.description}</span>
                </button>
              ))}
            </div>
            <button
              className="command-option w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-semibold transition-colors cursor-pointer"
              onClick={() => {
                emit('resolve-trap-prompt', { activate: false })
              }}
            >
              PASS (Cancel)
            </button>
          </div>
        </div>
      )}

      {/* Waiting for Opponent response overlay */}
      {waitingForTrap && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-ygo-dark/95 border-2 border-ygo-gold p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-pulse">
            <div className="w-10 h-10 border-4 border-ygo-gold border-t-transparent rounded-full animate-spin"></div>
            <span className="text-ygo-gold font-bold text-sm tracking-wide">Waiting for opponent response...</span>
          </div>
        </div>
      )}

      {/* Attack Targeting Arrow Overlay */}
      {selectedMonster !== null && mouseCoords && canBattle && (
        <AttackArrow
          startElementId={`player-monster-zone-${selectedMonster}`}
          endCoords={mouseCoords}
        />
      )}
    </div>
  )
}
