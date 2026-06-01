import Card from './Card'

export default function Field({
  monsters,
  spells,
  isOpponent = false,
  onMonsterClick,
  onSpellClick,
  onEmptySlotClick,
  selectedMonster,
  attackTargets = [],
  selectable = false,
  onCardHover,
  duelAnimation = null,
  tributeSelectedIds = [],
}) {
  const renderSlot = (card, index, type) => {
    const isSelected = selectedMonster === index || (card && tributeSelectedIds.includes(card.cardId))
    const isTarget = attackTargets.includes(index)
    const zoneClass = type === 'monster' ? 'monster-zone' : 'spell-zone'
    const animationClass = duelAnimation?.kind === 'attack' && card
      ? [
          duelAnimation.attackerId === card.cardId ? (isOpponent ? 'poc-card-counterattack' : 'poc-card-attack-lunge') : '',
          duelAnimation.targetId === card.cardId ? 'poc-card-hit' : '',
          duelAnimation.destroyed?.includes(card.cardId) ? 'poc-card-destroyed' : '',
        ].filter(Boolean).join(' ')
      : ''

    if (!card) {
      return (
        <div
          id={`${isOpponent ? 'opponent' : 'player'}-${type}-zone-${index}`}
          key={index}
          className={`poc-zone empty-zone ${zoneClass} ${(selectable && !isOpponent) || (isOpponent && selectable && attackTargets.length === 0) ? 'poc-zone-selectable' : ''}`}
          onClick={() => {
            if (isOpponent && selectable && attackTargets.length === 0 && onEmptySlotClick) {
              onEmptySlotClick('direct', type)
            } else if (onEmptySlotClick && selectable && !isOpponent) {
              onEmptySlotClick(index, type)
            }
          }}
        >
          <span className="poc-zone-label">{type === 'monster' ? 'M' : 'S/T'}</span>
        </div>
      )
    }

    return (
      <div id={`${isOpponent ? 'opponent' : 'player'}-${type}-zone-${index}`} className="relative h-full flex items-center justify-center">
        <Card
          key={card.id || index}
          card={card}
          faceDown={card.faceDown || false}
          selected={isSelected}
          selectable={selectable && !isOpponent}
          isAttackTarget={isTarget}
          animationClass={animationClass}
          onClick={() => {
            if (type === 'monster') {
              onMonsterClick && onMonsterClick(card, index)
            } else {
              onSpellClick && onSpellClick(card, index)
            }
          }}
          onHover={onCardHover ? (c) => onCardHover(c) : undefined}
          size="field"
        />
      </div>
    )
  }

  const monsterRow = (
    <div className="poc-zone-row poc-monster-row">
      {[...Array(5)].map((_, i) => renderSlot(monsters[i], i, 'monster'))}
    </div>
  )

  const spellRow = (
    <div className="poc-zone-row poc-spell-row">
      {[...Array(5)].map((_, i) => renderSlot(spells[i], i, 'spell'))}
    </div>
  )

  return (
    <div className={`poc-field ${isOpponent ? 'poc-field-opponent' : 'poc-field-player'}`}>
      {/* Power of Chaos order: spell/trap row sits behind monster row. */}
      {isOpponent ? <>{spellRow}{monsterRow}</> : <>{monsterRow}{spellRow}</>}
    </div>
  )
}
