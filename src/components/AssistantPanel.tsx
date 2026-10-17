import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  type AssistantMode,
  type AssistanceLevel,
  type ChatMessage,
  ASSISTANT_MODES,
  ASSISTANCE_LEVEL_DESCRIPTIONS,
} from '../types/assistant'
import { generateMockResponse } from '../utils/mockResponses'
import {
  checkBackendHealth,
  sendBackendChat,
  getAIStatus,
  configureApiKey,
  type BackendHealth,
  type AIStatusResponse,
} from '../services/api'
import type { CatMood } from './FloatingCat'
import './AssistantPanel.css'

interface AssistantPanelProps {
  onCollapse: () => void
  onMoodChange: (mood: CatMood) => void
}

function getNowTimeString(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: `Hello! I'm your AI DSA Companion 🐱.
I help you master Data Structures & Algorithms by guiding your intuition rather than just spoiling the answer.

✨ Phase 5 AI Integration is active! You can configure your Google Gemini API key via the 🔑 Key button above or in backend/.env to unlock live Socratic reasoning.`,
    mode: 'hint',
    level: 1,
    timestamp: 'Just now',
    isMock: false,
    source: 'python-backend',
  },
]

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  onCollapse,
  onMoodChange,
}) => {
  const [activeMode, setActiveMode] = useState<AssistantMode>('hint')
  const [assistanceLevel, setAssistanceLevel] = useState<AssistanceLevel>(1)
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendHealth | null>(null)
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null)

  // API Key modal states
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false)
  const [apiKeyInput, setApiKeyInput] = useState<string>('')
  const [showKeyText, setShowKeyText] = useState<boolean>(false)
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false)
  const [keySaveFeedback, setKeySaveFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Check Python backend health and AI status on demand
  const verifyBackend = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setBackendStatus('checking')
    }
    const res = await checkBackendHealth(2500)
    if (res.success) {
      setBackendStatus('online')
      setBackendInfo(res.data)
      const aiRes = await getAIStatus(2500)
      if (aiRes.success) {
        setAiStatus(aiRes.data)
      }
    } else {
      setBackendStatus('offline')
      setBackendInfo(null)
      setAiStatus(null)
    }
  }, [])

  // Poll backend health and AI status on mount and periodically every 10 seconds
  useEffect(() => {
    let isSubscribed = true

    const runChecks = async () => {
      const res = await checkBackendHealth(2500)
      if (!isSubscribed) return
      if (res.success) {
        setBackendStatus('online')
        setBackendInfo(res.data)
        const aiRes = await getAIStatus(2500)
        if (isSubscribed && aiRes.success) {
          setAiStatus(aiRes.data)
        }
      } else {
        setBackendStatus('offline')
        setBackendInfo(null)
        setAiStatus(null)
      }
    }

    runChecks()
    const interval = setInterval(runChecks, 10000)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [])

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim()
    if (!key) return
    setIsSavingKey(true)
    setKeySaveFeedback(null)

    const res = await configureApiKey(key)
    setIsSavingKey(false)

    if (res.success) {
      setKeySaveFeedback({
        type: 'success',
        message: '✅ API key saved successfully! Gemini 3.8 Flash is active.',
      })
      setApiKeyInput('')
      const statusRes = await getAIStatus(2500)
      if (statusRes.success) {
        setAiStatus(statusRes.data)
      }
      setTimeout(() => {
        setShowKeyModal(false)
        setKeySaveFeedback(null)
      }, 1500)
    } else {
      setKeySaveFeedback({
        type: 'error',
        message: `❌ ${res.error}`,
      })
    }
  }

  // Suggested prompts per mode
  const suggestedPrompts: Record<AssistantMode, string[]> = {
    hint: [
      'Give me a hint for Two Sum',
      'How do I optimize Longest Substring?',
      'Intuition for Valid Parentheses',
    ],
    debug: [
      'Why is my Binary Search stuck in an infinite loop?',
      'Index out of bounds on array[mid]',
      'Null pointer on linked list traversal',
    ],
    testcase: [
      'Edge cases for Array partition',
      'Test cases for empty or single-element input',
      'Tricky tests for Palindrome string',
    ],
    learn: [
      'Explain Dynamic Programming vs Recursion',
      'What is the time complexity of QuickSort?',
      'When to use Sliding Window vs Two Pointers?',
    ],
  }

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim()
    if (!query || isLoading) return

    const userMessage: ChatMessage = {
      id: generateUniqueId('user'),
      sender: 'user',
      text: query,
      timestamp: getNowTimeString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputPrompt('')
    setIsLoading(true)
    onMoodChange('thinking')

    // 1. Try communicating with Python FastAPI backend
    const apiResult = await sendBackendChat(query, activeMode, assistanceLevel)

    if (apiResult.success) {
      setBackendStatus('online')
      const assistantMessage: ChatMessage = {
        id: generateUniqueId('assistant'),
        sender: 'assistant',
        text: apiResult.data.response,
        mode: activeMode,
        level: assistanceLevel,
        timestamp: apiResult.data.timestamp || getNowTimeString(),
        source: 'python-backend',
        model: apiResult.data.model,
        isMock: false,
      }
      setMessages((prev) => [...prev, assistantMessage])
      onMoodChange(activeMode === 'debug' ? 'helping' : 'success')
    } else {
      // 2. Handle connection failures or backend errors gracefully
      if (apiResult.isConnectionError) {
        setBackendStatus('offline')
        const fallbackText = generateMockResponse(query, activeMode, assistanceLevel)
        const fallbackMessage: ChatMessage = {
          id: generateUniqueId('assistant'),
          sender: 'assistant',
          text: `⚠️ [BACKEND OFFLINE - Python server not detected at 127.0.0.1:8000]\nFalling back to local development response:\n\n${fallbackText}`,
          mode: activeMode,
          level: assistanceLevel,
          timestamp: getNowTimeString(),
          source: 'mock-engine',
          isMock: true,
        }
        setMessages((prev) => [...prev, fallbackMessage])
      } else {
        // Backend returned a validation/logic error (e.g. 400 Bad Request)
        const errorMessage: ChatMessage = {
          id: generateUniqueId('error'),
          sender: 'assistant',
          text: `❌ ${apiResult.error}`,
          mode: activeMode,
          level: assistanceLevel,
          timestamp: getNowTimeString(),
          isError: true,
        }
        setMessages((prev) => [...prev, errorMessage])
      }
      onMoodChange('idle')
    }

    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearHistory = () => {
    setMessages([
      {
        id: generateUniqueId('cleared'),
        sender: 'assistant',
        text: '🐾 Chat history cleared. What DSA problem are we working on now?',
        timestamp: getNowTimeString(),
        isMock: false,
      },
    ])
  }

  return (
    <div className="assistant-container">
      {/* Panel Top Header */}
      <header className="panel-header">
        <div className="panel-brand">
          <span className="panel-header-icon">🐾</span>
          <div className="panel-title-area">
            <h2>DSA Assistant Panel</h2>
            <div className="panel-status-row">
              {backendStatus === 'online' ? (
                <span
                  className="backend-status-badge online"
                  title={`FastAPI ${backendInfo?.version || '0.1.0'} running on 127.0.0.1:8000`}
                >
                  <span className="status-dot green" />
                  Python Online
                </span>
              ) : backendStatus === 'checking' ? (
                <span className="backend-status-badge checking">
                  <span className="status-dot yellow" />
                  Connecting...
                </span>
              ) : (
                <button
                  type="button"
                  className="backend-status-badge offline clickable"
                  onClick={() => verifyBackend(true)}
                  title="Click to retry connecting to 127.0.0.1:8000"
                >
                  <span className="status-dot red" />
                  Backend Offline ↻
                </button>
              )}

              {backendStatus === 'online' && (
                aiStatus?.configured ? (
                  <button
                    type="button"
                    className="ai-status-badge active clickable"
                    onClick={() => setShowKeyModal(true)}
                    title={`AI Active: ${aiStatus.model}. Click to configure key.`}
                  >
                    <span className="status-sparkle">✨</span>
                    {aiStatus.model ? (aiStatus.model.includes('3.8') ? 'Gemini 3.8' : 'Gemini AI') : 'Gemini AI'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ai-status-badge unconfigured clickable"
                    onClick={() => setShowKeyModal(true)}
                    title="No Gemini API key configured. Click to set key."
                  >
                    <span className="status-warn">⚠️</span>
                    Set AI Key
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="panel-window-controls">
          <button
            type="button"
            className="panel-ctrl-btn key-btn"
            onClick={() => setShowKeyModal(true)}
            title="Configure Google Gemini API Key"
          >
            🔑 Key
          </button>
          <button
            type="button"
            className="panel-ctrl-btn collapse"
            onPointerDown={onCollapse}
            onClick={onCollapse}
            title="Collapse to desktop pet"
          >
            ▲ Collapse
          </button>
        </div>
      </header>

      {/* Mode Selector Tabs */}
      <nav className="mode-tabs">
        {(Object.keys(ASSISTANT_MODES) as AssistantMode[]).map((modeKey) => {
          const config = ASSISTANT_MODES[modeKey]
          const isActive = activeMode === modeKey
          return (
            <button
              key={modeKey}
              type="button"
              className={`mode-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveMode(modeKey)}
              title={config.description}
            >
              <span className="mode-tab-icon">{config.icon}</span>
              <span className="mode-tab-label">{config.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>

      {/* Assistance Level Slider / Selector */}
      <section className="level-selector-strip">
        <div className="level-label-area">
          <span className="level-tag">Assistance Level:</span>
          <span className="level-desc-text">
            {ASSISTANCE_LEVEL_DESCRIPTIONS[assistanceLevel].title}
          </span>
        </div>
        <div className="level-buttons-group">
          {([1, 2, 3, 4] as AssistanceLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`level-pill-btn ${assistanceLevel === lvl ? 'active' : ''}`}
              onClick={() => setAssistanceLevel(lvl)}
              title={ASSISTANCE_LEVEL_DESCRIPTIONS[lvl].subtitle}
            >
              L{lvl}
            </button>
          ))}
        </div>
      </section>

      {/* Messages Thread */}
      <main className="messages-thread">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user'
          return (
            <div
              key={msg.id}
              className={`message-row ${isUser ? 'user-row' : 'assistant-row'} ${
                msg.isError ? 'error-row' : ''
              }`}
            >
              <div className={`message-bubble ${msg.isError ? 'error-bubble' : ''}`}>
                {!isUser && (
                  <div className="message-meta-header">
                    <span className="meta-badge-mode">
                      {msg.mode ? ASSISTANT_MODES[msg.mode].icon : '🐾'}{' '}
                      {msg.mode?.toUpperCase() || 'CAT'}
                    </span>
                    {msg.level && <span className="meta-badge-level">L{msg.level}</span>}
                    {msg.model ? (
                      <span className="meta-badge-gemini">
                        ✨ {msg.model.includes('gemini') ? (msg.model.includes('3.8') ? 'GEMINI 3.8' : 'GEMINI') : msg.model.toUpperCase()}
                      </span>
                    ) : msg.source === 'python-backend' ? (
                      <span className="meta-badge-python">🐍 FASTAPI</span>
                    ) : null}
                    {msg.isMock && <span className="meta-badge-mock">MOCK</span>}
                    <span className="message-time">{msg.timestamp}</span>
                  </div>
                )}
                <div className="message-content">
                  <pre className="message-text">{msg.text}</pre>
                </div>
                {isUser && <span className="user-message-time">{msg.timestamp}</span>}
              </div>
            </div>
          )
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="message-row assistant-row">
            <div className="message-bubble loading-bubble">
              <span className="pulsing-cat-icon">🐱</span>
              <span className="loading-text">
                {backendStatus === 'online'
                  ? 'Communicating with Python FastAPI orchestrator...'
                  : 'Analyzing your query...'}
              </span>
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* Suggested Prompt Chips */}
      <div className="suggestions-scroll">
        {suggestedPrompts[activeMode].map((promptText, idx) => (
          <button
            key={idx}
            type="button"
            className="suggestion-chip"
            onClick={() => handleSendMessage(promptText)}
            disabled={isLoading}
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Input Bar & Actions */}
      <footer className="panel-input-bar">
        <button
          type="button"
          className="clear-btn"
          onClick={handleClearHistory}
          title="Clear Conversation"
        >
          🗑️
        </button>

        <input
          type="text"
          className="chat-input"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={ASSISTANT_MODES[activeMode].placeholder}
          disabled={isLoading}
        />

        <button
          type="button"
          className="send-btn"
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputPrompt.trim()}
          title="Send Query"
        >
          ➤
        </button>
      </footer>

      {/* Gemini AI Key Modal */}
      {showKeyModal && (
        <div className="api-key-modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div
            className="api-key-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div className="modal-title-area">
                <span className="modal-icon">✨</span>
                <h3>Gemini AI Configuration</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowKeyModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                Byte the Cat uses <strong>Google Gemini 3.8 Flash</strong> for real-time Socratic DSA guidance.
              </p>

              <div className="key-status-indicator">
                <span className="status-label">Engine Status:</span>
                {aiStatus?.configured ? (
                  <span className="badge-active">
                    <span className="status-dot green" />
                    Configured ({aiStatus.model})
                  </span>
                ) : (
                  <span className="badge-missing">
                    <span className="status-dot red" />
                    No Key Configured
                  </span>
                )}
              </div>

              <div className="key-input-wrapper">
                <label htmlFor="gemini-key-input" className="key-input-label">
                  Google Gemini API Key:
                </label>
                <div className="key-input-group">
                  <input
                    id="gemini-key-input"
                    type={showKeyText ? 'text' : 'password'}
                    className="key-field-input"
                    placeholder="Enter your AIzaSy... key"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    disabled={isSavingKey}
                  />
                  <button
                    type="button"
                    className="toggle-visibility-btn"
                    onClick={() => setShowKeyText(!showKeyText)}
                    title={showKeyText ? 'Hide Key' : 'Show Key'}
                  >
                    {showKeyText ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {keySaveFeedback && (
                <div className={`key-save-feedback ${keySaveFeedback.type}`}>
                  {keySaveFeedback.message}
                </div>
              )}

              <div className="key-help-links">
                <span className="info-icon">💡</span>
                <span>
                  Get a free key from <strong>aistudio.google.com</strong>.
                  Keys are safely saved to <span className="code-text">backend/.env</span>.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowKeyModal(false)}
                disabled={isSavingKey}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-save"
                onClick={handleSaveApiKey}
                disabled={isSavingKey || !apiKeyInput.trim()}
              >
                {isSavingKey ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
