import Card from './Card'

export default function Hand({ cards, isOpponent = false, onCardClick, selectable = false, onHover }) {
  if (isOpponent) {
    return (
      <div className="ygo-hand ygo-hand-opponent hand-scroll">
        {cards.map((card, index) => (
          <Card key={index} card={null} faceDown={true} size="hand" />
        ))}
      </div>
    )
  }

  return (
    <div className="ygo-hand ygo-hand-player hand-scroll">
      {cards.map((card, index) => (
        <Card
          key={card.uid || card.cardId || card.id || index}
          card={card}
          faceDown={false}
          selectable={selectable}
          onHover={(c) => onHover && onHover(c)}
          onClick={() => onCardClick && onCardClick(card, index)}
          size="hand"
        />
      ))}
    </div>
  )
}
