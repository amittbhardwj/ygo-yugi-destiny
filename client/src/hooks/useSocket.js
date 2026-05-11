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