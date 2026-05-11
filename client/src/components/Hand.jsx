import Card from './Card'

export default function Hand({ cards, isOpponent = false, onCardClick, selectable = false }) {
  if (isOpponent) {
    return (
      <div className="flex gap-2 p-2 bg-ygo-dark/50 rounded-lg overflow-x-auto hand-scroll">
        {cards.map((card, index) => (
          <Card key={index} card={null} faceDown={true} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2 p-2 bg-ygo-dark/50 rounded-lg overflow-x-auto hand-scroll">
      {cards.map((card, index) => (
        <Card
          key={card.id || index}
          card={card}
          faceDown={false}
          selectable={selectable}
          onClick={() => onCardClick && onCardClick(card, index)}
        />
      ))}
    </div>
  )
}