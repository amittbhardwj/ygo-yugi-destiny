import { useEffect, useRef, useCallback, useState } from 'react'
import { io } from 'socket.io-client'
import { useAudio } from './useAudio'

const SOCKET_URL = (window.__SOCKET_URL__ || window.location.origin)

export function useSocket(onGameEvent, onConnectionChange) {
  const socketRef = useRef(null)
  const [socket, setSocket] = useState(null)
  const audio = useAudio()

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
      'coin-flip': 'coin_flip',
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
      'trap-prompt': 'trap_prompt',
      'waiting-for-trap': 'waiting_for_trap',
      'trap-prompt-resolved': 'trap_prompt_resolved',
    }

    Object.keys(eventMap).forEach(serverEvent => {
      s.on(serverEvent, (data) => {
        const clientEvent = eventMap[serverEvent]
        console.log(`[Socket] ${serverEvent} → ${clientEvent}`)

        try {
          if (serverEvent === 'turn-start') {
            if (data?.phase === 'draw') {
              audio.playDraw()
            } else {
              audio.playPhase()
            }
          } else if (serverEvent === 'phase-change') {
            audio.playPhase()
          } else if (serverEvent === 'action-result') {
            if (data?.success) {
              const msg = data.message || ''
              if (msg.includes('Summoned')) {
                if (msg.toLowerCase().includes('trap')) {
                  audio.playTrap()
                } else {
                  audio.playSummon()
                }
              } else if (msg.includes('Set')) {
                audio.playSet()
              } else if (msg.includes('Activated')) {
                if (msg.toLowerCase().includes('trap')) {
                  audio.playTrap()
                } else {
                  audio.playSummon()
                }
              }
            }
          } else if (serverEvent === 'attack-result') {
            audio.playAttack()
            if (data?.damage > 0) {
              setTimeout(() => audio.playDamage(), 400)
            }
            if (data?.destroyed && data.destroyed.length > 0) {
              setTimeout(() => audio.playDestroy(), 600)
            }
          } else if (serverEvent === 'card-destroyed') {
            audio.playDestroy()
          } else if (serverEvent === 'lp-change') {
            audio.playDamage()
          } else if (serverEvent === 'yugi-action') {
            const act = data?.action || {}
            if (act.type === 'summon') {
              if (act.position === 'attack') {
                audio.playSummon()
              } else {
                audio.playSet()
              }
            } else if (act.type === 'set-trap') {
              audio.playSet()
            } else if (act.type === 'spell') {
              audio.playSummon()
            } else if (act.type === 'flip') {
              audio.playFlip()
            } else if (act.type === 'attack' || act.type === 'direct-attack') {
              audio.playAttack()
            } else if (act.type === 'end-phase') {
              audio.playPhase()
            }
          } else if (serverEvent === 'trap-prompt') {
            audio.playTrap()
          }
        } catch (err) {
          console.warn('[useSocket] Audio play error:', err)
        }

        onGameEvent && onGameEvent(clientEvent, data)
      })
    })

    return () => {
      s.disconnect()
    }
  }, [audio]) // dependency on audio is fine since audio is a stable reference // empty deps — onGameEvent is called directly, not via ref

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
