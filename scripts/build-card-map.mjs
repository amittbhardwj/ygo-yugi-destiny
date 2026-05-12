/**
 * Build card image map from ygoprodeck API
 * Run: node scripts/build-card-map.mjs
 */
import { readFileSync, writeFileSync } from 'fs'

// Load and parse cards_1.js manually (no ES module issues)
const raw = readFileSync('./server/cards_1.js', 'utf8')
const cardsMatch = raw.match(/\[\s*\{.*\}\s*\]/s)
if (!cardsMatch) { console.error('Parse error'); process.exit(1) }
const cardTexts = cardsMatch[0].matchAll(/\{([^}]+)\}/g)
const CARDS = []
for (const match of cardTexts) {
  const obj = {}
  const fields = match[1].matchAll(/(\w+):\s*'([^']*)'/g)
  for (const f of fields) obj[f[1]] = f[2]
  if (obj.id) CARDS.push(obj)
}

const DB_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?name='
const YGOPRO_URL = 'https://storage.googleapis.com/ygoprodeck.com/pics'

const uniqueNames = [...new Set(CARDS.map(c => c.name))]
console.log(`${uniqueNames.length} unique cards to fetch...`)

const map = {}
let done = 0

for (const name of uniqueNames) {
  try {
    const res = await fetch(`${DB_API}${encodeURIComponent(name)}`)
    if (res.ok) {
      const data = await res.json()
      const id = data.data?.[0]?.id
      if (id) {
        for (const c of CARDS.filter(c => c.name === name)) {
          map[c.id] = `${YGOPRO_URL}/${id}.jpg`
        }
      } else {
        process.stderr.write(`  No ID for: ${name}\n`)
      }
    }
    done++
    if (done % 20 === 0) console.log(`  ${done}/${uniqueNames.length}`)
    await new Promise(r => setTimeout(r, 80))
  } catch (e) {
    process.stderr.write(`  Error: ${name} - ${e.message}\n`)
  }
}

writeFileSync('./server/cardImageMap.json', JSON.stringify(map, null, 2))
console.log(`\nWrote ${Object.keys(map).length} mappings`)
