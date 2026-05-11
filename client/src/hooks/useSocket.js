import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = window.location.origin

export function useSocket(onGameEvent, onConnectionChange) {
  const socketRef = useRef(null)
  const onGameEventRef = useRef(onGameEvent)
  const onConnectionChangeRef = useRef(onConnectionChange)

  // Keep callback refs updated
  useEffect(() => {
    onGameEventRef.current = onGameEvent
    onConnectionChangeRef.current = onConnectionChange
  }, [onGameEvent, onConnectionChange])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      if (onConnectionChangeRef.current) onConnectionChangeRef.current('connected')
    })

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)
      if (onConnectionChangeRef.current) onConnectionChangeRef.current('disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
      if (onConnectionChangeRef.current) onConnectionChangeRef.current('disconnected')
    })

    // Game events - server emits kebab-case, client sends snake_case
    // Map both naming conventions
    const eventMap = {
      // Server → Client event names
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

    // Listen for all server-emitted events and normalize to snake_case
    Object.keys(eventMap).forEach(serverEvent => {
      socket.on(serverEvent, (data) => {
        const clientEvent = eventMap[serverEvent]
        console.log(`[Socket] Received: ${serverEvent} → ${clientEvent}`, data ? '' : '(no data)')
        if (onGameEventRef.current) {
          onGameEventRef.current(clientEvent, data)
        }
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log(`[Socket] Emitting: ${event}`, data ? data : '')
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected')
    }
  }, [])

  return { socket: socketRef.current, emit }
}