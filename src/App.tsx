import { useState, useRef, useEffect, useCallback } from 'react'
import { FloatingCat, type CatMood } from './components/FloatingCat'
import { AssistantPanel } from './components/AssistantPanel'
import { analyzeScreen, type ScreenAnalysis } from './services/api'
import './App.css'

/**
 * Lightweight Web Audio synthesizer for desktop pet sound effects (no external audio assets needed)
 */
function playCompanionChime(type: 'alert' | 'nudge' | 'success') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'alert') {
      // Gentle two-tone warning chime for testcase failure: F#5 -> D5
      osc.type = 'sine'
      osc.frequency.setValueAtTime(739.99, now)
      osc.frequency.setValueAtTime(587.33, now + 0.12)
      gain.gain.setValueAtTime(0.09, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc.start(now)
      osc.stop(now + 0.45)
    } else if (type === 'nudge') {
      // Soft pondering tone for stuck detector: A4 -> E5
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.setValueAtTime(659.25, now + 0.15)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.4)
    } else {
      // Cheerful multi-note chime for Accepted test cases: C5 -> E5 -> G5 -> C6
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.setValueAtTime(659.25, now + 0.08)
      osc.frequency.setValueAtTime(783.99, now + 0.16)
      osc.frequency.setValueAtTime(1046.5, now + 0.24)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
      osc.start(now)
      osc.stop(now + 0.6)
    }
  } catch {
    // Ignore audio initialization restrictions before user gesture
  }
}

export default function App() {
  const [mood, setMood] = useState<CatMood>('idle')
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true)
  const [petCount, setPetCount] = useState<number>(0)
  const [showSpeech, setShowSpeech] = useState<boolean>(true)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  // Screen Watcher & Vision States - Enabled by default so Byte watches your code
  const [isWatching, setIsWatching] = useState<boolean>(true)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [customSpeech, setCustomSpeech] = useState<string | null>(null)
  const [screenAlertData, setScreenAlertData] = useState<ScreenAnalysis | null>(null)

  const speechTimeoutRef = useRef<number | null>(null)
  const lastActiveTimestampRef = useRef<number>(Date.now())

  const moodIcons: Record<CatMood, string> = {
    idle: '💤',
    thinking: '💡',
    helping: '🐾',
    success: '✨',
  }

  // Base speech bubble messages
  const speechMessages: Record<CatMood, string> = {
    idle:
      petCount === 0
        ? isExpanded
          ? 'Ready for DSA questions!'
          : 'Meow! Click me or 💬 to open the assistant!'
        : `Purr... Petted ${petCount} time${petCount > 1 ? 's' : ''}! 😸`,
    thinking: 'Analyzing time complexity O(N)... 🤔',
    helping: 'Ready to debug your LeetCode problem! 🐾',
    success: 'Accepted! Beats 100%! 🎉',
  }

  const activeSpeechText = customSpeech || speechMessages[mood]

  // Track window activity as fallback
  useEffect(() => {
    const handleActivity = () => {
      lastActiveTimestampRef.current = Date.now()
    }
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [])

  // Auto-hide speech bubble (longer if there is an active alert)
  useEffect(() => {
    if (!showSpeech) return

    if (speechTimeoutRef.current) {
      window.clearTimeout(speechTimeoutRef.current)
    }
    const hideDuration = screenAlertData?.has_error ? 18000 : screenAlertData?.is_stuck ? 14000 : 7000
    speechTimeoutRef.current = window.setTimeout(() => {
      setShowSpeech(false)
      setCustomSpeech(null)
    }, hideDuration)

    return () => {
      if (speechTimeoutRef.current) {
        window.clearTimeout(speechTimeoutRef.current)
      }
    }
  }, [showSpeech, mood, petCount, customSpeech, screenAlertData])

  // Screen Analysis Worker
  const performScreenAnalysis = useCallback(
    async (isIdle = false) => {
      if (!window.electronAPI?.captureScreen || isAnalyzing) return
      setIsAnalyzing(true)

      try {
        const base64Img = await window.electronAPI.captureScreen()
        if (!base64Img) {
          setIsAnalyzing(false)
          return
        }

        const res = await analyzeScreen(base64Img, isIdle)
        if (res.success && res.data.status === 'success') {
          const analysis = res.data.analysis

          if (analysis.has_error) {
            // Wrong test case or execution error
            setMood('helping')
            setCustomSpeech(analysis.cat_speech)
            setScreenAlertData(analysis)
            setShowSpeech(true)
            playCompanionChime('alert')
          } else if (analysis.is_accepted) {
            // Solution passed all test cases!
            setMood('success')
            setCustomSpeech(analysis.cat_speech)
            setScreenAlertData(analysis)
            setShowSpeech(true)
            playCompanionChime('success')
          } else if (isIdle || analysis.is_stuck) {
            // Taking too long or stuck on logic
            setMood('thinking')
            setCustomSpeech(analysis.cat_speech)
            setScreenAlertData(analysis)
            setShowSpeech(true)
            playCompanionChime('nudge')
          } else if (analysis.detected && analysis.is_coding_context) {
            // Coding smoothly
            setScreenAlertData(analysis)
            if (!customSpeech) {
              setCustomSpeech(analysis.cat_speech)
              setShowSpeech(true)
            }
          }
        }
      } catch (err) {
        console.error('[Screen Watcher] Analysis error:', err)
      } finally {
        setIsAnalyzing(false)
      }
    },
    [isAnalyzing, customSpeech]
  )

  // Toggle Screen Watch Mode
  const toggleWatchMode = () => {
    const nextWatching = !isWatching
    setIsWatching(nextWatching)
    if (nextWatching) {
      setCustomSpeech('Screen Watch ON! 👁️ I will watch your code, alert on wrong test cases & nudge if stuck.')
      setShowSpeech(true)
      setTimeout(() => performScreenAnalysis(false), 500)
    } else {
      setCustomSpeech('Screen Watch Paused 🕶️.')
      setShowSpeech(true)
      setScreenAlertData(null)
    }
  }

  // Periodic Watcher Interval with OS-level cursor idle detection
  useEffect(() => {
    if (!isWatching) return

    // Perform an initial scan after mount
    const initialTimer = setTimeout(() => {
      performScreenAnalysis(false)
    }, 2000)

    const interval = setInterval(async () => {
      let idleSeconds = 0
      if (window.electronAPI?.getDesktopIdleSeconds) {
        try {
          idleSeconds = await window.electronAPI.getDesktopIdleSeconds()
        } catch {
          idleSeconds = Math.round((Date.now() - lastActiveTimestampRef.current) / 1000)
        }
      } else {
        idleSeconds = Math.round((Date.now() - lastActiveTimestampRef.current) / 1000)
      }

      // If user hasn't moved cursor across OS for 45+ seconds, trigger idle check
      const isIdle = idleSeconds >= 45
      performScreenAnalysis(isIdle)
    }, 18000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [isWatching, performScreenAnalysis])

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

  // Toggle Assistant Panel expansion
  const toggleExpanded = (expand?: boolean) => {
    const nextExpanded = expand !== undefined ? expand : !isExpanded
    setIsExpanded(nextExpanded)
    if (window.electronAPI?.setExpanded) {
      window.electronAPI.setExpanded(nextExpanded)
    }
  }

  // Cycle mood directly
  const cycleMood = () => {
    setCustomSpeech(null)
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
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize()
    }
  }

  const handleClose = (e?: React.SyntheticEvent) => {
    e?.stopPropagation()
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
            className={`mini-btn watch-btn ${isWatching ? 'active' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
            onPointerDown={toggleWatchMode}
            onClick={toggleWatchMode}
            title={
              isWatching
                ? 'Screen Watcher: ACTIVE (Monitoring desktop for wrong test cases & idle stuck state)'
                : 'Turn ON Screen Watcher (Byte watches your code & test results)'
            }
          >
            {isAnalyzing ? '🔄' : isWatching ? '👁️' : '🕶️'}
          </button>
          <button
            type="button"
            className={`mini-btn scan-btn ${isAnalyzing ? 'analyzing' : ''}`}
            onPointerDown={() => performScreenAnalysis(false)}
            onClick={() => performScreenAnalysis(false)}
            disabled={isAnalyzing}
            title="📸 Scan Screen Now: Immediately inspect desktop code and testcases"
          >
            📸
          </button>
          <button
            type="button"
            className="mini-btn"
            onPointerDown={cycleMood}
            onClick={cycleMood}
            title={`Mood: ${mood} (Click to pet Byte)`}
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

        {/* Floating Speech Bubble with Alert Highlighting */}
        {showSpeech && (
          <div
            className={`speech-bubble ${
              screenAlertData?.has_error
                ? 'has-alert'
                : screenAlertData?.is_accepted
                ? 'has-success'
                : screenAlertData?.is_stuck
                ? 'has-nudge'
                : ''
            }`}
            onClick={() => toggleExpanded(true)}
            title="Click to view details and hints in Assistant"
          >
            {screenAlertData?.has_error && (
              <div className="bubble-badge alert">
                <span>🚨 WRONG TEST CASE DETECTED</span>
              </div>
            )}
            {screenAlertData?.is_stuck && !screenAlertData?.has_error && (
              <div className="bubble-badge nudge">
                <span>💡 STUCK DETECTOR HINT</span>
              </div>
            )}
            {screenAlertData?.is_accepted && (
              <div className="bubble-badge success">
                <span>🎉 TEST CASES ACCEPTED!</span>
              </div>
            )}
            <div className="bubble-text">{activeSpeechText}</div>
            {(screenAlertData?.has_error || screenAlertData?.detailed_hint) && (
              <div className="bubble-cta">Click for Byte's hint ➜</div>
            )}
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
            screenAlert={screenAlertData}
            onClearScreenAlert={() => setScreenAlertData(null)}
            onTriggerScan={() => performScreenAnalysis(false)}
            isWatching={isWatching}
            onToggleWatch={toggleWatchMode}
            isAnalyzing={isAnalyzing}
          />
        </div>
      )}
    </div>
  )
}
