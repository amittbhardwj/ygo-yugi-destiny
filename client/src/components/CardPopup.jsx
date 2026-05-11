import { useState, useEffect } from 'react'

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

export default function CardPopup({ card, position }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (card) {
      const timer = setTimeout(() => setVisible(true), 300)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [card])

  if (!card || !visible) return null

  const { name, type, attribute, level, atk, def, description } = card

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
      {/* Card art placeholder */}
      <div
        className="w-full h-32 rounded-lg mb-3 flex items-center justify-center"
        style={{
          background: type === 'Spell' ? 'linear-gradient(135deg, #22c55e, #16a34a)' :
                      type === 'Trap' ? 'linear-gradient(135deg, #a855f7, #7e22ce)' :
                      'linear-gradient(135deg, #1e3a8a, #1e40af)',
        }}
      >
        <span className="text-white text-lg font-bold">{name}</span>
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