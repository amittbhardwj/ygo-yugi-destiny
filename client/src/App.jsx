import { useState, useReducer, useCallback, useEffect, useRef } from 'react'
// BUILD: abc123xyz
console.log('[BUILD] abc123xyz');
import { useSocket } from './hooks/useSocket'
import Lobby from './components/Lobby'
import GameBoard from './components/GameBoard'

// Map server phase names to client display names
const SERVER_PHASE_MAP = {
  draw: 'Draw',
  standby: 'Standby',
  main1: 'Main 1',
  battle: 'Battle',
  main2: 'Main 2',
  end: 'End',
}

function normalizePhase(phase) {
  return SERVER_PHASE_MAP[phase] || phase
}

// Game state reducer
function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return {
        ...state,
        gameState: action.payload,
        phase: normalizePhase(action.payload.phase),
      }

    case 'SET_RAW_PHASE':
      return { ...state, rawPhase: action.payload }

    case 'SET_PHASE':
      return { ...state, phase: normalizePhase(action.payload) }

    case 'SET_TURN':
      return { ...state, isYourTurn: action.payload }

    case 'CARD_PLAYED':
      return { ...state, lastAction: { type: 'card_played', card: action.payload } }

    case 'ATTACK':
      return { ...state, lastAction: { type: 'attack', ...action.payload } }

    case 'LP_CHANGE':
      return { ...state, lastAction: { type: 'lp_change', ...action.payload } }

    case 'SELECT_MONSTER':
      return { ...state, selectedMonster: action.payload }

    case 'SET_ATTACK_TARGETS':
      return { ...state, attackTargets: action.payload }

    case 'GAME_OVER':
      return { ...state, gameOver: true, winner: action.payload, overlayMessage: null }

    case 'RESET':
      return initialState

    case 'SET_CONNECTION':
      return { ...state, connectionStatus: action.payload }

    case 'SHOW_OVERLAY':
      return { ...state, overlayMessage: action.payload }

    case 'CLEAR_OVERLAY':
      return { ...state, overlayMessage: null }

    case 'SET_DUEL_ANIMATION':
      return { ...state, duelAnimation: action.payload }

    case 'CLEAR_DUEL_ANIMATION':
      return { ...state, duelAnimation: null }

    case 'SET_COIN_FLIP':
      return { ...state, coinFlip: action.payload }

    case 'SET_EXODIA_ANIMATION':
      return { ...state, exodiaAnimation: action.payload }

    case 'CLEAR_EXODIA_ANIMATION':
      return { ...state, exodiaAnimation: null }

    case 'SET_TRAP_PROMPT':
      return { ...state, trapPrompt: action.payload }

    case 'SET_WAITING_FOR_TRAP':
      return { ...state, waitingForTrap: action.payload }

    case 'RESOLVE_TRAP_PROMPT':
      return { ...state, trapPrompt: null, waitingForTrap: false }

    default:
      return state
  }
}


function ExodiaAnimation({ animation }) {
  if (!animation) return null
  const pieces = animation.pieces || []
  const winnerLabel = animation.winnerKey === 'player1' ? 'YOU HAVE ASSEMBLED' : 'YUGI HAS ASSEMBLED'

  return (
    <div className="exodia-overlay" key={animation.id}>
      <div className="exodia-storm" />
      <div className="exodia-rune-ring">𓂀</div>
      <div className="exodia-card-fan">
        {pieces.map((piece, index) => (
          <div className={`exodia-piece exodia-piece-${index}`} key={piece.id}>
            {piece.imgUrl ? <img src={piece.imgUrl} alt={piece.name} /> : <span>{piece.name}</span>}
          </div>
        ))}
      </div>
      <div className="exodia-silhouette">
        <div className="exodia-head" />
        <div className="exodia-torso" />
        <div className="exodia-arm exodia-arm-left" />
        <div className="exodia-arm exodia-arm-right" />
      </div>
      <div className="exodia-title">EXODIA</div>
      <div className="exodia-subtitle">{winnerLabel} THE FORBIDDEN ONE</div>
      <div className="exodia-obliterate">OBLITERATE!</div>
    </div>
  )
}

const initialState = {
  gameState: null,
  phase: 'Draw',
  rawPhase: 'draw',
  isYourTurn: false,
  selectedMonster: null,
  duelAnimation: null,
  coinFlip: null,
  exodiaAnimation: null,
  trapPrompt: null,
  waitingForTrap: false,
}

export default function App() {
  const [screen, setScreen] = useState('lobby') // 'lobby' or 'game'
  const [roomInfo, setRoomInfo] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  // Use ref for playerSlot to avoid stale closures in event handlers
  const playerSlotRef = useRef(null)
  const [playerSlotDisplay, setPlayerSlotDisplay] = useState(null) // For debug display
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const handleGameEvent = useCallback((event, data) => {
    console.log('[HGE] event=', event, 'data=', typeof data === 'object' ? Object.keys(data) : data);
    switch (event) {
      case 'connect':
        dispatch({ type: 'SET_CONNECTION', payload: 'connected' })
        break
      case 'disconnect':
        dispatch({ type: 'SET_CONNECTION', payload: 'disconnected' })
        break
      case 'room_created':
      case 'joined':
        break
      case 'game_state':
        console.log('[HGE] game_state case');
        setScreen('game')
        
        // Detect player slot - we are player1 if our hand has visible (non-hidden) cards
        let slot = null
        if (data.state?.player?.hand && data.state.player.hand.length > 0) {
          const firstCard = data.state.player.hand[0]
          if (firstCard && typeof firstCard === 'object' && !firstCard.hidden) {
            slot = 'player1'
          } else if (firstCard && typeof firstCard === 'object' && firstCard.hidden) {
            slot = 'player2'
          }
        }
        playerSlotRef.current = slot
        setPlayerSlotDisplay(slot)
        console.log('[HGE] playerSlot detected:', slot)
        
        // Set phase from game state
        dispatch({ type: 'SET_PHASE', payload: normalizePhase(data.state?.phase) })
        dispatch({ type: 'SET_GAME_STATE', payload: data.state })
        // Also update phase from game_state.phase directly (keep as server value, not display)
        dispatch({ type: 'SET_RAW_PHASE', payload: data.state?.phase || 'draw' })
        break
        
      case 'coin_flip':
        dispatch({ type: 'SET_COIN_FLIP', payload: data })
        dispatch({ type: 'SET_DUEL_ANIMATION', payload: { kind: 'coin', ...data, id: Date.now() } })
        setTimeout(() => dispatch({ type: 'CLEAR_DUEL_ANIMATION' }), 2200)
        break

      case 'turn_start':
        // Map server events from useSocket
        console.log('[HGE] turn_start:', JSON.stringify(data))
        const isOurTurn2 = data.player === 'player1'
        console.log('[HGE] isOurTurn:', isOurTurn2, 'playerSlot=', playerSlotRef.current, 'turn-data:', JSON.stringify(data))
        dispatch({ type: 'SET_TURN', payload: isOurTurn2 })
        dispatch({ type: 'SET_RAW_PHASE', payload: data.phase })
        dispatch({ type: 'SET_PHASE', payload: data.phase })
        if (isOurTurn2) {
          dispatch({ type: 'SHOW_OVERLAY', payload: { message: 'YOUR TURN', subMessage: normalizePhase(data.phase) } })
          setTimeout(() => dispatch({ type: 'CLEAR_OVERLAY' }), 1500)
        } else {
          dispatch({ type: 'SHOW_OVERLAY', payload: { message: "OPPONENT'S TURN", subMessage: normalizePhase(data.phase) } })
          setTimeout(() => dispatch({ type: 'CLEAR_OVERLAY' }), 1500)
        }
        break
        
      case 'phase_change':
        console.log('[HGE] phase_change:', data.phase)
        dispatch({ type: 'SET_PHASE', payload: data.phase })
        break
        
      case 'opponent_action':
      case 'opponent_ready':
      case 'opponent_joined':
        dispatch({ type: 'SET_TURN', payload: false })
        break
        
      case 'card_played':
        dispatch({ type: 'CARD_PLAYED', payload: data })
        break

      case 'action_result':
        if (data?.success) {
          let msg = data.message || '';
          let displayMsg = msg;
          if (msg.includes('Summoned')) {
            displayMsg = 'SUMMON!';
          } else if (msg.includes('Set')) {
            displayMsg = 'CARD SET';
          } else if (msg.includes('Activated')) {
            if (msg.toLowerCase().includes('trap')) {
              displayMsg = 'TRAP CARD ACTIVATED!';
            } else {
              displayMsg = 'SPELL CARD ACTIVATED!';
            }
          }
          dispatch({ type: 'SET_DUEL_ANIMATION', payload: { kind: 'command', message: displayMsg, id: Date.now() } });
          setTimeout(() => dispatch({ type: 'CLEAR_DUEL_ANIMATION' }), 950);
        }
        break

      case 'yugi_action':
        const act = data?.action || {};
        let yugiMsg = '';
        if (act.type === 'summon') {
          yugiMsg = act.position === 'defense' ? 'CARD SET' : 'SUMMON!';
        } else if (act.type === 'set-trap') {
          yugiMsg = 'CARD SET';
        } else if (act.type === 'spell') {
          yugiMsg = 'SPELL CARD ACTIVATED!';
        } else if (act.type === 'flip') {
          yugiMsg = 'FLIP SUMMON!';
        }
        if (yugiMsg) {
          dispatch({ type: 'SET_DUEL_ANIMATION', payload: { kind: 'command', message: yugiMsg, id: Date.now() } });
          setTimeout(() => dispatch({ type: 'CLEAR_DUEL_ANIMATION' }), 950);
        }
        break

      case 'trap_prompt':
        dispatch({ type: 'SET_TRAP_PROMPT', payload: data });
        break

      case 'waiting_for_trap':
        dispatch({ type: 'SET_WAITING_FOR_TRAP', payload: true });
        break

      case 'trap_prompt_resolved':
        dispatch({ type: 'RESOLVE_TRAP_PROMPT' });
        break

      case 'attack_result':
        dispatch({ type: 'SET_DUEL_ANIMATION', payload: { kind: 'attack', ...data, id: Date.now() } })
        dispatch({ type: 'SELECT_MONSTER', payload: null })
        dispatch({ type: 'SET_ATTACK_TARGETS', payload: [] })
        setTimeout(() => dispatch({ type: 'CLEAR_DUEL_ANIMATION' }), 1300)
        break
        
      case 'attack_executed':
        dispatch({ type: 'ATTACK', payload: data })
        dispatch({ type: 'SELECT_MONSTER', payload: null })
        dispatch({ type: 'SET_ATTACK_TARGETS', payload: [] })
        break
        
      case 'lp_change':
        dispatch({ type: 'LP_CHANGE', payload: data })
        break
        
      case 'game_over':
        if (data?.isExodia) {
          dispatch({ type: 'SET_EXODIA_ANIMATION', payload: { ...data, id: Date.now() } })
          setTimeout(() => {
            dispatch({ type: 'CLEAR_EXODIA_ANIMATION' })
            dispatch({ type: 'GAME_OVER', payload: data })
          }, 5400)
        } else {
          dispatch({ type: 'GAME_OVER', payload: data })
        }
        break
        
      case 'error':
        console.error('[HGE] server error:', data.message)
        dispatch({ type: 'SHOW_OVERLAY', payload: { message: 'ERROR', subMessage: data.message } })
        setTimeout(() => dispatch({ type: 'CLEAR_OVERLAY' }), 2000)
        break
        
        default:
          break
      }
    }, [state.gameState])

  const { emit } = useSocket(handleGameEvent, setConnectionStatus)

  useEffect(() => {
    if (emit) {
      emit('ping', {})
    }
  }, [])

  const handleStartGame = useCallback((config) => {
    setRoomInfo(config)
    if (config.mode === 'yugi') {
      emit('play-vs-ai', { playerName: config.playerName, deckIds: config.deckIds })
    } else if (config.mode === 'online') {
      if (config.action === 'create') {
        emit('create-room', { playerName: config.playerName, roomCode: config.roomCode })
      } else {
        emit('join-room', { playerName: config.playerName, roomCode: config.roomCode })
      }
    }
  }, [emit])

  // handlePlayCard handles different card play types from GameBoard
  const handlePlayCard = useCallback((card, actionType, tributeIds = []) => {
    console.log('[HPC] handlePlayCard', { card: card?.name || card, cardId: card?.cardId, actionType, tributeIds })
    if (actionType === 'summon') {
      emit('play-card', { cardId: card.cardId, position: 'attack', tributeIds })
    } else if (actionType === 'set') {
      // Spell/Trap cards use set-spell-trap; monsters use play-card
      if (card.type === 'monster') {
        emit('play-card', { cardId: card.cardId, position: 'defense', tributeIds })
      } else {
        emit('set-spell-trap', { cardId: card.cardId, faceDown: true })
      }
    } else if (actionType === 'activate') {
      emit('activate-spell', { cardId: card.cardId })
    } else if (actionType === 'activate-trap') {
      emit('activate-trap', { cardId: card.cardId })
    } else if (actionType === 'hand') {
      // Direct from hand - should not happen since GameBoard shows modal first
      emit('play-card', { cardId: card?.cardId || card })
    }
  }, [emit])

  const handleSelectMonster = useCallback((index) => {
    console.log('[handleSelectMonster] index=', index, 'rawPhase=', state.rawPhase, 'isYourTurn=', state.isYourTurn)
    console.log('[handleSelectMonster] gameState=', JSON.stringify(state.gameState)?.slice(0, 500))
    if (index === null) {
      dispatch({ type: 'SELECT_MONSTER', payload: null })
      dispatch({ type: 'SET_ATTACK_TARGETS', payload: [] })
      return
    }
    if (state.rawPhase === 'battle' && state.isYourTurn) {
      dispatch({ type: 'SELECT_MONSTER', payload: index })
      const targets = []
      const opponentMonsters = state.gameState?.opponent?.field?.monsters || []
      console.log('[handleSelectMonster] opponentMonsters=', JSON.stringify(opponentMonsters))
      opponentMonsters.forEach((mon, i) => {
        if (mon) targets.push(i)
      })
      console.log('[handleSelectMonster] computed targets=', targets)
      dispatch({ type: 'SET_ATTACK_TARGETS', payload: targets })
    }
  }, [state.rawPhase, state.isYourTurn, state.gameState?.opponent])

  const handleAttackTarget = useCallback((targetIndex) => {
    console.log('[handleAttackTarget] targetIndex=', targetIndex, 'selectedMonster=', state.selectedMonster);
    if (state.selectedMonster !== null) {
      // Convert index to cardId for server - use findIndex to handle sparse arrays
      const myMonsters = state.gameState?.player?.field?.monsters || [];
      const attacker = myMonsters[state.selectedMonster]
      const attackerId = attacker?.cardId
      
      // The targetIndex is a raw zone index from the sparse opponentMonsters array
      // We need to convert it to a cardId
      const oppMonsters = state.gameState?.opponent?.field?.monsters || []
      const target = oppMonsters[targetIndex]
      const targetId = target?.cardId
      
      console.log('[handleAttackTarget] attackerId=', attackerId, 'targetId=', targetId);
      
      if (attackerId && targetId) {
        emit('attack', { attackerId, targetId })
      }
    }
  }, [state.selectedMonster, state.gameState, emit])

  const handleEndTurn = useCallback(() => {
    if (!state.gameState?.started) return
    console.log('[HET] emitting end-turn')
    emit('end-turn', {})
  }, [state.gameState, emit])

  const handleEndPhase = useCallback(() => {
    if (!state.gameState?.started) return
    console.log('[HEP] emitting end-phase')
    emit('end-phase', {})
  }, [state.gameState, emit])

  const handleSurrender = useCallback(() => {
    if (confirm('Are you sure you want to surrender?')) {
      emit('surrender', {})
    }
  }, [emit])

  const handlePlayAgain = useCallback(() => {
    dispatch({ type: 'RESET' })
    setScreen('lobby')
    setRoomInfo(null)
    playerSlotRef.current = null
    setPlayerSlotDisplay(null)
  }, [])

  // Show game over screen
  if (state.gameOver) {
    const didWin = state.winner?.winnerKey === 'player1'
    return (
      <div className="min-h-screen bg-ygo-dark flex items-center justify-center">
        <ExodiaAnimation animation={state.exodiaAnimation} />
        <div className="text-center">
          <h1 className="text-4xl font-bold text-ygo-gold mb-4">
            {didWin ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <p className="text-gray-300 mb-8">
            {didWin ? 'You won the duel!' : 'You lost the duel.'}
            {state.winner?.reason ? ` ${state.winner.reason}.` : ''}
          </p>
          <button
            onClick={handlePlayAgain}
            className="px-6 py-3 bg-ygo-gold text-ygo-dark font-bold rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <ExodiaAnimation animation={state.exodiaAnimation} />
      {screen === 'lobby' && (
        <Lobby
          onStartGame={handleStartGame}
          connectionStatus={connectionStatus}
        />
      )}

      {screen === 'game' && state.gameState && (
        <GameBoard
          gameState={state.gameState}
          isYourTurn={state.isYourTurn}
          currentPhase={state.phase}
          rawPhase={state.rawPhase}
          selectedMonster={state.selectedMonster}
          attackTargets={state.attackTargets}
          onPlayCard={handlePlayCard}
          onSelectMonster={handleSelectMonster}
          onAttackTarget={handleAttackTarget}
          onEndPhase={handleEndPhase}
          onEndTurn={handleEndTurn}
          onSurrender={handleSurrender}
          emit={emit}
          overlayMessage={state.overlayMessage}
          duelAnimation={state.duelAnimation}
          trapPrompt={state.trapPrompt}
          waitingForTrap={state.waitingForTrap}
        />
      )}
    </div>
  )
}
