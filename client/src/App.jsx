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

    case 'SET_CONNECTION':
      return { ...state, connectionStatus: action.payload }

    case 'SHOW_OVERLAY':
      return { ...state, overlayMessage: action.payload }

    case 'CLEAR_OVERLAY':
      return { ...state, overlayMessage: null }

    default:
      return state
  }
}

const initialState = {
  gameState: null,
  phase: 'Draw',
  rawPhase: 'draw',
  isYourTurn: false,
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
        
      case 'attack_executed':
        dispatch({ type: 'ATTACK', payload: data })
        dispatch({ type: 'SELECT_MONSTER', payload: null })
        dispatch({ type: 'SET_ATTACK_TARGETS', payload: [] })
        break
        
      case 'lp_change':
        dispatch({ type: 'LP_CHANGE', payload: data })
        break
        
      case 'game_over':
        dispatch({ type: 'GAME_OVER', payload: data.winner })
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

  // Auto-advance from Standby Phase to Main Phase 1 after 3 seconds
  useEffect(() => {
    let timer;
    if (state.isYourTurn && state.phase === 'Standby') {
      timer = setTimeout(() => {
        emit('end-phase', {})
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [state.isYourTurn, state.phase, emit])

  const handleStartGame = useCallback((config) => {
    setRoomInfo(config)
    if (config.mode === 'yugi') {
      emit('play-vs-ai', { playerName: config.playerName })
    } else if (config.mode === 'online') {
      if (config.action === 'create') {
        emit('create-room', { playerName: config.playerName, roomCode: config.roomCode })
      } else {
        emit('join-room', { playerName: config.playerName, roomCode: config.roomCode })
      }
    }
  }, [emit])

  // handlePlayCard handles different card play types from GameBoard
  const handlePlayCard = useCallback((card, actionType) => {
    console.log('[HPC] handlePlayCard', { card: card?.name || card, cardId: card?.cardId, actionType })
    if (actionType === 'summon') {
      emit('play-card', { cardId: card.cardId, position: 'attack' })
    } else if (actionType === 'set') {
      // Spell/Trap cards use set-spell-trap; monsters use play-card
      if (card.type === 'monster') {
        emit('play-card', { cardId: card.cardId, position: 'defense' })
      } else {
        emit('set-spell-trap', { cardId: card.cardId, faceDown: true })
      }
    } else if (actionType === 'activate') {
      emit('play-card', { cardId: card.cardId, position: 'open' })
    } else if (actionType === 'hand') {
      // Direct from hand - should not happen since GameBoard shows modal first
      emit('play-card', { cardId: card?.cardId || card })
    }
  }, [emit])

  const handleSelectMonster = useCallback((index) => {
    if (state.rawPhase === 'battle' && state.isYourTurn) {
      dispatch({ type: 'SELECT_MONSTER', payload: index })
      const targets = []
      const opponentMonsters = state.gameState?.opponent?.field?.monsters || []
      opponentMonsters.forEach((mon, i) => {
        if (mon) targets.push(i)
      })
      dispatch({ type: 'SET_ATTACK_TARGETS', payload: targets })
    }
  }, [state.rawPhase, state.isYourTurn, state.gameState?.opponent])

  const handleAttackTarget = useCallback((targetIndex) => {
    if (state.selectedMonster !== null) {
      // Convert index to cardId for server
      const myMonsters = state.gameState?.player?.field?.monsters || []
      const myMonstersList = myMonsters.filter(m => m)
      const attacker = myMonstersList[state.selectedMonster]
      const attackerId = attacker?.cardId

      const oppMonsters = state.gameState?.opponent?.field?.monsters || []
      const oppMonstersList = oppMonsters.filter(m => m)
      const targetId = oppMonstersList[targetIndex]?.cardId

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
    return (
      <div className="min-h-screen bg-ygo-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-ygo-gold mb-4">
            {state.winner === 'player' ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <p className="text-gray-300 mb-8">
            {state.winner === 'player' ? 'You won the duel!' : 'You lost the duel.'}
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
        />
      )}
    </div>
  )
}