/**
 * One-time script to build card image map from ygoprodeck API
 * Run: node scripts/fetch-card-images.mjs
 */
import { readFileSync } from 'fs'

// Load cards
const cardsJson = readFileSync('./server/cards_1.js', 'utf8')
const cardsMatch = cardsJson.match(/export default \[.*\]/s)
if (!cardsMatch) {
  console.error('Could not parse cards_1.js')
  process.exit(1)
}

// Fake the module system to eval
const CARDS = eval(`[${cardsJson.replace('export default', '').trim().slice(0, -1)}]`)

const YGOPRO_URL = 'https://storage.googleapis.com/ygoprodeck.com/pics'
const DB_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?name='

const uniqueNames = [...new Set(CARDS.map(c => c.name))]
console.log(`Fetching ${uniqueNames.length} unique card images from ygoprodeck...`)

const map = {}
let done = 0

for (const name of uniqueNames) {
  try {
    const res = await fetch(`${DB_API}${encodeURIComponent(name)}`)
    if (res.ok) {
      const data = await res.json()
      const id = data.data?.[0]?.id
      if (id) {
        const gameIds = CARDS.filter(c => c.name === name).map(c => c.id)
        for (const gameId of gameIds) {
          map[gameId] = `${YGOPRO_URL}/${id}.jpg`
        }
      }
    }
    done++
    if (done % 20 === 0) console.log(`  ${done}/${uniqueNames.length}...`)
    await new Promise(r => setTimeout(r, 100)) // rate limit
  } catch (e) {
    console.error(`Error fetching ${name}: ${e.message}`)
  }
}

console.log(`\nDone! Got ${Object.keys(map).length} mappings`)
console.log('\n// Paste this into cardImages.js:\nexport const CARD_IMAGE_MAP = ' + JSON.stringify(map, null, 2))
