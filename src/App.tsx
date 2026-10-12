import { useState, useRef, useEffect } from 'react'
import { FloatingCat, type CatMood } from './components/FloatingCat'
import './App.css'

export default function App() {
  const [mood, setMood] = useState<CatMood>('idle')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true)
  const [petCount, setPetCount] = useState<number>(0)
  const [showSpeech, setShowSpeech] = useState<boolean>(true)

  const speechTimeoutRef = useRef<number | null>(null)

  const moodIcons: Record<CatMood, string> = {
    idle: '💤',
    thinking: '💡',
    helping: '🐾',
    success: '✨',
  }

  // Speech bubble messages
  const speechMessages: Record<CatMood, string> = {
    idle: petCount === 0 
      ? 'Meow! Drag me anywhere!' 
      : `Purr... Petted ${petCount} time${petCount > 1 ? 's' : ''}! 😸`,
    thinking: 'Analyzing time complexity O(N)... 🤔',
    helping: 'Ready to debug your LeetCode problem! 🐾',
    success: 'Accepted! Beats 100%! 🎉',
  }

  // Auto-hide speech bubble after 4.5 seconds
  useEffect(() => {
    if (!showSpeech) return

    if (speechTimeoutRef.current) {
      window.clearTimeout(speechTimeoutRef.current)
    }
    speechTimeoutRef.current = window.setTimeout(() => {
      setShowSpeech(false)
    }, 4500)

    return () => {
      if (speechTimeoutRef.current) {
        window.clearTimeout(speechTimeoutRef.current)
      }
    }
  }, [showSpeech, mood, petCount])

  // Listen to IPC updates from native context menu
  useEffect(() => {
    if (window.electronAPI?.onSetMood) {
      window.electronAPI.onSetMood((newMood) => {
        setMood(newMood as CatMood)
        setShowSpeech(true)
      })
    }
    if (window.electronAPI?.onAlwaysOnTopChanged) {
      window.electronAPI.onAlwaysOnTopChanged((flag) => {
        setIsAlwaysOnTop(flag)
      })
    }
  }, [])

  // Cycle mood directly
  const cycleMood = () => {
    setShowSpeech(true)
    setPetCount((prev) => prev + 1)
    const moodOrder: CatMood[] = ['idle', 'thinking', 'helping', 'success']
    const nextIndex = (moodOrder.indexOf(mood) + 1) % moodOrder.length
    setMood(moodOrder[nextIndex])
  }

  // Toggle Always on Top
  const toggleAlwaysOnTop = () => {
    const nextState = !isAlwaysOnTop
    setIsAlwaysOnTop(nextState)
    if (window.electronAPI?.setAlwaysOnTop) {
      window.electronAPI.setAlwaysOnTop(nextState)
    }
  }

  // Window controls
  const handleMinimize = (e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    console.log('[App] handleMinimize called')
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize()
    }
  }

  const handleClose = (e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    console.log('[App] handleClose called')
    if (window.electronAPI?.close) {
      window.electronAPI.close()
    }
  }

  // Right-click opens native context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (window.electronAPI?.showContextMenu) {
      window.electronAPI.showContextMenu()
    }
  }

  return (
    <div
      className="companion-wrapper"
      onContextMenu={handleContextMenu}
    >
      {/* Mini Floating Pill Toolbar (100% interactive buttons, zero drag interference) */}
      <div className="floating-toolbar">
        <button
          type="button"
          className="mini-btn"
          onPointerDown={cycleMood}
          onClick={cycleMood}
          title={`Mood: ${mood} (Click to change expression)`}
        >
          {moodIcons[mood]}
        </button>
        <button
          type="button"
          className={`mini-btn pin ${isAlwaysOnTop ? 'active' : ''}`}
          onPointerDown={toggleAlwaysOnTop}
          onClick={toggleAlwaysOnTop}
          title={isAlwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF'}
        >
          📌
        </button>
        <button
          type="button"
          className="mini-btn"
          onPointerDown={handleMinimize}
          onClick={handleMinimize}
          title="Minimize to taskbar"
        >
          –
        </button>
        <button
          type="button"
          className="mini-btn close"
          onPointerDown={handleClose}
          onClick={handleClose}
          title="Quit Companion"
        >
          ✕
        </button>
      </div>

      {/* Floating Speech Bubble */}
      {showSpeech && (
        <div className="speech-bubble">
          {speechMessages[mood]}
        </div>
      )}

      {/* The Pure Floating Cat Area: Native OS Dragging */}
      <div
        className="cat-area"
        onDoubleClick={cycleMood}
        title="Drag the cat anywhere! Right-click for options."
      >
        <FloatingCat mood={mood} />
      </div>
    </div>
  )
}
