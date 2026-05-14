import { useEffect, useMemo, useState } from 'react'

const DECK_STORAGE_KEY = 'poc_custom_deck_ids'

function getSavedDeck() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function MenuButton({ children, onClick, disabled = false, tone = 'gold' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`poc-title-menu-item poc-title-menu-${tone}`}
    >
      <span className="poc-menu-cursor">▶</span>
      <span>{children}</span>
    </button>
  )
}

export default function Lobby({ onStartGame, connectionStatus }) {
  const isDev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true'
  const [mode, setMode] = useState(isDev ? 'yugi' : null) // 'yugi' or 'online'
  const [playerName, setPlayerName] = useState(isDev ? 'Jarvis' : '')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [cards, setCards] = useState([])
  const [deckIds, setDeckIds] = useState(getSavedDeck)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const apiBase = window.__SOCKET_URL__ || ''
    fetch(`${apiBase}/api/cards`)
      .then(res => res.json())
      .then(data => {
        const unlocked = data.cards || []
        setCards(unlocked)
        if (deckIds.length < 40 && unlocked.length >= 40) {
          const starter = unlocked.filter(c => c.type !== 'fusion').slice(0, 40).map(c => c.id)
          setDeckIds(starter)
          localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(starter))
        }
      })
      .catch(() => {})
  }, [])

  const deckCounts = useMemo(() => deckIds.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {}), [deckIds])
  const visibleCards = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return cards.filter(card => card.type !== 'fusion' && (!q || card.name.toLowerCase().includes(q) || card.type.toLowerCase().includes(q)))
  }, [cards, filter])
  const deckLegal = deckIds.length >= 40 && Object.values(deckCounts).every(count => count <= 3)

  const saveDeck = (nextDeck) => {
    setDeckIds(nextDeck)
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(nextDeck))
  }

  const addCard = (id) => {
    if ((deckCounts[id] || 0) >= 3) return
    saveDeck([...deckIds, id])
  }

  const removeCard = (id) => {
    const index = deckIds.indexOf(id)
    if (index === -1) return
    saveDeck(deckIds.filter((_, i) => i !== index))
  }

  const handleStartYugi = () => {
    if (playerName.trim()) {
      onStartGame({ mode: 'yugi', playerName: playerName.trim(), deckIds })
    }
  }

  const handleCreateRoom = () => {
    if (playerName.trim() && roomCode.length === 4) {
      onStartGame({ mode: 'online', playerName: playerName.trim(), roomCode: roomCode.toUpperCase(), action: 'create' })
    }
  }

  const handleJoinRoom = () => {
    if (playerName.trim() && joinCode.length === 4) {
      onStartGame({ mode: 'online', playerName: playerName.trim(), roomCode: joinCode.toUpperCase(), action: 'join' })
    }
  }

  return (
    <div className="poc-title-screen">
      <div className="poc-title-eye poc-title-eye-left">𓂀</div>
      <div className="poc-title-eye poc-title-eye-right">𓂀</div>
      <div className="poc-title-sigil" />

      <div className="poc-title-shell">
        <div className="poc-title-logo">
          <div className="poc-yugioh-wordmark">Yu-Gi-Oh!</div>
          <div className="poc-power-wordmark">POWER OF CHAOS</div>
          <div className="poc-yugi-wordmark">YUGI THE DESTINY</div>
        </div>

        <div className="poc-title-main">
          <aside className="poc-yugi-panel" aria-hidden="true">
            <div className="poc-yugi-portrait">
              <div className="poc-yugi-star poc-star-a" />
              <div className="poc-yugi-star poc-star-b" />
              <div className="poc-yugi-star poc-star-c" />
              <div className="poc-yugi-face-title" />
              <div className="poc-yugi-collar" />
            </div>
            <div className="poc-yugi-caption">DUELIST KINGDOM SYSTEM</div>
          </aside>

          <section className="poc-title-panel">
            <div className="poc-status-bar">
              <span className={`poc-status-light ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : 'offline'}`} />
              <span>
                {connectionStatus === 'connected' ? 'NETWORK ONLINE' :
                 connectionStatus === 'connecting' ? 'CONNECTING...' :
                 'NETWORK OFFLINE'}
              </span>
            </div>

            <label className="poc-name-frame">
              <span>DUELIST NAME</span>
              <input
                type="text"
                placeholder="ENTER YOUR NAME"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
            </label>

            {!mode && (
              <nav className="poc-title-menu">
                <MenuButton onClick={() => setMode('yugi')}>Duel Yugi</MenuButton>
                <MenuButton onClick={() => setMode('deck')} tone="amber">Deck Construction</MenuButton>
                <MenuButton onClick={() => setMode('online')} tone="blue">Network Duel</MenuButton>
              </nav>
            )}

            {mode === 'yugi' && (
              <div className="poc-submenu">
                <div className="poc-submenu-title">DUEL YUGI</div>
                <p className="poc-submenu-copy">Face Yugi in a Power of Chaos-style duel.</p>
                <MenuButton onClick={handleStartYugi} disabled={!playerName.trim() || !deckLegal}>
                  Start Duel {deckLegal ? '' : `(Need ${Math.max(0, 40 - deckIds.length)} cards)`}
                </MenuButton>
                <MenuButton onClick={() => setMode(null)} tone="dim">Back</MenuButton>
              </div>
            )}

            {mode === 'deck' && (
              <div className="poc-submenu poc-deck-submenu">
                <div className="poc-submenu-title">DECK CONSTRUCTION</div>
                <div className={deckLegal ? 'poc-deck-status legal' : 'poc-deck-status illegal'}>
                  {deckIds.length} CARDS / MIN 40 / MAX 3 COPIES
                </div>
                <input
                  type="text"
                  placeholder="SEARCH UNLOCKED CARDS..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="poc-search-input"
                />
                <div className="deck-builder-list poc-title-deck-list">
                  {visibleCards.map(card => (
                    <div key={card.id} className="deck-builder-row poc-title-deck-row">
                      <div>
                        <div className="font-bold text-white">{card.name}</div>
                        <div className="text-xs text-gray-400 uppercase">{card.type}{card.atk !== undefined ? ` · ATK ${card.atk} / DEF ${card.def}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeCard(card.id)} className="deck-mini-btn">−</button>
                        <span className="text-ygo-gold w-5 text-center">{deckCounts[card.id] || 0}</span>
                        <button onClick={() => addCard(card.id)} disabled={(deckCounts[card.id] || 0) >= 3} className="deck-mini-btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <MenuButton onClick={() => setMode(null)} tone="dim">Save & Back</MenuButton>
              </div>
            )}

            {mode === 'online' && (
              <div className="poc-submenu">
                <div className="poc-submenu-title">NETWORK DUEL</div>
                <div className="poc-online-grid">
                  <div className="poc-online-box">
                    <h4>Create Room</h4>
                    <input
                      type="text"
                      placeholder="ROOM CODE"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                      maxLength={4}
                    />
                    <button onClick={handleCreateRoom} disabled={!playerName.trim() || roomCode.length !== 4}>CREATE</button>
                  </div>
                  <div className="poc-online-box">
                    <h4>Join Room</h4>
                    <input
                      type="text"
                      placeholder="ROOM CODE"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                      maxLength={4}
                    />
                    <button onClick={handleJoinRoom} disabled={!playerName.trim() || joinCode.length !== 4}>JOIN</button>
                  </div>
                </div>
                <MenuButton onClick={() => { setMode(null); setRoomCode(''); setJoinCode('') }} tone="dim">Back</MenuButton>
              </div>
            )}
          </section>
        </div>

        <div className="poc-title-footer">
          © KAIBA CORP SIMULATION SYSTEM · CARDS {cards.length || '---'} · DECK {deckIds.length}
        </div>
      </div>
    </div>
  )
}
