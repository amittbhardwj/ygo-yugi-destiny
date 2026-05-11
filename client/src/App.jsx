import { useState, useReducer, useCallback, useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import Lobby from './components/Lobby'
import GameBoard from './components/GameBoard'

// Game state reducer
function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload, phase: action.payload.phase }

    case 'SET_PHASE':
      return { ...state, phase: action.payload }

    case 'SET_TURN':
      return { ...state, isYourTurn: action.payload }

    case 'CARD_PLAYED':
      return { ...state, lastAction: { type: 'card_played', card: action.payload } }

    case 'ATTACK':
      return { ...state, lastAction: { type: 'attack', ...action.payload } }

    case 'LP_CHANGE':
      return { ...state, lastAction: { type: 'lp_change', ...action.payload } }

    case 'GAME_OVER':
      return { ...state, gameOver: true, winner: action.payload }

    case 'SET_CONNECTION':
      return { ...state, connectionStatus: action.payload }

    default:
      return state
  }
}

const initialState = {
  gameState: null,
  phase: 'Draw',
  isYourTurn: false,
  selectedMonster: null,
  attackTargets: [],
  lastAction: null,
  gameOver: false,
  winner: null,
  connectionStatus: 'disconnected',
}

export default function App() {
  const [screen, setScreen] = useState('lobby') // 'lobby' or 'game'
  const [roomInfo, setRoomInfo] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')

  const [state, dispatch] = useReducer(gameReducer, initialState)

  const handleGameEvent = useCallback((event, data) => {
    console.log('Game event:', event, data)

    switch (event) {
      case 'connect':
        dispatch({ type: 'SET_CONNECTION', payload: 'connected' })
        break
      case 'disconnect':
        dispatch({ type: 'SET_CONNECTION', payload: 'disconnected' })
        break
      case 'room_created':
        // AI room created - will get game-state next
        break
      case 'joined':
        // Online room joined - wait for game-state to start
        break
      case 'game_state':
        console.log('[App] game_state payload:', JSON.stringify(data.state).substring(0, 500));
        dispatch({ type: 'SET_GAME_STATE', payload: data.state })
        setScreen('game')
        break
      case 'turn_start':
        console.log('[App] turn_start payload:', JSON.stringify(data));
        dispatch({ type: 'SET_TURN', payload: data.player === 'player1' })
        dispatch({ type: 'SET_PHASE', payload: data.phase })
        break
      case 'phase_change':
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
      default:
        break
    }
  }, [])

  const { emit } = useSocket(handleGameEvent, setConnectionStatus)

  // Update connection status based on socket state
  useEffect(() => {
    if (emit) {
      emit('ping', {})
    }
  }, [])

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

  const handlePlayCard = useCallback((cardOrSlot, type) => {
    if (type === 'hand') {
      // Playing from hand - emit card_played event
      emit('play_card', { cardId: cardOrSlot.id, from: 'hand' })
    } else if (type === 'monster') {
      // Playing to field slot
      emit('play_card', { cardId: cardOrSlot, toSlot: type, slotIndex: type === 'monster' ? cardOrSlot : 0 })
    }
  }, [emit])

  const handleSelectMonster = useCallback((index) => {
    if (state.phase === 'Battle' && state.isYourTurn) {
      dispatch({ type: 'SELECT_MONSTER', payload: index })
      // Calculate attack targets (opponent's monsters)
      const targets = []
      const opponentMonsters = state.gameState?.opponent?.field?.monsters || []
      opponentMonsters.forEach((mon, i) => {
        if (mon) targets.push(i)
      })
      dispatch({ type: 'SET_ATTACK_TARGETS', payload: targets })
    }
  }, [state.phase, state.isYourTurn, state.gameState])

  const handleAttackTarget = useCallback((targetIndex) => {
    if (state.selectedMonster !== null) {
      emit('attack', { attackerIndex: state.selectedMonster, targetIndex })
    }
  }, [state.selectedMonster, emit])

  const handleEndPhase = useCallback(() => {
    emit('end_phase', {})
  }, [emit])

  const handleSurrender = useCallback(() => {
    if (confirm('Are you sure you want to surrender?')) {
      emit('surrender', {})
    }
  }, [emit])

  const handlePlayAgain = useCallback(() => {
    dispatch({ type: 'RESET' })
    setScreen('lobby')
    setRoomInfo(null)
  }, [])

  // Connection status managed above

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

  // Show lobby or game
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
          selectedMonster={state.selectedMonster}
          attackTargets={state.attackTargets}
          onPlayCard={handlePlayCard}
          onSelectMonster={handleSelectMonster}
          onAttackTarget={handleAttackTarget}
          onEndPhase={handleEndPhase}
          onSurrender={handleSurrender}
          emit={emit}
        />
      )}
    </div>
  )
}