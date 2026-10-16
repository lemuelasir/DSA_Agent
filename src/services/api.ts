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
  timeoutMs = 8000
): Promise<ApiResponse<BackendChatResponse>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode, level }),
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
