import type { ApiResponse, ApiError } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false' // default true

export { USE_MOCK }

/** Simulates network latency for mock responses */
export function delay(ms = 400): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 200))
}

/** Generic fetch wrapper with auth headers and error handling */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('session_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      message: 'An unexpected error occurred',
      statusCode: response.status,
    }))
    throw error
  }

  return response.json()
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 12)
}
