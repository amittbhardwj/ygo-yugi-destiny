import { io } from 'socket.io-client'
const s = io('https://ygo-yugi-destiny-production.up.railway.app', { forceNode: true, reconnectionAttempts: 2 })
const events = []
const start = Date.now()

s.on('connect', () => s.emit('play-vs-ai', { playerName: 'Boss' }))
s.on('turn-start', d => { events.push({ t: Date.now()-start, type: 'TS', p: d.player, ph: d.phase, turn: d.turn }) })
s.on('game-state', ({ state }) => { if (state) events.push({ t: Date.now()-start, type: 'GS', cp: state.currentPlayer, ph: state.phase, turn: state.turn, p1lp: state.players?.player1?.lp, p2lp: state.players?.player2?.lp }) })
s.on('yugi-action', d => events.push({ t: Date.now()-start, type: 'YA', a: d.action?.type }))
s.on('yugi-thinking', () => events.push({ t: Date.now()-start, type: 'YTHINK' }))
s.on('error', e => events.push({ t: Date.now()-start, type: 'ERR', msg: e.message }))

// Wait for player turn in main1, then summon + end turn to trigger AI
s.on('turn-start', function h(d) {
  if (d.player === 'player1' && d.ph === 'main1') {
    s.off('turn-start', h)
    // Summon a monster
    s.emit('play-card', { cardId: '__PLAYER_HAND_0__', position: 'attack' })
    setTimeout(() => {
      // Click end-turn (cycles remaining phases then advances to trigger AI)
      s.emit('end-turn', {})
    }, 500)
  }
})

setTimeout(() => {
  events.sort((a,b) => a.t - b.t)
  events.forEach(e => {
    const ts = e.t + 'ms'
    if (e.type === 'TS') console.log(ts, 'TS', e.p, e.ph, 'turn='+e.turn)
    else if (e.type === 'GS') console.log(ts, 'GS', 'cp='+e.cp, 'ph='+e.ph, 'turn='+e.turn, 'p1lp='+e.p1lp, 'p2lp='+e.p2lp)
    else if (e.type === 'YA') console.log(ts, 'YA', e.a)
    else if (e.type === 'YTHINK') console.log(ts, 'YTHINK')
    else if (e.type === 'ERR') console.log(ts, 'ERR', e.msg)
  })
  s.disconnect(); process.exit(0)
}, 25000)