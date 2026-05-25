import { useCallback, useMemo, useRef } from 'react'

export function useAudio() {
  const audioCtxRef = useRef(null)

  const initContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass()
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const playDraw = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(400, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }, [])

  const playSummon = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(150, ctx.currentTime)
    osc1.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(300, ctx.currentTime)
    osc2.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.4)

    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    osc1.start(ctx.currentTime)
    osc2.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.4)
    osc2.stop(ctx.currentTime + 0.4)
  }, [])

  const playSet = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.setValueAtTime(80, ctx.currentTime + 0.05)

    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
  }, [])

  const playAttack = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const bufferSize = ctx.sampleRate * 0.25
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(100, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.25)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)

    noiseNode.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    noiseNode.start(ctx.currentTime)
    noiseNode.stop(ctx.currentTime + 0.25)
  }, [])

  const playDamage = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const bufferSize = ctx.sampleRate * 0.4
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1000, ctx.currentTime)
    filter.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    noiseNode.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    noiseNode.start(ctx.currentTime)
    noiseNode.stop(ctx.currentTime + 0.4)
  }, [])

  const playDestroy = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  }, [])

  const playPhase = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.16)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.16)
  }, [])

  const playTrap = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(600, ctx.currentTime)
    osc1.frequency.setValueAtTime(650, ctx.currentTime + 0.1)
    osc1.frequency.setValueAtTime(600, ctx.currentTime + 0.2)
    osc1.frequency.setValueAtTime(650, ctx.currentTime + 0.3)

    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(603, ctx.currentTime)
    osc2.frequency.setValueAtTime(653, ctx.currentTime + 0.1)
    osc2.frequency.setValueAtTime(603, ctx.currentTime + 0.2)
    osc2.frequency.setValueAtTime(653, ctx.currentTime + 0.3)

    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    osc1.start(ctx.currentTime)
    osc2.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.4)
    osc2.stop(ctx.currentTime + 0.4)
  }, [])

  const playFlip = useCallback(() => {
    const ctx = initContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15)

    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }, [])

  return useMemo(() => ({
    playDraw,
    playSummon,
    playSet,
    playAttack,
    playDamage,
    playDestroy,
    playPhase,
    playTrap,
    playFlip,
  }), [playDraw, playSummon, playSet, playAttack, playDamage, playDestroy, playPhase, playTrap, playFlip])
}
