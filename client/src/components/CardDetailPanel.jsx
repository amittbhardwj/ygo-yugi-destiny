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

function AttributeDot({ attribute }) {
  if (!attribute) return null
  return (
    <div
      className="w-6 h-6 rounded-full border-2 border-egyptian-gold shadow-lg"
      style={{ backgroundColor: ATTRIBUTE_COLORS[attribute.toUpperCase()] || '#888' }}
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
    const lUrl = getLocalCardArtUrl(card?.name)
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

  if (card.hidden) {
    return (
      <div className="card-detail-panel">
        <div className="detail-inner-border">
          <div className="card-image-area" style={{ borderColor: '#888' }}>
            <div className="w-full h-full bg-[#5c3317] flex items-center justify-center overflow-hidden">
              <img
                src="https://images.ygoprodeck.com/images/cards/back_high.jpg"
                alt="Face-down Card"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="card-info-content">
            <div className="text-egyptian-gold text-lg font-bold mb-2">Face-down Card</div>
            <div className="text-gray-400 text-sm mb-3">Opponent's Card</div>
            <div className="text-gray-300 text-xs leading-relaxed p-2 bg-gray-800/30 rounded">
              The details of this card are hidden.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { attribute, level, atk, def, description, species } = card
  const rawType = card.type || ''
  const normalizedType = rawType.toLowerCase()
  const displayType = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase() : 'Unknown'
  const isSpell = normalizedType.includes('spell')
  const isTrap = normalizedType.includes('trap')
  const isMonster = !isSpell && !isTrap

  // Determine card type color for border
  const typeColor = isSpell ? '#22c55e' : isTrap ? '#a855f7' : '#1e40af'

  return (
    <div className="card-detail-panel">
      <div className="detail-inner-border">
        {/* Card image display */}
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
              <span className="text-gray-300 text-sm">{displayType}</span>
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
                <span className="text-white">{displayType}</span>
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
