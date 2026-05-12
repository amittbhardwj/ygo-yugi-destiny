import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3001';
const socket = io(SERVER);

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let currentState = null;
let step = 0;

socket.on('connect', async () => {
  console.log('[CONNECTED]');
  
  socket.on('game-state', ({ state }) => {
    currentState = state;
    step++;
    console.log(`[gs#${step}] T${state.turn} ${state.phase} ${state.currentPlayer} | p1LP:${state.player.lp} | p1m:[${state.player.field?.monsters?.map(m=>m?.name||'empty')}] | p1s:[${state.player.field?.spells?.map(s=>s?.name||'empty')}]`);
  });
  
  socket.on('action-result', ({ message }) => console.log('[AR]', message));
  socket.on('turn-start', ({ player, phase, turn }) => console.log('[TS]', player, phase, 'T'+turn));
  socket.on('error', ({ message }) => console.log('[ERR]', message));
  socket.on('yugi-action', ({ action }) => console.log('[YA]', JSON.stringify(action)));
  socket.on('attack-result', (data) => console.log('[ATK]', JSON.stringify(data)));
  socket.on('game-over', ({ winner, reason }) => console.log('[OVER] Winner:', winner, reason));
  
  // Start game
  socket.emit('play-vs-ai', { playerName: 'Amitt' });
  await wait(2000);
  
  if (!currentState) {
    console.log('[FAIL] No game-state');
    socket.disconnect();
    return;
  }
  
  console.log('\n=== PHASE FLOW ===');
  
  // [1] Wait for main1
  console.log('[1] Waiting for main1...');
  while (currentState.phase !== 'main1') {
    socket.emit('end-phase');
    await wait(500);
  }
  console.log('  -> In main1 ✓');
  console.log('  Hand:', currentState.player.hand.map(c=>c.name));
  
  // [2] Summon monster
  const monster = currentState.player.hand.find(c => c.type === 'monster');
  if (!monster) {
    console.log('[FAIL] No monster!');
    socket.disconnect();
    return;
  }
  
  console.log('\n[2] play-card:', monster.name, monster.cardId);
  socket.emit('play-card', { cardId: monster.cardId, position: 'attack' });
  await wait(1000);
  console.log('  Field monsters:', currentState.player.field?.monsters?.map(m=>m?.name));
  
  // [3] Set spell/trap
  const spellCard = currentState.player.hand.find(c => c.type === 'spell' || c.type === 'trap');
  if (spellCard) {
    console.log('\n[3] set-spell-trap:', spellCard.name);
    socket.emit('set-spell-trap', { cardId: spellCard.cardId, faceDown: true });
    await wait(500);
    console.log('  Field spells:', currentState.player.field?.spells?.map(s=>s?.name));
  } else {
    console.log('\n[3] No spell/trap');
  }
  
  // [4] Advance to battle phase
  console.log('\n[4] end-phase to advance phases');
  socket.emit('end-phase');
  await wait(1000);
  console.log('  Phase:', currentState.phase);
  
  if (currentState.phase === 'main2') {
    console.log('  -> In main2, advancing again');
    socket.emit('end-phase');
    await wait(1000);
    console.log('  Phase:', currentState.phase);
  }
  
  // [5] End turn — advance until player2 (AI) takes over
  console.log('\n[5] Ending turn...');
  let exits = 0;
  while (currentState.currentPlayer === 'player1' && exits < 6) {
    socket.emit('end-phase');
    await wait(600);
    exits++;
    console.log(`  -> T${currentState.turn} ${currentState.phase} (${currentState.currentPlayer})`);
  }
  
  // Now AI should have taken over — wait for it to finish
  console.log('  Waiting for AI turn to complete...');
  await wait(8000);
  
  console.log('\n=== FINAL STATE ===');
  console.log('Turn:', currentState.turn, '| Phase:', currentState.phase, '| Current:', currentState.currentPlayer);
  console.log('Player LP:', currentState.player.lp, '| Opp LP:', currentState.opponent.lp);
  console.log('Player monsters:', currentState.player.field?.monsters?.map(m => m?.name));
  console.log('Player spells:', currentState.player.field?.spells?.map(s => s?.name));
  
  console.log('\n=== SUCCESS ===');
  // Success: AI took its turn (Turn >= 2 means AI completed and turn switched back)
  const aiCompletedTurn = currentState.turn >= 2;
  console.log('1. AI completed turn (Turn >= 2):', aiCompletedTurn ? '✓' : '✗');
  console.log('2. Current player after AI:', currentState.currentPlayer);
  
  const allDone = aiCompletedTurn;
  console.log('\n' + (allDone ? '✅ GAME FLOW COMPLETE!' : '❌ Issues remain'));
  
  socket.disconnect();
});