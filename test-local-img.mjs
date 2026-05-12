/**
 * Playwright test for card image rendering
 */
import { chromium } from 'playwright'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Load image map
const IMAGE_MAP = JSON.parse(readFileSync(join(__dirname, 'server/cardImageMap.json'), 'utf8'))
function getCardImageUrl(cardId) {
  if (!cardId) return null
  const base = cardId.replace(/_[0-9]+$/, '')
  return IMAGE_MAP[base] || null
}

// Patch index.html to use localhost:3456
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace('const SOCKET_URL = window.location.origin', 'const SOCKET_URL = "http://localhost:3456"')
const patchedIndexPath = join(distDir, 'index-patched.html')
writeFileSync(patchedIndexPath, localHTML)

const httpServer = createServer((req, res) => {
  const url = req.url.split('?')[0]
  const filePath = join(distDir, url === '/' || url === '/index-patched.html' ? '/index-patched.html' : url)
  if (existsSync(filePath)) {
    const ct = filePath.endsWith('.js') ? 'application/javascript'
             : filePath.endsWith('.css') ? 'text/css'
             : filePath.endsWith('.html') ? 'text/html' : 'text/plain'
    res.writeHead(200, { 'Content-Type': ct })
    res.end(readFileSync(filePath))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

const io = new Server(httpServer, { cors: { origin: '*' } })

const handCards = [
  { id: 'm1', name: 'Dark Magician', atk: 2500, def: 2100, type: 'monster', level: 7, attribute: 'dark', species: 'spellcaster', cardId: 'm1_0' },
  { id: 'm2', name: 'Blue-Eyes White Dragon', atk: 3000, def: 2500, type: 'monster', level: 8, attribute: 'light', species: 'dragon', cardId: 'm2_1' },
  { id: 'm3', name: 'Red-Eyes Black Dragon', atk: 2400, def: 2000, type: 'monster', level: 7, attribute: 'dark', species: 'dragon', cardId: 'm3_2' },
  { id: 's1', name: 'Dark Hole', type: 'spell', cardId: 's1_3' },
  { id: 't1', name: 'Mirror Force', type: 'trap', cardId: 't1_4' },
]
const handWithImg = handCards.map(c => ({ ...c, imgUrl: getCardImageUrl(c.cardId) }))

const roomCode = 'TESTIMG'
const games = {}

console.log('=== imgUrl for hand cards ===')
handWithImg.forEach(c => console.log(`  ${c.name}: ${c.imgUrl || 'MISSING'}`))

io.on('connection', (socket) => {
  socket.on('create-room', ({ playerName, roomCode: rc }) => {
    socket.join(rc)
    socket.data.room = rc
    socket.data.playerKey = 'player1'
    games[rc] = { players: { player1: { id: socket.id, name: playerName, lp: 4000, hand: handWithImg, deck: [], field: { monsters: [], spells: [] }, grave: [] }, player2: { id: null, name: 'Yugi', lp: 4000, hand: [], deck: [], field: { monsters: [], spells: [] }, grave: [] } }, turn: 1, phase: 'draw', currentPlayer: 'player1', started: true }
    const p = games[rc].players.player1
    socket.emit('room-created', { roomCode: rc, playerKey: 'player1' })
    setTimeout(() => {
      socket.emit('game-state', {
        room: rc, turn: 1, phase: 'draw', currentPlayer: 'player1',
        players: {
          player1: { name: p.name, lp: p.lp, hand: handWithImg, deckCount: 35, field: { monsters: [], spells: [] }, grave: [] },
          player2: { name: 'Yugi', lp: 4000, hand: [], deckCount: 35, field: { monsters: [], spells: [] }, grave: [] },
        },
      })
    }, 150)
  })

  socket.on('advance-phase', ({ room }) => {
    const g = games[room]
    if (!g) return
    const phases = ['draw', 'standby', 'main1', 'battle', 'main2', 'end']
    const idx = phases.indexOf(g.phase)
    g.phase = phases[Math.min(idx + 1, phases.length - 1)]
    socket.emit('game-state', {
      room, turn: g.turn, phase: g.phase, currentPlayer: g.currentPlayer,
      players: {
        player1: { name: 'Amitt', lp: g.players.player1.lp, hand: g.players.player1.hand, deckCount: 35, field: { monsters: [], spells: [] }, grave: [] },
        player2: { name: 'Yugi', lp: 4000, hand: [], deckCount: 35, field: { monsters: [], spells: [] }, grave: [] },
      },
    })
  })
})

httpServer.listen(3456, async () => {
  console.log('\n=== PLAYWRIGHT TEST ===\n')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[ERROR]', msg.text())
  })
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message))

  await page.goto('http://localhost:3456')
  await page.waitForTimeout(2000)

  // Step 1: Click "Play vs Yugi (AI)"
  const yugiBtn = page.locator('button:has-text("Play vs Yugi")').first()
  if (await yugiBtn.count() > 0) {
    console.log('Clicking "Play vs Yugi (AI)"...')
    await yugiBtn.click()
    await page.waitForTimeout(500)
  }

  // Step 2: Fill in name if needed
  const nameInput = page.locator('input[placeholder*="name"], input[type="text"]').first()
  if (await nameInput.count() > 0) {
    await nameInput.fill('Amitt')
    console.log('Filled player name')
  }

  // Step 3: Click "Start Duel!"
  const startBtn = page.locator('button:has-text("Start Duel")').first()
  if (await startBtn.count() > 0) {
    console.log('Clicking "Start Duel!"...')
    await startBtn.click()
    await page.waitForTimeout(3000)
  }

  // Dump page content
  const bodyText = await page.locator('body').innerText().catch(() => 'FAILED')
  console.log('=== PAGE TEXT (first 800) ===')
  console.log(bodyText.substring(0, 800))

  // Image checks
  const imgCount = await page.locator('img').count()
  console.log(`\nTotal <img> tags: ${imgCount}`)
  for (let i = 0; i < Math.min(imgCount, 8); i++) {
    const src = await page.locator('img').nth(i).getAttribute('src').catch(() => 'ERR')
    console.log(`  img[${i}]: ${src}`)
  }

  // Hand cards
  const handImgs = await page.locator('.hand-scroll img').count()
  console.log(`\nImages in .hand-scroll: ${handImgs}`)

  await page.screenshot({ path: '/tmp/ygo-card-test.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-card-test.png')

  await browser.close()
  httpServer.close()
  process.exit(0)
})