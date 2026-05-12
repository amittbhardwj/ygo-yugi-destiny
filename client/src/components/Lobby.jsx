import { useState } from 'react'

export default function Lobby({ onStartGame, connectionStatus }) {
  const isDev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true'
  console.log('[LOBBY] isDev:', isDev, 'search:', typeof window !== 'undefined' ? window.location.search : 'no-window')
  const [mode, setMode] = useState(isDev ? 'yugi' : null) // 'yugi' or 'online'
  const [playerName, setPlayerName] = useState(isDev ? 'Jarvis' : '')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const handleStartYugi = () => {
    if (playerName.trim()) {
      onStartGame({ mode: 'yugi', playerName: playerName.trim() })
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
    <div className="min-h-screen bg-gradient-to-b from-ygo-dark to-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ygo-gold mb-2">
            Yu-Gi-Oh!
          </h1>
          <h2 className="text-2xl font-bold text-yellow-300 mb-1">
            Power of Chaos
          </h2>
          <h3 className="text-xl font-bold text-purple-400">
            Yugi the Destiny
          </h3>
        </div>

        {/* Connection status */}
        <div className="text-center mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' ? 'bg-green-600 text-white' :
            connectionStatus === 'connecting' ? 'bg-yellow-600 text-white' :
            'bg-red-600 text-white'
          }`}>
            {connectionStatus === 'connected' ? '● Connected' :
             connectionStatus === 'connecting' ? '◐ Connecting...' :
             '○ Disconnected'}
          </span>
        </div>

        {/* Player name input */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Enter your name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-ygo-gold rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ygo-gold"
            maxLength={20}
          />
        </div>

        {!mode && (
          <div className="space-y-3">
            {/* Play vs Yugi (AI) */}
            <button
              onClick={() => setMode('yugi')}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-bold rounded-lg transition-all transform hover:scale-105"
            >
              Play vs Yugi (AI)
            </button>

            {/* Play Online */}
            <button
              onClick={() => setMode('online')}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold rounded-lg transition-all transform hover:scale-105"
            >
              Play Online vs Friend
            </button>
          </div>
        )}

        {mode === 'yugi' && (
          <div className="space-y-3">
            <button
              onClick={handleStartYugi}
              disabled={!playerName.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Duel!
            </button>
            <button
              onClick={() => setMode(null)}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {mode === 'online' && (
          <div className="space-y-4">
            {/* Create room */}
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h4 className="text-ygo-gold font-bold mb-3">Create Room</h4>
              <input
                type="text"
                placeholder="Room code (4 letters)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-ygo-gold mb-2"
                maxLength={4}
              />
              <button
                onClick={handleCreateRoom}
                disabled={!playerName.trim() || roomCode.length !== 4}
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition-colors disabled:opacity-50"
              >
                Create Room
              </button>
            </div>

            {/* Join room */}
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h4 className="text-ygo-blue font-bold mb-3">Join Room</h4>
              <input
                type="text"
                placeholder="Enter room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-ygo-blue mb-2"
                maxLength={4}
              />
              <button
                onClick={handleJoinRoom}
                disabled={!playerName.trim() || joinCode.length !== 4}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors disabled:opacity-50"
              >
                Join Room
              </button>
            </div>

            <button
              onClick={() => { setMode(null); setRoomCode(''); setJoinCode('') }}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}