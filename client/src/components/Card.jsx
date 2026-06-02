import { useState, useEffect } from 'react'
import cardImageMap from '../../../server/cardImageMap.json'

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

  const getCardRemoteUrl = (c) => {
    if (!c) return null
    const baseId = c.id || c.cardId?.replace(/_[0-9]+$/, '')
    return cardImageMap[baseId] || c.imgUrl || null
  }

  const remoteUrl = getCardRemoteUrl(card)
  const [imgSrc, setImgSrc] = useState(localUrl || remoteUrl)

  useEffect(() => {
    const freshName = card?.name || ''
    const freshLocal = getLocalCardArtUrl(freshName)
    const freshRemote = getCardRemoteUrl(card)
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
    if (t.includes('monster')) return card.isEffect ? 'effect' : 'normal'
    if (t.includes('spell')) return 'spell'
    if (t.includes('trap')) return 'trap'
    return 'normal'
  }

  const getCardStyle = () => {
    const dims = SIZE_CONFIG[size] || SIZE_CONFIG.field
    const cardType = getCardType()
    let base = `modern-card modern-card-${cardType} modern-card-${size} relative cursor-pointer transition-all duration-200 rounded-none overflow-visible`
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
    const style = FRAME_STYLES[cardType] || FRAME_STYLES.normal

    return (
      <div 
        className="modern-card-face w-full h-full rounded-none overflow-hidden relative" 
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
      >
        {imgSrc && (
          <img
            src={imgSrc}
            alt={name}
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
            className={`w-full h-full object-fill transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!imgLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-1 text-center">
            <span className="text-[10px] text-ygo-gold font-bold leading-tight uppercase mb-1">{name}</span>
            <span className="text-[8px] text-gray-400 uppercase">{cardType}</span>
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
      {!faceDown && size === 'field' && (getCardType() === 'normal' || getCardType() === 'effect') && (card.atk !== undefined || card.def !== undefined) && (
        <div className="field-card-statline">{card.atk ?? '-'} / {card.def ?? '-'}</div>
      )}
      {isHovered && !faceDown && <div className="absolute inset-0 rounded-none shadow-md shadow-yellow-400/30 pointer-events-none" />}
    </div>
  )
}
