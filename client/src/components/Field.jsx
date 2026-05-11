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
}) {
  const renderSlot = (card, index, type) => {
    const isSelected = selectedMonster === index
    const isTarget = attackTargets.includes(index)

    if (!card) {
      return (
        <div
          key={index}
          className="w-card h-card rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/30 flex items-center justify-center cursor-pointer hover:border-ygo-gold hover:bg-gray-700/50 transition-colors"
          onClick={() => onEmptySlotClick && onEmptySlotClick(index, type)}
        >
          <span className="text-gray-500 text-xs">Empty</span>
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
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Spell/Trap row */}
      <div className="flex gap-2 justify-center">
        <span className="text-xs text-gray-400 self-center mr-2">S/T:</span>
        {[...Array(5)].map((_, i) => renderSlot(spells[i], i, 'spell'))}
      </div>

      {/* Monster row */}
      <div className="flex gap-2 justify-center">
        <span className="text-xs text-gray-400 self-center mr-2">M:</span>
        {[...Array(5)].map((_, i) => renderSlot(monsters[i], i, 'monster'))}
      </div>
    </div>
  )
}