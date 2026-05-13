import { useState } from 'react'

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

const FRAME_STYLES = {
  normal: { border: '#8B5A2B', bg: 'linear-gradient(135deg, #654321 0%, #8B4513 50%, #654321 100%)' },
  effect: { border: '#CC6600', bg: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #8B4513 100%)' },
  spell: { border: '#228B22', bg: 'linear-gradient(135deg, #166534, #15803d)' },
  trap: { border: '#7B3FEE', bg: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }
}

const SIZE_CONFIG = {
  hand: { width: 86, height: 120 },
  field: { width: 70, height: 98 },
  large: { width: 140, height: 196 },
}

export default function Card({ card, faceDown = false, selected = false, selectable = false, isAttackTarget = false, onClick, onHover, size = 'field' }) {
  const [isHovered, setIsHovered] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const getCardType = () => {
    if (!card) return 'normal'
    // Server sends lowercase: 'monster', 'spell', 'trap'
    const t = (card.type || '').toLowerCase()
    if (t === 'monster') return card.isEffect ? 'effect' : 'normal'
    if (t === 'spell') return 'spell'
    if (t === 'trap') return 'trap'
    // Fallback for capitalized types from older data
    if (card.type === 'Monster') return card.isEffect ? 'effect' : 'normal'
    if (card.type === 'Spell') return 'spell'
    if (card.type === 'Trap') return 'trap'
    return 'normal'
  }

  const getCardStyle = () => {
    const dims = SIZE_CONFIG[size] || SIZE_CONFIG.field
    let base = `relative cursor-pointer transition-all duration-200 rounded-lg overflow-hidden`
    if (faceDown) return `${base} card-back`
    let border = 'border-gray-600'
    const cardType = getCardType()
    if (selected) border = 'border-yellow-400 border-4'
    else if (selectable) border = 'border-amber-600 border-2'
    else border = `border-2 border-[${FRAME_STYLES[cardType].border}]`
    let extra = ''
    if (selected) extra = 'scale-105 shadow-lg shadow-yellow-400/50'
    else if (selectable) extra = 'card-selectable'
    if (isAttackTarget) extra = 'card-attack-target'
    return `${base} ${border} ${extra}`
  }

  const renderCardFace = () => {
    if (!card) return null
    const cardType = getCardType()
    const style = FRAME_STYLES[cardType]
    const showStats = cardType === 'normal' || cardType === 'effect'
    const { name, level, attribute, atk, def } = card

    // imgUrl comes from server (ygoprodeck numeric ID mapping). Fallback: try card.id as base ID
    const imgUrl = card.imgUrl || (card.id
      ? `https://storage.googleapis.com/ygoprodeck.com/pics/${card.id}.jpg`
      : null)

    const textSize = size === 'hand' ? 'text-[5px]' : size === 'large' ? 'text-[10px]' : 'text-[7px]'
    const levelSize = size === 'hand' ? 'text-[8px]' : size === 'large' ? 'text-xs' : 'text-[10px]'
    const statsSize = size === 'hand' ? 'text-[7px]' : size === 'large' ? 'text-sm' : 'text-[10px]'
    const padding = size === 'hand' ? 'p-0.5' : size === 'large' ? 'p-2' : 'p-1'

    return (
      <div className={`w-full h-full rounded-lg flex flex-col ${padding}`} style={{ background: style.bg, border: `2px solid ${style.border}` }}>
        <div className="flex justify-between items-center mb-0.5">
          {attribute && <div className="w-3 h-3 rounded-full border border-black/30" style={{ backgroundColor: ATTRIBUTE_COLORS[attribute.toUpperCase()] }} title={attribute} />}
          {level && <div className="flex">{[...Array(Math.min(level, 12))].map((_, i) => <span key={i} className={`${levelSize} text-orange-400`}>★</span>)}</div>}
        </div>

        {/* Card image */}
        {imgUrl && (
          <div className="flex-1 rounded overflow-hidden mb-0.5" style={{ minHeight: size === 'hand' ? '32px' : '48px' }}>
            <img
              src={imgUrl}
              alt={name}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
              className={`w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {!imgLoaded && (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', minHeight: size === 'hand' ? '32px' : '48px' }}>
                <span className={`${textSize} text-white font-bold text-center px-1`}>{name}</span>
              </div>
            )}
          </div>
        )}

        {showStats && (
          <div className="flex justify-between mt-0.5">
            {atk !== undefined && <span className={`${statsSize} font-bold text-red-400`}>ATK {atk}</span>}
            {def !== undefined && <span className={`${statsSize} font-bold text-blue-400`}>DEF {def}</span>}
          </div>
        )}
      </div>
    )
  }

  const dims = SIZE_CONFIG[size] || SIZE_CONFIG.field

  return (
    <div
      className={getCardStyle()}
      style={{ width: dims.width, height: dims.height, flexShrink: 0 }}
      onClick={onClick}
      onMouseEnter={() => { setIsHovered(true); if (onHover) onHover(card) }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {faceDown
        ? <div className="w-full h-full card-back rounded-lg flex items-center justify-center"><span className="text-yellow-400 text-2xl font-bold opacity-50">?</span></div>
        : renderCardFace()
      }
      {!faceDown && size === 'field' && (card.atk !== undefined || card.def !== undefined) && (
        <div className="field-card-statline">{card.atk ?? '-'} / {card.def ?? '-'}</div>
      )}
      {isHovered && !faceDown && <div className="absolute inset-0 rounded-lg shadow-lg shadow-yellow-400/30 pointer-events-none" />}
    </div>
  )
}
