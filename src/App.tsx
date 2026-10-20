import { useState, useEffect, useCallback } from 'react'
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
      // Soft pondering tone for hint/nudge: A4 -> E5
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

  // Screen Watcher & Vision States - Continuous 10s commentary
  const [isWatching, setIsWatching] = useState<boolean>(true)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [bubbleMode, setBubbleMode] = useState<'observation' | 'hint'>('observation')
  const [customSpeech, setCustomSpeech] = useState<string | null>(null)
  const [screenAlertData, setScreenAlertData] = useState<ScreenAnalysis | null>(null)

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
        ? 'Meow! Watching your screen every 25s! 🐾'
        : `Purr... Petted ${petCount} time${petCount > 1 ? 's' : ''}! 😸`,
    thinking: 'Pondering your algorithm logic... 🤔',
    helping: 'I spotted a testcase failure or edge case! 🐾',
    success: 'Accepted! Beats 100%! 🎉',
  }

  const activeSpeechText = customSpeech || speechMessages[mood]

  // Continuous Screen Analysis Worker
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
          setScreenAlertData(analysis)
          setMood(analysis.mood || (analysis.has_error ? 'helping' : analysis.is_accepted ? 'success' : 'idle'))

          // If user is currently looking at observation, update with fresh commentary
          if (bubbleMode === 'observation') {
            setCustomSpeech(analysis.cat_speech)
          } else if (bubbleMode === 'hint' && analysis.detailed_hint) {
            setCustomSpeech(`💡 ${analysis.detailed_hint}`)
          }

          setShowSpeech(true)

          if (analysis.has_error) {
            playCompanionChime('alert')
          } else if (analysis.is_accepted) {
            playCompanionChime('success')
          }
        } else {
          console.warn('[Screen Watcher] Analysis response:', res)
          if (!res.success) {
            setCustomSpeech(`⚠️ Connecting to backend (${res.error}). Retrying...`)
          } else if (res.data.status === 'error') {
            setCustomSpeech(res.data.analysis?.cat_speech || 'Purr... My vision got fuzzy. Retrying in 25s! 🐾')
          }
        }
      } catch (err) {
        console.error('[Screen Watcher] Analysis error:', err)
        setCustomSpeech('⚠️ Screen analysis error. Retrying in 25s...')
      } finally {
        setIsAnalyzing(false)
      }
    },
    [isAnalyzing, bubbleMode]
  )

  // Toggle Screen Watch Mode
  const toggleWatchMode = () => {
    const nextWatching = !isWatching
    setIsWatching(nextWatching)
    if (nextWatching) {
      setCustomSpeech('Continuous Screen Watch ON! 👁️ Inspecting screen every 25s.')
      setShowSpeech(true)
      setTimeout(() => performScreenAnalysis(false), 500)
    } else {
      setCustomSpeech('Screen Watch Paused 🕶️.')
      setShowSpeech(true)
      setScreenAlertData(null)
    }
  }

  // Continuous 25-second Screen Analysis Interval
  useEffect(() => {
    if (!isWatching) return

    // Perform an initial scan 1.2 seconds after launch
    const initialTimer = setTimeout(() => {
      performScreenAnalysis(false)
    }, 1200)

    // Run screen analysis continuously every 25 seconds
    const interval = setInterval(() => {
      performScreenAnalysis(false)
    }, 25000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [isWatching, performScreenAnalysis])

  // Request a hint in the text bubble (does NOT open the panel)
  const handleGetHint = () => {
    setBubbleMode('hint')
    if (screenAlertData?.detailed_hint) {
      setCustomSpeech(`💡 ${screenAlertData.detailed_hint}`)
    } else {
      setCustomSpeech('🐾 Inspecting your screen for a helpful hint...')
      performScreenAnalysis(false)
    }
    setShowSpeech(true)
    playCompanionChime('nudge')
  }

  // Switch back to live screen commentary in the text bubble
  const handleShowObservation = () => {
    setBubbleMode('observation')
    if (screenAlertData?.cat_speech) {
      setCustomSpeech(screenAlertData.cat_speech)
    } else {
      setCustomSpeech(null)
    }
  }

  // Pet the cat: purrs and updates text bubble with playful remarks
  const handlePetCat = () => {
    setPetCount((prev) => {
      const nextCount = prev + 1
      const petPurrs = [
        `Purr... Petted ${nextCount} times! 😸`,
        'Meow! Feeling sharp and ready to code! 🐾',
        'Purrrrr! Watching your screen closely! 🐱',
        'Warm paws! Keep solving those problems! ✨',
      ]
      setCustomSpeech(petPurrs[nextCount % petPurrs.length])
      return nextCount
    })
    setShowSpeech(true)
    setMood('success')
    playCompanionChime('nudge')
  }

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

  // Toggle Assistant Panel expansion (reserved specifically for verifying code)
  const toggleExpanded = (expand?: boolean) => {
    const nextExpanded = expand !== undefined ? expand : !isExpanded
    setIsExpanded(nextExpanded)
    if (window.electronAPI?.setExpanded) {
      window.electronAPI.setExpanded(nextExpanded)
    }
  }

  // Cycle mood directly
  const cycleMood = () => {
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
            className={`mini-btn verify-panel-btn ${isExpanded ? 'active' : ''}`}
            onClick={() => toggleExpanded()}
            title={
              isExpanded
                ? 'Collapse Code Verification Panel'
                : 'Open Code Verification Panel: Paste your code to verify & explain'
            }
          >
            {isExpanded ? '▼' : '📝'}
          </button>
          <button
            type="button"
            className={`mini-btn hint-tool-btn ${bubbleMode === 'hint' ? 'active' : ''}`}
            onClick={handleGetHint}
            title="Get Socratic Hint in Text Bubble"
          >
            💡
          </button>
          <button
            type="button"
            className={`mini-btn watch-btn ${isWatching ? 'active' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
            onClick={toggleWatchMode}
            title={
              isWatching
                ? 'Continuous Screen Watcher: ACTIVE (Analyzes screen every 25s)'
                : 'Turn ON Continuous Screen Watcher'
            }
          >
            {isAnalyzing ? '🔄' : isWatching ? '👁️' : '🕶️'}
          </button>
          <button
            type="button"
            className={`mini-btn scan-btn ${isAnalyzing ? 'analyzing' : ''}`}
            onClick={() => performScreenAnalysis(false)}
            disabled={isAnalyzing}
            title="📸 Scan Screen Now: Immediately inspect desktop code"
          >
            📸
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={cycleMood}
            title={`Mood: ${mood} (Click to pet Byte)`}
          >
            {moodIcons[mood]}
          </button>
          <button
            type="button"
            className={`mini-btn pin ${isAlwaysOnTop ? 'active' : ''}`}
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF'}
          >
            📌
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={handleMinimize}
            title="Minimize to taskbar"
          >
            –
          </button>
          <button
            type="button"
            className="mini-btn close"
            onClick={handleClose}
            title="Quit Companion"
          >
            ✕
          </button>
        </div>

        {/* Floating Speech Bubble with Hint Button and Continuous Commentary */}
        {showSpeech && (
          <div
            className={`speech-bubble ${
              bubbleMode === 'hint'
                ? 'is-hint'
                : screenAlertData?.has_error
                ? 'has-alert'
                : screenAlertData?.is_accepted
                ? 'has-success'
                : screenAlertData?.is_stuck
                ? 'has-nudge'
                : ''
            }`}
          >
            {bubbleMode === 'hint' ? (
              <div className="bubble-badge hint">
                <span>💡 SOCRATIC HINT</span>
              </div>
            ) : screenAlertData?.has_error ? (
              <div className="bubble-badge alert">
                <span>🚨 TEST CASE FAILED</span>
              </div>
            ) : screenAlertData?.is_accepted ? (
              <div className="bubble-badge success">
                <span>🎉 CODE ACCEPTED!</span>
              </div>
            ) : screenAlertData?.is_stuck ? (
              <div className="bubble-badge nudge">
                <span>💡 NUDGE</span>
              </div>
            ) : screenAlertData?.problem_name &&
              screenAlertData.problem_name !== 'No Problem Detected' &&
              screenAlertData.problem_name !== 'Analysis Error' ? (
              <div className="bubble-badge topic">
                <span>👀 {screenAlertData.problem_name}</span>
              </div>
            ) : (
              <div className="bubble-badge live">
                <span>🐾 LIVE WATCH (25s)</span>
              </div>
            )}

            <div className="bubble-text">{activeSpeechText}</div>

            {/* Bubble Action Buttons: Get Hint & Verify Code */}
            <div className="bubble-actions">
              {bubbleMode === 'observation' ? (
                <button
                  type="button"
                  className="bubble-action-btn hint-btn"
                  onClick={handleGetHint}
                  title="Speak a Socratic hint in this text bubble"
                >
                  💡 Get Hint
                </button>
              ) : (
                <button
                  type="button"
                  className="bubble-action-btn live-btn"
                  onClick={handleShowObservation}
                  title="Return to continuous live screen commentary"
                >
                  👁️ Live Screen
                </button>
              )}
              <button
                type="button"
                className="bubble-action-btn verify-btn"
                onClick={() => toggleExpanded(true)}
                title="Paste code into panel to verify correctness & get explanations"
              >
                📝 Verify Code
              </button>
            </div>
          </div>
        )}

        {/* The Animated Draggable Cat (Clicking pets Byte!) */}
        <div
          className="cat-area"
          title="Byte the Cat (Drag anywhere! Click to pet Byte)"
        >
          <FloatingCat mood={mood} onCatClick={handlePetCat} />
        </div>
      </div>

      {/* 2. Assistant Panel (Opens only when user clicks Verify Code) */}
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
