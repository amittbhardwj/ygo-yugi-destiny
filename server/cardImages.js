/**
 * Card image URL helper
 * Maps game card base IDs to ygoprodeck image URLs
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load image map
const IMAGE_MAP = JSON.parse(
  readFileSync(join(__dirname, 'cardImageMap.json'), 'utf8')
)

const YGOPRO_URL = 'https://storage.googleapis.com/ygoprodeck.com/pics'

/**
 * Get image URL for a card by its instance cardId (e.g. "m1_0" → "m1")
 */
export function getCardImageUrl(cardId) {
  if (!cardId) return null
  // Strip instance suffix: "m1_0" → "m1"
  const baseId = cardId.replace(/_[0-9]+$/, '')
  const url = IMAGE_MAP[baseId]
  return url || null
}

/**
 * Get image URL for a card by base ID directly (e.g. "m1")
 */
export function getCardImageUrlByBaseId(baseId) {
  return IMAGE_MAP[baseId] || null
}
