import { useEffect, useState, useRef } from 'react'

export default function AttackArrow({ startElementId, endCoords }) {
  const [startCoords, setStartCoords] = useState(null)
  
  useEffect(() => {
    const updateStartCoords = () => {
      if (!startElementId) return
      const el = document.getElementById(startElementId)
      if (el) {
        const rect = el.getBoundingClientRect()
        setStartCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        })
      }
    }
    
    updateStartCoords()
    // Update on resize just in case
    window.addEventListener('resize', updateStartCoords)
    return () => window.removeEventListener('resize', updateStartCoords)
  }, [startElementId])

  if (!startCoords || !endCoords) return null

  // Calculate arrow path and rotation
  const dx = endCoords.x - startCoords.x
  const dy = endCoords.y - startCoords.y
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  const length = Math.sqrt(dx * dx + dy * dy)
  
  // Only draw if there's some distance
  if (length < 10) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <svg className="w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="attackGlow" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform={`rotate(${angle})`}>
            <stop offset="0%" stopColor="#ff0000" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ff5500" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffff00" stopOpacity="1" />
          </linearGradient>
          
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${startCoords.x}, ${startCoords.y}) rotate(${angle})`}>
          {/* Glowing Line */}
          <line 
            x1="0" y1="0" 
            x2={length - 20} y2="0" 
            stroke="url(#attackGlow)" 
            strokeWidth="8" 
            strokeLinecap="round"
            filter="url(#neonGlow)"
            className="animate-pulse"
          />
          
          {/* Inner bright core */}
          <line 
            x1="0" y1="0" 
            x2={length - 20} y2="0" 
            stroke="#ffffff" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
          
          {/* Arrow head */}
          <polygon 
            points={`${length - 20},-10 ${length},0 ${length - 20},10`} 
            fill="#ffff00" 
            filter="url(#neonGlow)"
          />
          
          {/* Target crosshair at cursor */}
          <g transform={`translate(${length}, 0) rotate(${-angle})`}>
            <circle cx="0" cy="0" r="15" fill="none" stroke="#ff0000" strokeWidth="2" filter="url(#neonGlow)" className="animate-[spin_3s_linear_infinite]" strokeDasharray="10 5" />
            <circle cx="0" cy="0" r="5" fill="#ff0000" />
            <path d="M-20,0 L20,0 M0,-20 L0,20" stroke="#ff0000" strokeWidth="2" filter="url(#neonGlow)" opacity="0.6" />
          </g>
        </g>
      </svg>
    </div>
  )
}
