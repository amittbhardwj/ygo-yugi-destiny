import { useState, useEffect } from 'react'

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

const CARD_IMAGE_MAP = {
  'Dark Magician': '/card-art/dark-magician.png',
  'Blue-Eyes White Dragon': '/card-art/blue-eyes-white-dragon.png',
  'Red-Eyes Black Dragon': '/card-art/red-eyes-black-dragon.png',
  'Dark Hole': '/card-art/dark-hole.png',
  'Mirror Force': '/card-art/mirror-force.png',
  'Monster Reborn': '/card-art/monster-reborn.png',
  'Summoned Skull': '/card-art/summoned-skull.png',
  'Gaia The Fierce Knight': '/card-art/gaia-the-fierce-knight.png',
  'Celtic Guardian': '/card-art/celtic-guardian.png',
  'Ralf': '/card-art/ralf.png',
  'Golem': '/card-art/golem.png',
  'Dragoner': '/card-art/dragoner.png',
  'Feral Imp': '/card-art/feral-imp.png',
  'Koumori Dragon': '/card-art/koumori-dragon.png',
  'One-Eyed Shield': '/card-art/one-eyed-shield.png',
  'Lord of D.': '/card-art/lord-of-d.png',
  'Kuriboh': '/card-art/kuriboh.png',
  'Mammoth Graveyard': '/card-art/mammoth-graveyard.png',
  'Wolf': '/card-art/wolf.png',
  'Mystic Tomato': '/card-art/mystic-tomato.png',
  'Enchanting Mists': '/card-art/enchanting-mists.png',
  'Shark': '/card-art/shark.png',
  'Charubin': '/card-art/charubin.png',
  'Dark Energy': '/card-art/dark-energy.png',
  'Dark Magician Girl': '/card-art/dark-magician-girl.png',
  'Armored Zombie': '/card-art/armored-zombie.png',
  'Fire Reaper': '/card-art/fire-reaper.png',
  'Ancient Brain': '/card-art/ancient-brain.png',
  'Dark Hiero': '/card-art/dark-hiero.png',
  'Hoshiri': '/card-art/hoshiri.png',
  'Doma': '/card-art/doma.png',
  'Parrot': '/card-art/parrot.png',
  'Monster Eye': '/card-art/monster-eye.png',
  'Drollman': '/card-art/drollman.png',
  'Firegrass': '/card-art/firegrass.png',
  'My Bodyguard': '/card-art/my-bodyguard.png',
  'Crawling Dragon': '/card-art/crawling-dragon.png',
  'Lesser Dragon': '/card-art/lesser-dragon.png',
  'Hitod': '/card-art/hitod.png',
  'Dark King': '/card-art/dark-king.png',
  'Shadow Specter': '/card-art/shadow-specter.png',
  'Yomi': '/card-art/yomi.png',
  'Rod of the Magical Veil': '/card-art/rod-of-the-magical-veil.png',
  'Kappa': '/card-art/kappa.png',
}

function getCardImage(card) {
  if (card?.imgUrl) return card.imgUrl
  return CARD_IMAGE_MAP[card?.name] || null
}

function AttributeDot({ attribute }) {
  if (!attribute) return null
  return (
    <div
      className="w-6 h-6 rounded-full border-2 border-egyptian-gold shadow-lg"
      style={{ backgroundColor: ATTRIBUTE_COLORS[attribute] || '#888' }}
      title={attribute}
    />
  )
}

function LevelStars({ level }) {
  if (!level) return null
  return (
    <div className="flex gap-0.5">
      {[...Array(Math.min(level, 12))].map((_, i) => (
        <span key={i} className="text-yellow-300 text-lg">★</span>
      ))}
    </div>
  )
}

export default function CardDetailPanel({ card, onClose }) {
  const [selectedTab, setSelectedTab] = useState('info') // 'info' or 'status'

  if (!card) {
    return (
      <div className="card-detail-panel">
        <div className="detail-inner-border">
          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🎴</div>
              <div className="text-egyptian-gold text-lg font-bold">No Card Selected</div>
              <div className="text-gray-400 text-sm mt-2">Hover over a card to see details</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { name, type, attribute, level, atk, def, description, species } = card
  const cardImage = getCardImage(card)
  const isSpell = type === 'Spell'
  const isTrap = type === 'Trap'
  const isMonster = !isSpell && !isTrap

  // Determine card type color for border
  const typeColor = isSpell ? '#22c55e' : isTrap ? '#a855f7' : '#1e40af'

  return (
    <div className="card-detail-panel">
      <div className="detail-inner-border">
        {/* Card image display */}
        <div className="card-image-area" style={{ borderColor: typeColor }}>
          {cardImage ? (
            <img
              src={cardImage}
              alt={name}
              className="card-detail-image"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="card-detail-placeholder" style={{ background: typeColor }}>
              <span className="text-white text-sm font-bold">{name}</span>
            </div>
          )}
        </div>

        {/* Tab buttons */}
        <div className="flex border-b border-egyptian-gold/30">
          <button
            onClick={() => setSelectedTab('info')}
            className={`flex-1 py-2 text-center text-sm font-bold transition-colors ${
              selectedTab === 'info'
                ? 'bg-egyptian-gold text-egyptian-dark'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            INFO
          </button>
          <button
            onClick={() => setSelectedTab('status')}
            className={`flex-1 py-2 text-center text-sm font-bold transition-colors ${
              selectedTab === 'status'
                ? 'bg-egyptian-gold text-egyptian-dark'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            STATUS
          </button>
        </div>

        {/* Info tab */}
        {selectedTab === 'info' && (
          <div className="card-info-content">
            {/* Card name */}
            <div className="text-egyptian-gold text-lg font-bold mb-2">{name}</div>

            {/* Type line */}
            <div className="flex items-center gap-2 mb-3">
              <AttributeDot attribute={attribute} />
              <span className="text-gray-300 text-sm">{type}</span>
              {isMonster && species && (
                <span className="text-gray-500 text-xs">/ {species}</span>
              )}
            </div>

            {/* Stats for monsters */}
            {isMonster && (
              <div className="mb-3 p-2 bg-gray-900/50 rounded">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-400 font-bold">ATK</span>
                  <span className="text-white font-bold">{atk ?? '?'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-400 font-bold">DEF</span>
                  <span className="text-white font-bold">{def ?? '?'}</span>
                </div>
                <div className="mt-2">
                  <LevelStars level={level} />
                </div>
              </div>
            )}

            {/* Description */}
            {description && (
              <div className="text-gray-300 text-xs leading-relaxed p-2 bg-gray-800/30 rounded">
                {description}
              </div>
            )}
          </div>
        )}

        {/* Status tab - shows card position and owner info */}
        {selectedTab === 'status' && (
          <div className="card-info-content">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Card Type</span>
                <span className="text-white">{type}</span>
              </div>
              {isMonster && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Level</span>
                    <span className="text-yellow-300">{'★'.repeat(level || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Attribute</span>
                    <span className="text-white capitalize">{attribute || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Species</span>
                    <span className="text-white capitalize">{species || 'Normal'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ATK Power</span>
                    <span className="text-red-400 font-bold">{atk ?? '?'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DEF Power</span>
                    <span className="text-blue-400 font-bold">{def ?? '?'}</span>
                  </div>
                </>
              )}
              {!isMonster && (
                <div className="text-gray-400 text-center py-4">
                  Spell and Trap cards have no stats
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}