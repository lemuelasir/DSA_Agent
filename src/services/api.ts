import type { AssistantMode, AssistanceLevel } from '../types/assistant'

const BACKEND_URL = 'http://127.0.0.1:8000'

export interface BackendHealth {
  status: string
  service: string
  version: string
  timestamp: string
}

export interface BackendChatResponse {
  status: string
  response: string
  mode: string
  level: number
  source: string
  model?: string
  timestamp: string
}

export interface AIStatusResponse {
  configured: boolean
  provider: string
  model: string
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; isConnectionError?: boolean }

/**
 * Check backend health status with a fast timeout
 */
export async function checkBackendHealth(timeoutMs = 2500): Promise<ApiResponse<BackendHealth>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        success: false,
        error: `Backend responded with HTTP status ${res.status}`,
      }
    }

    const data: BackendHealth = await res.json()
    return { success: true, data }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Connection timed out (backend not responding)'
          : err.message
        : 'Unknown connection failure'
    return { success: false, error: message, isConnectionError: true }
  }
}

/**
 * Send DSA query to Python FastAPI backend
 */
export async function sendBackendChat(
  prompt: string,
  mode: AssistantMode,
  level: AssistanceLevel,
  code?: string,
  language = 'python',
  error?: string,
  timeoutMs = 15000
): Promise<ApiResponse<BackendChatResponse>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode,
        level,
        code: code?.trim() || null,
        language,
        error: error?.trim() || null,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const errorJson = await res.json()
        if (errorJson.detail) {
          detail = Array.isArray(errorJson.detail)
            ? errorJson.detail.map((d: { msg: string }) => d.msg).join(', ')
            : String(errorJson.detail)
        }
      } catch {
        // Fallback to status text
      }
      return { success: false, error: `Backend error: ${detail}` }
    }

    const data: BackendChatResponse = await res.json()
    return { success: true, data }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Backend request timed out'
          : err.message
        : 'Failed to communicate with Python backend'
    return { success: false, error: message, isConnectionError: true }
  }
}

/**
 * Check whether Gemini AI is configured on the backend
 */
export async function getAIStatus(timeoutMs = 2500): Promise<ApiResponse<AIStatusResponse>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/api/ai-status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }

    const data: AIStatusResponse = await res.json()
    return { success: true, data }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : 'Failed to fetch AI status'
    return { success: false, error: message, isConnectionError: true }
  }
}

/**
 * Configure or update Gemini API key on the backend
 */
export async function configureApiKey(
  apiKey: string,
  timeoutMs = 5000
): Promise<ApiResponse<{ status: string; message: string; configured: boolean }>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/api/configure-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const errorJson = await res.json()
        if (errorJson.detail) {
          detail = Array.isArray(errorJson.detail)
            ? errorJson.detail.map((d: { msg: string }) => d.msg).join(', ')
            : String(errorJson.detail)
        }
      } catch {
        // Fallback
      }
      return { success: false, error: detail }
    }

    const data = await res.json()
    return { success: true, data }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : 'Failed to configure API key'
    return { success: false, error: message }
  }
}

export interface ScreenAnalysis {
  detected: boolean
  is_coding_context?: boolean
  has_error: boolean
  is_stuck?: boolean
  is_accepted?: boolean
  problem_name?: string
  error_type?: string
  error_summary?: string
  mood: 'idle' | 'thinking' | 'helping' | 'success'
  cat_speech: string
  detailed_hint: string
  suggested_prompt?: string
}

export interface ScreenAnalysisResponse {
  status: string
  analysis: ScreenAnalysis
  model?: string
}

/**
 * Send desktop screen frame to Gemini Vision for DSA problem and error detection
 */
export async function analyzeScreen(
  imageBase64: string,
  isIdleCheck = false,
  timeoutMs = 15000
): Promise<ApiResponse<ScreenAnalysisResponse>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze-screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, is_idle_check: isIdleCheck }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }

    const data: ScreenAnalysisResponse = await res.json()
    return { success: true, data }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : 'Screen vision analysis failed'
    return { success: false, error: message }
  }
}

