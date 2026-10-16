import { useState, useRef, useEffect } from 'react'
import { FloatingCat, type CatMood } from './components/FloatingCat'
import { AssistantPanel } from './components/AssistantPanel'
import './App.css'

export default function App() {
  const [mood, setMood] = useState<CatMood>('idle')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true)
  const [petCount, setPetCount] = useState<number>(0)
  const [showSpeech, setShowSpeech] = useState<boolean>(true)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

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
      ? (isExpanded ? 'Ready for DSA questions!' : 'Meow! Click me to open the assistant!') 
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

  // Toggle Assistant Panel expansion (opens panel below the cat)
  const toggleExpanded = (expand?: boolean) => {
    const nextExpanded = expand !== undefined ? expand : !isExpanded
    setIsExpanded(nextExpanded)
    if (window.electronAPI?.setExpanded) {
      window.electronAPI.setExpanded(nextExpanded)
    }
  }

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
      className={`companion-app ${isExpanded ? 'expanded' : 'compact'}`}
      onContextMenu={handleContextMenu}
    >
      {/* 1. Cat Section (Always perched on top!) */}
      <div className="cat-section">
        {/* Mini Floating Pill Toolbar */}
        <div className="floating-toolbar">
          <button
            type="button"
            className={`mini-btn chat-btn ${isExpanded ? 'active' : ''}`}
            onPointerDown={() => toggleExpanded()}
            onClick={() => toggleExpanded()}
            title={isExpanded ? 'Collapse Panel' : 'Open DSA Assistant Panel'}
          >
            {isExpanded ? '▼' : '💬'}
          </button>
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
          <div
            className="speech-bubble"
            onClick={() => toggleExpanded(!isExpanded)}
            title="Click to toggle Assistant"
          >
            {speechMessages[mood]}
          </div>
        )}

        {/* The Animated Draggable Cat */}
        <div
          className="cat-area"
          onDoubleClick={() => toggleExpanded()}
          title="Drag the cat anywhere! Double-click to toggle Assistant."
        >
          <FloatingCat mood={mood} onCatClick={() => toggleExpanded()} />
        </div>
      </div>

      {/* 2. Assistant Panel (Opens directly below the cat!) */}
      {isExpanded && (
        <div className="panel-section">
          <AssistantPanel
            onCollapse={() => toggleExpanded(false)}
            onMoodChange={(newMood) => setMood(newMood)}
          />
        </div>
      )}
    </div>
  )
}
