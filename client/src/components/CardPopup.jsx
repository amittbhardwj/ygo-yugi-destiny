import { useState, useEffect } from 'react'

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

// Map card names to AI-generated image files (all 40 cards covered)
const CARD_IMAGE_MAP = {
  // Iconic monsters
  'Dark Magician': '/card-art/dark-magician.png',
  'Blue-Eyes White Dragon': '/card-art/blue-eyes-white-dragon.png',
  'Red-Eyes Black Dragon': '/card-art/red-eyes-black-dragon.png',
  'Summoned Skull': '/card-art/summoned-skull.png',
  'Gaia The Fierce Knight': '/card-art/gaia-the-fierce-knight.png',
  'Dark Magician Girl': '/card-art/dark-magician-girl.png',
  // Common monsters
  'Celtic Guardian': '/card-art/celtic-guardian.png',
  'Ralf': '/card-art/ralf.png',
  'Golem': '/card-art/golem.png',
  'Dragoner': '/card-art/dragoner.png',
  'Feral Imp': '/card-art/feral-imp.png',
  'Dark Energy': '/card-art/dark-energy.png',
  'Koumori Dragon': '/card-art/koumori-dragon.png',
  'One-Eyed Shield': '/card-art/one-eyed-shield.png',
  'Lord of D.': '/card-art/lord-of-d.png',
  'Rod of the Magical Veil': '/card-art/rod-of-the-magical-veil.png',
  'Enchanting Mists': '/card-art/enchanting-mists.png',
  'Kappa': '/card-art/kappa.png',
  'Shark': '/card-art/shark.png',
  'Kuriboh': '/card-art/kuriboh.png',
  'Mystic Tomato': '/card-art/mystic-tomato.png',
  'Mammoth Graveyard': '/card-art/mammoth-graveyard.png',
  'Wolf': '/card-art/wolf.png',
  'Dark Hiero': '/card-art/dark-hiero.png',
  'Ancient Brain': '/card-art/ancient-brain.png',
  'Hoshiri': '/card-art/hoshiri.png',
  'Doma': '/card-art/doma.png',
  'Parrot': '/card-art/parrot.png',
  'Monster Eye': '/card-art/monster-eye.png',
  'Drollman': '/card-art/drollman.png',
  'Charubin': '/card-art/charubin.png',
  'Fire Reaper': '/card-art/fire-reaper.png',
  'Firegrass': '/card-art/firegrass.png',
  'My Bodyguard': '/card-art/my-bodyguard.png',
  'Armored Zombie': '/card-art/armored-zombie.png',
  'Crawling Dragon': '/card-art/crawling-dragon.png',
  'Lesser Dragon': '/card-art/lesser-dragon.png',
  'Hitod': '/card-art/hitod.png',
  'Dark King': '/card-art/dark-king.png',
  'Shadow Specter': '/card-art/shadow-specter.png',
  'Yomi': '/card-art/yomi.png',
  // Spells
  'Dark Hole': '/card-art/dark-hole.png',
  'Monster Reborn': '/card-art/monster-reborn.png',
  'Mirror Force': '/card-art/mirror-force.png',
}

function getCardImage(name) {
  return CARD_IMAGE_MAP[name] || null
}

export default function CardPopup({ card, position }) {
  const [visible, setVisible] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (card) {
      const timer = setTimeout(() => setVisible(true), 300)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
    setImgError(false)
  }, [card])

  if (!card || !visible) return null

  const { name, type, attribute, level, atk, def, description } = card
  const cardImage = getCardImage(name)
  const popupStyle = position || { x: 100, y: 100 }

  return (
    <div
      className="fixed z-50 bg-ygo-dark border-2 border-ygo-gold rounded-xl p-4 shadow-2xl"
      style={{
        left: popupStyle.x + 100,
        top: popupStyle.y,
        minWidth: '240px',
        maxWidth: '300px',
      }}
    >
      {/* Card art */}
      <div className="w-full h-32 rounded-lg mb-3 flex items-center justify-center overflow-hidden"
        style={{
          background: cardImage || imgError
            ? 'transparent'
            : type === 'Spell'
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : type === 'Trap'
                ? 'linear-gradient(135deg, #a855f7, #7e22ce)'
                : 'linear-gradient(135deg, #1e3a8a, #1e40af)',
        }}
      >
        {cardImage && !imgError ? (
          <img
            src={cardImage}
            alt={name}
            className="w-full h-full object-cover rounded-lg"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-white text-lg font-bold">{name}</span>
        )}
      </div>

      {/* Card name */}
      <h3 className="text-ygo-gold font-bold text-lg mb-2">{name}</h3>

      {/* Type and attribute */}
      <div className="flex items-center gap-2 mb-2">
        {attribute && (
          <span
            className="w-5 h-5 rounded-full border border-white/30"
            style={{ backgroundColor: ATTRIBUTE_COLORS[attribute] || '#888' }}
            title={attribute}
          />
        )}
        <span className="text-gray-300 text-sm">{type}</span>
        {level && (
          <span className="ml-auto text-yellow-300 text-sm">
            {[...Array(Math.min(level, 12))].map((_, i) => '★').join('')}
          </span>
        )}
      </div>

      {/* ATK/DEF */}
      {(atk !== undefined || def !== undefined) && (
        <div className="flex gap-4 mb-3 text-sm">
          {atk !== undefined && (
            <span className="text-red-400 font-bold">ATK: {atk}</span>
          )}
          {def !== undefined && (
            <span className="text-blue-400 font-bold">DEF: {def}</span>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-gray-400 text-xs border-t border-gray-700 pt-2">
          {description}
        </p>
      )}
    </div>
  )
}