import { useState } from 'react'

const CARD_WIDTH = 80
const CARD_HEIGHT = 112

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

export default function Card({
  card,
  faceDown = false,
  selected = false,
  selectable = false,
  isAttackTarget = false,
  onClick,
  onHover,
}) {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (onHover) onHover(card)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  const getCardStyle = () => {
    let baseStyle = `w-card h-card rounded-lg relative cursor-pointer transition-all duration-200`

    if (faceDown) {
      return `${baseStyle} card-back`
    }

    let borderColor = 'border-gray-600'
    if (selected) borderColor = 'border-yellow-400 border-4'
    else if (selectable) borderColor = 'border-ygo-gold'

    let extraClass = ''
    if (selected) extraClass = 'scale-105 shadow-lg shadow-yellow-400/50'
    else if (selectable) extraClass = 'card-selectable'
    if (isAttackTarget) extraClass = 'card-attack-target'

    return `${baseStyle} ${borderColor} ${extraClass}`
  }

  const renderCardFace = () => {
    if (!card) return null

    const { name, type, level, attribute, atk, def } = card

    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-1 flex flex-col">
        {/* Top row: level stars and attribute */}
        <div className="flex justify-between items-center mb-1">
          {attribute && (
            <div
              className="w-4 h-4 rounded-full border border-white/50"
              style={{ backgroundColor: ATTRIBUTE_COLORS[attribute] || '#888' }}
              title={attribute}
            />
          )}
          {level && (
            <div className="flex">
              {[...Array(Math.min(level, 12))].map((_, i) => (
                <span key={i} className="text-yellow-300 text-xs">★</span>
              ))}
            </div>
          )}
        </div>

        {/* Card name area - colored box with name */}
        <div
          className="flex-1 rounded flex items-center justify-center text-center p-1"
          style={{
            backgroundColor: type === 'Spell' ? '#22c55e' : type === 'Trap' ? '#a855f7' : '#1e40af',
          }}
        >
          <span className="text-white text-[8px] font-bold leading-tight">{name}</span>
        </div>

        {/* Type icon */}
        <div className="text-center text-[8px] text-blue-200 mt-1">
          {type}
        </div>

        {/* ATK/DEF */}
        <div className="flex justify-between mt-1 text-[10px] text-white">
          {atk !== undefined && <span className="font-bold">ATK {atk}</span>}
          {def !== undefined && <span className="font-bold">DEF {def}</span>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={getCardStyle()}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {faceDown ? (
        <div className="w-full h-full card-back rounded-lg flex items-center justify-center">
          <span className="text-yellow-400 text-2xl font-bold opacity-50">?</span>
        </div>
      ) : (
        renderCardFace()
      )}

      {/* Hover glow effect */}
      {isHovered && !faceDown && (
        <div className="absolute inset-0 rounded-lg shadow-lg shadow-blue-400/30 pointer-events-none" />
      )}
    </div>
  )
}