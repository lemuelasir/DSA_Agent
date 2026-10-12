import React from 'react'
import './FloatingCat.css'

export type CatMood = 'idle' | 'thinking' | 'helping' | 'success'

interface FloatingCatProps {
  mood: CatMood
  onCatClick?: () => void
}

export const FloatingCat: React.FC<FloatingCatProps> = ({ mood, onCatClick }) => {
  return (
    <div className={`cat-stage mood-${mood}`} onClick={onCatClick} title="Click me to interact!">
      <svg
        viewBox="0 0 160 160"
        className="cat-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="catBodyGrad" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="65%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
          <linearGradient id="earInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
          <filter id="catGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(99, 102, 241, 0.25)" />
          </filter>
        </defs>

        {/* Shadow under cat */}
        <ellipse cx="80" cy="148" rx="42" ry="7" className="cat-shadow" />

        {/* Tail */}
        <path
          d="M 112 120 C 135 118, 142 90, 134 76 C 130 68, 122 72, 126 80 C 130 88, 124 105, 108 114 Z"
          className="cat-tail"
        />

        {/* Main Body */}
        <ellipse cx="80" cy="108" rx="42" ry="34" className="cat-body" filter="url(#catGlow)" />

        {/* Left Ear */}
        <g className="cat-ear ear-left">
          <polygon points="46,62 36,25 64,44" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="46,58 40,32 60,46" fill="url(#earInnerGrad)" />
        </g>

        {/* Right Ear */}
        <g className="cat-ear ear-right">
          <polygon points="114,62 124,25 96,44" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
          <polygon points="114,58 120,32 100,46" fill="url(#earInnerGrad)" />
        </g>

        {/* Head */}
        <ellipse cx="80" cy="74" rx="40" ry="34" className="cat-head" filter="url(#catGlow)" />

        {/* Cheeks / Blushing */}
        <circle cx="56" cy="85" r="6" className="cat-blush" />
        <circle cx="104" cy="85" r="6" className="cat-blush" />

        {/* Whiskers */}
        <g className="cat-whiskers">
          {/* Left Whiskers */}
          <line x1="38" y1="80" x2="20" y2="76" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="38" y1="85" x2="18" y2="85" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="38" y1="90" x2="22" y2="94" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          {/* Right Whiskers */}
          <line x1="122" y1="80" x2="140" y2="76" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="122" y1="85" x2="142" y2="85" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="122" y1="90" x2="138" y2="94" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Eyes based on mood */}
        {mood === 'success' ? (
          /* Joyful Happy Arcs: ^ ^ */
          <g className="cat-eyes-success">
            <path d="M 52 76 Q 60 66 68 76" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
            <path d="M 92 76 Q 100 66 108 76" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : mood === 'thinking' ? (
          /* Thinking eyes looking upwards/sideways */
          <g className="cat-eyes-thinking">
            <ellipse cx="60" cy="74" rx="6.5" ry="7.5" fill="#1e293b" />
            <circle cx="62" cy="71" r="2.5" fill="#ffffff" />
            <ellipse cx="100" cy="74" rx="6.5" ry="7.5" fill="#1e293b" />
            <circle cx="102" cy="71" r="2.5" fill="#ffffff" />
          </g>
        ) : (
          /* Default / Helping blinking eyes */
          <g className="cat-eyes">
            <ellipse cx="60" cy="75" rx="6.5" ry="7.5" className="cat-pupil" />
            <circle cx="58" cy="72" r="2.5" className="cat-shine" />
            <circle cx="63" cy="77" r="1.2" className="cat-shine-small" />

            <ellipse cx="100" cy="75" rx="6.5" ry="7.5" className="cat-pupil" />
            <circle cx="98" cy="72" r="2.5" className="cat-shine" />
            <circle cx="103" cy="77" r="1.2" className="cat-shine-small" />
          </g>
        )}

        {/* Tiny Pink Nose */}
        <polygon points="80,82 76,78 84,78" fill="#f43f5e" />

        {/* Mouth */}
        <path
          d="M 74 85 Q 77 89 80 85 Q 83 89 86 85"
          fill="none"
          stroke="#334155"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Paws */}
        <g className="cat-paws">
          <ellipse cx="62" cy="132" rx="10" ry="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
          <ellipse cx="98" cy="132" rx="10" ry="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        </g>
      </svg>

      {/* Floating Mood Particle Effects */}
      {mood === 'thinking' && (
        <div className="thought-bubbles">
          <span className="dot dot-1">?</span>
          <span className="dot dot-2">💡</span>
        </div>
      )}
      {mood === 'success' && (
        <div className="success-sparkles">
          <span className="sparkle sp-1">✨</span>
          <span className="sparkle sp-2">⭐</span>
        </div>
      )}
      {mood === 'helping' && (
        <div className="helping-badge">
          <span>🐾</span>
        </div>
      )}
    </div>
  )
}
