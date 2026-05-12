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
}) {
  const renderSlot = (card, index, type) => {
    const isSelected = selectedMonster === index
    const isTarget = attackTargets.includes(index)
    const zoneClass = type === 'monster' ? 'monster-zone' : 'spell-zone'

    if (!card) {
      return (
        <div
          key={index}
          className={`w-[80px] h-[112px] rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${zoneClass} ${selectable && !isOpponent ? 'hover:border-[#D4AF37] hover:bg-black/30 cursor-pointer' : 'opacity-50'}`}
          onClick={() => onEmptySlotClick && selectable && !isOpponent && onEmptySlotClick(index, type)}
        >
          <span className="text-gray-500 text-xs">{type === 'monster' ? 'M' : 'S/T'}</span>
        </div>
      )
    }

    return (
      <Card
        key={card.id || index}
        card={card}
        faceDown={card.faceDown || false}
        selected={isSelected}
        selectable={selectable && !isOpponent}
        isAttackTarget={isTarget}
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
    )
  }

  return (
    <div className="space-y-3">
      {/* Monster row */}
      <div className="flex gap-2 justify-center items-center">
        <span className="text-xs text-[#D4AF37] opacity-60 self-center mr-1 w-6 text-right font-bold">M</span>
        {[...Array(5)].map((_, i) => renderSlot(monsters[i], i, 'monster'))}
      </div>

      {/* Spell/Trap row */}
      <div className="flex gap-2 justify-center items-center">
        <span className="text-xs text-[#D4AF37] opacity-60 self-center mr-1 w-6 text-right font-bold">S/T</span>
        {[...Array(5)].map((_, i) => renderSlot(spells[i], i, 'spell'))}
      </div>
    </div>
  )
}