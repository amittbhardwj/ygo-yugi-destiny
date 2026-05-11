import { useEffect, useRef, useCallback, useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = window.location.origin

export function useSocket(onGameEvent, onConnectionChange) {
  const socketRef = useRef(null)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const s = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      console.log('Connected to server:', s.id)
      onConnectionChange && onConnectionChange('connected')
    })

    s.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)
      onConnectionChange && onConnectionChange('disconnected')
    })

    s.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
      onConnectionChange && onConnectionChange('disconnected')
    })

    // Map server kebab-case events to client snake_case
    const eventMap = {
      'game-state': 'game_state',
      'turn-start': 'turn_start',
      'phase-change': 'phase_change',
      'card-played': 'card_played',
      'attack-executed': 'attack_executed',
      'card-destroyed': 'card_destroyed',
      'lp-change': 'lp_change',
      'game-over': 'game_over',
      'opponent-action': 'opponent_action',
      'opponent-ready': 'opponent_ready',
      'opponent-joined': 'opponent_joined',
      'your-turn': 'your_turn',
      'phase-advance': 'phase_advance',
      'room-created': 'room_created',
      'joined': 'joined',
      'action-result': 'action_result',
      'attack-result': 'attack_result',
      'yugi-action': 'yugi_action',
      'error': 'error',
    }

    Object.keys(eventMap).forEach(serverEvent => {
      s.on(serverEvent, (data) => {
        const clientEvent = eventMap[serverEvent]
        console.log(`[Socket] ${serverEvent} → ${clientEvent}`)
        onGameEvent && onGameEvent(clientEvent, data)
      })
    })

    return () => {
      s.disconnect()
    }
  }, []) // empty deps — onGameEvent is called directly, not via ref

  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log(`[Socket] Emitting: ${event}`, data ? data : '')
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected')
    }
  }, [])

  return { socket, emit }
}