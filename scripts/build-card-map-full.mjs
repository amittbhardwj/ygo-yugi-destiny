/**
 * Fetch all cards and build image map using fuzzy name search
 */
import { readFileSync, writeFileSync } from 'fs'

const YGOPRO_URL = 'https://images.ygoprodeck.com/images/cards'
const DB_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname='

// Load ALL cards from all parts properly (use eval as last resort)
let allCards = []
for (let part = 1; part <= 4; part++) {
  try {
    const raw = readFileSync(`./server/cards_${part}.js`, 'utf8')
    // Remove export default and parse the array properly
    const withoutExport = raw.replace(/export\s+default\s+/, '')
    // Use a simple bracket-matching approach
    const arrayStart = withoutExport.indexOf('[')
    const arrayEnd = withoutExport.lastIndexOf(']')
    if (arrayStart >= 0 && arrayEnd >= 0) {
      const arrayStr = withoutExport.substring(arrayStart, arrayEnd + 1)
      try {
        // Try to parse as JS - handle trailing comma
        const parsed = Function('return ' + arrayStr.replace(/,(\s*[}\]])/g, '$1'))()
        allCards.push(...parsed)
      } catch(e) {
        console.log(`cards_${part}.js parse error: ${e.message}`)
      }
    }
  } catch(e) {
    console.log(`cards_${part}.js load error: ${e.message}`)
  }
}

console.log(`Loaded ${allCards.length} cards total`)
const uniqueNames = [...new Set(allCards.map(c => c.name))]
console.log(`${uniqueNames.length} unique names`)

// Check existing
const existingMap = JSON.parse(readFileSync('./server/cardImageMap.json', 'utf8'))
console.log(`Existing mappings: ${Object.keys(existingMap).length}`)

// Find unmapped names
const unmappedNames = uniqueNames.filter(name => {
  return !allCards.some(c => c.name === name && existingMap[c.id])
})
console.log(`${unmappedNames.length} names need fetching`)

// Fetch and map
const map = { ...existingMap }
let done = 0

for (const name of unmappedNames) {
  try {
    const res = await fetch(`${DB_API}${encodeURIComponent(name.split(' ')[0])}`)
    if (res.ok) {
      const data = await res.json()
      const id = data.data?.[0]?.id
      if (id) {
        for (const c of allCards.filter(c => c.name === name)) {
          map[c.id] = `${YGOPRO_URL}/${id}.jpg`
        }
      }
    }
    done++
    if (done % 10 === 0) console.log(`  Fetched ${done}/${unmappedNames.length}`)
    await new Promise(r => setTimeout(r, 80))
  } catch(e) {
    // skip
  }
}

writeFileSync('./server/cardImageMap.json', JSON.stringify(map, null, 2))
console.log(`\nFinal: ${Object.keys(map).length} mappings, ${Object.values(map).filter(v => v).length} with URLs`)