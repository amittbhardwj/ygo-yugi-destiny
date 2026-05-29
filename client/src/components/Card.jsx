import { useState, useEffect } from 'react'

const ATTRIBUTE_COLORS = {
  LIGHT: '#FFD700',
  DARK: '#4B0082',
  WATER: '#00BFFF',
  FIRE: '#FF4500',
  EARTH: '#8B4513',
  WIND: '#98FB98',
}

const FRAME_STYLES = {
  normal: { border: '#d9a05b', bg: 'linear-gradient(180deg, #c5a059 0%, #a47c35 100%)' },
  effect: { border: '#c35922', bg: 'linear-gradient(180deg, #b96939 0%, #8c4217 100%)' },
  spell: { border: '#1d8c70', bg: 'linear-gradient(180deg, #1d826c 0%, #0d4a3e 100%)' },
  trap: { border: '#bd3377', bg: 'linear-gradient(180deg, #bc3a80 0%, #761a4c 100%)' }
}

const SIZE_CONFIG = {
  hand: { width: 92, height: 129 },
  field: { width: 78, height: 109 },
  large: { width: 140, height: 196 },
}

const getLocalCardArtUrl = (cardName) => {
  if (!cardName) return null
  const formatted = cardName.toLowerCase()
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `/card-art/${formatted}.png`
}

export default function Card({ card, faceDown = false, selected = false, selectable = false, isAttackTarget = false, animationClass = '', onClick, onHover, size = 'field' }) {
  const [isHovered, setIsHovered] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const name = card?.name || ''
  const localUrl = getLocalCardArtUrl(name)
  const remoteUrl = card?.imgUrl || (card?.id
    ? `https://storage.googleapis.com/ygoprodeck.com/pics/${card.id}.jpg`
    : null)

  const [imgSrc, setImgSrc] = useState(localUrl || remoteUrl)

  useEffect(() => {
    const freshName = card?.name || ''
    const freshLocal = getLocalCardArtUrl(freshName)
    const freshRemote = card?.imgUrl || (card?.id
      ? `https://storage.googleapis.com/ygoprodeck.com/pics/${card.id}.jpg`
      : null)
    setImgSrc(freshLocal || freshRemote)
    setImgLoaded(false)
  }, [card])

  const handleImgError = () => {
    if (imgSrc === localUrl && remoteUrl && localUrl !== remoteUrl) {
      setImgSrc(remoteUrl)
    } else {
      setImgLoaded(false)
    }
  }

  const getCardType = () => {
    if (!card) return 'normal'
    const t = (card.type || '').toLowerCase()
    if (t === 'monster') return card.isEffect ? 'effect' : 'normal'
    if (t === 'spell') return 'spell'
    if (t === 'trap') return 'trap'
    if (card.type === 'Monster') return card.isEffect ? 'effect' : 'normal'
    if (card.type === 'Spell') return 'spell'
    if (card.type === 'Trap') return 'trap'
    return 'normal'
  }

  const getCardStyle = () => {
    const dims = SIZE_CONFIG[size] || SIZE_CONFIG.field
    const cardType = getCardType()
    let base = `modern-card modern-card-${cardType} modern-card-${size} relative cursor-pointer transition-all duration-200 rounded-none overflow-hidden`
    if (faceDown) return `${base} card-back-egyptian modern-card-back ${animationClass}`
    let border = ''
    if (selected) border = 'border-yellow-400 border-4'
    else if (selectable) border = 'border-amber-600 border-2'
    else border = 'border-2'
    let extra = ''
    if (selected) extra = 'modern-card-selected scale-105 shadow-md shadow-yellow-400/50'
    else if (selectable) extra = 'card-selectable modern-card-selectable'
    if (isAttackTarget) extra = 'card-attack-target'
    return `${base} ${border} ${extra} ${animationClass}`
  }

  const renderCardFace = () => {
    if (!card) return null
    const cardType = getCardType()
    const style = FRAME_STYLES[cardType]
    const showStats = cardType === 'normal' || cardType === 'effect'
    const { level, attribute, atk, def } = card

    const textSize = size === 'hand' ? 'text-[5px]' : size === 'large' ? 'text-[10px]' : 'text-[7px]'
    const levelSize = size === 'hand' ? 'text-[8px]' : size === 'large' ? 'text-xs' : 'text-[10px]'
    const statsSize = size === 'hand' ? 'text-[7px]' : size === 'large' ? 'text-sm' : 'text-[10px]'
    const padding = size === 'hand' ? 'p-0.5' : size === 'large' ? 'p-2' : 'p-1'

    return (
      <div className={`modern-card-face w-full h-full rounded-none flex flex-col ${padding}`} style={{ background: style.bg, border: `1px solid ${style.border}` }}>
        <div className="flex justify-between items-center mb-0.5">
          {attribute && <div className="w-3 h-3 rounded-none border border-black/30" style={{ backgroundColor: ATTRIBUTE_COLORS[attribute.toUpperCase()] }} title={attribute} />}
          {level > 0 && <div className="flex">{[...Array(Math.min(level, 12))].map((_, i) => <span key={i} className={`${levelSize} text-orange-400`}>★</span>)}</div>}
        </div>

        {/* Card image */}
        <div className="relative flex-1 rounded-none overflow-hidden mb-0.5" style={{ minHeight: size === 'hand' ? '32px' : '48px' }}>
          {imgSrc && (
            <img
              src={imgSrc}
              alt={name}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={handleImgError}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
              <span className={`${textSize} text-white font-bold text-center px-1 leading-tight`}>{name}</span>
            </div>
          )}
        </div>

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
      {faceDown ? (
        <div className="w-full h-full rounded-none overflow-hidden flex items-center justify-center bg-[#5c3317]">
          <img
            src="https://images.ygoprodeck.com/images/cards/back_high.jpg"
            alt="Card Back"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        renderCardFace()
      )}
      {!faceDown && size === 'field' && (card.atk !== undefined || card.def !== undefined) && (
        <div className="field-card-statline">{card.atk ?? '-'} / {card.def ?? '-'}</div>
      )}
      {isHovered && !faceDown && <div className="absolute inset-0 rounded-none shadow-md shadow-yellow-400/30 pointer-events-none" />}
    </div>
  )
}
