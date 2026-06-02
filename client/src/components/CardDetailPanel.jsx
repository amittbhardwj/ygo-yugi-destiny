import { useState, useEffect } from 'react'
import cardImageMap from '../../../server/cardImageMap.json'

export function WingedDisc() {
  return (
    <div className="winged-disc" aria-hidden="true">
      <div className="winged-disc-wings" />
      <div className="winged-disc-orb" />
    </div>
  )
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

export default function CardDetailPanel({ card }) {
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
    if (!card) return
    const lUrl = getLocalCardArtUrl(card.name)
    const rUrl = getCardRemoteUrl(card)
    setImgSrc(lUrl || rUrl)
  }, [card])

  const handleImageError = () => {
    if (imgSrc === localUrl && remoteUrl && localUrl !== remoteUrl) {
      setImgSrc(remoteUrl)
    } else {
      setImgSrc(null)
    }
  }

  if (!card) {
    return (
      <div className="card-detail-panel flex flex-col justify-between p-2 h-full">
        <WingedDisc />
        <div className="detail-inner-border flex-1 flex flex-col items-center justify-center">
          <div className="text-center p-4">
            <div className="text-3xl mb-3 opacity-60">𓂀</div>
            <div className="text-egyptian-gold text-sm font-bold uppercase tracking-wider">No Card Selected</div>
            <div className="text-gray-400 text-xs mt-2">Hover over a card to see details</div>
          </div>
        </div>
        <WingedDisc />
      </div>
    )
  }

  if (card.hidden) {
    return (
      <div className="card-detail-panel flex flex-col justify-between p-2 h-full">
        <WingedDisc />
        <div className="detail-inner-border flex flex-col gap-3 flex-grow">
          <div className="card-image-area border border-[#888]">
            <div className="w-full h-full bg-[#5c3317] flex items-center justify-center overflow-hidden">
              <img
                src="https://images.ygoprodeck.com/images/cards/back_high.jpg"
                alt="Face-down Card"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="card-desc-box">
            <div className="card-desc-name">Face-down Card</div>
            <div className="card-desc-species">[Opponent's Card]</div>
            <div className="card-desc-text">
              The details of this card are hidden.
            </div>
          </div>
        </div>
        <WingedDisc />
      </div>
    )
  }

  const rawType = card.type || ''
  const normalizedType = rawType.toLowerCase()
  const isSpell = normalizedType.includes('spell')
  const isTrap = normalizedType.includes('trap')
  const isMonster = !isSpell && !isTrap

  const typeColor = isSpell ? '#22c55e' : isTrap ? '#a855f7' : '#c6a34a'

  const getSpeciesLabel = () => {
    if (isSpell) return '[Spell Card]'
    if (isTrap) return '[Trap Card]'
    return `[${card.species || 'Monster'}]`
  }

  return (
    <div className="card-detail-panel flex flex-col justify-between p-2 h-full">
      <WingedDisc />
      <div className="detail-inner-border flex flex-col gap-3 flex-grow">
        {/* Card image */}
        <div className="card-image-area" style={{ borderColor: typeColor }}>
          {imgSrc ? (
            <img
              key={card.cardId || card.uid || name}
              src={imgSrc}
              alt={name}
              className="card-detail-image"
              onError={handleImageError}
            />
          ) : (
            <div className="card-detail-placeholder" style={{ background: typeColor }}>
              <span className="text-white text-xs font-bold text-center px-2">{name}</span>
            </div>
          )}
        </div>

        {/* Card Description Box */}
        <div className="card-desc-box">
          <div>
            <div className="card-desc-name">{name}</div>
            <div className="card-desc-species">{getSpeciesLabel()}</div>
            <div className="card-desc-text">{card.description}</div>
          </div>
          {isMonster && (
            <div className="card-desc-stats">
              ATK/{card.atk ?? '?'} DEF/{card.def ?? '?'}
            </div>
          )}
        </div>
      </div>
      <WingedDisc />
    </div>
  )
}
