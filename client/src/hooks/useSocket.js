import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:3000'

export function useSocket(onGameEvent) {
  const socketRef = useRef(null)
  const onGameEventRef = useRef(onGameEvent)

  // Keep callback ref updated
  useEffect(() => {
    onGameEventRef.current = onGameEvent
  }, [onGameEvent])

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
    })

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
    })

    // Game events
    const gameEvents = [
      'game_start',
      'game_state',
      'phase_change',
      'turn_start',
      'card_played',
      'attack_executed',
      'card_destroyed',
      'lp_change',
      'game_over',
      'opponent_action',
      'your_turn',
      'phase_advance',
    ]

    gameEvents.forEach((event) => {
      socket.on(event, (data) => {
        if (onGameEventRef.current) {
          onGameEventRef.current(event, data)
        }
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected')
    }
  }, [])

  return { socket: socketRef.current, emit }
}