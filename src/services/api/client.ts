import type { ApiResponse, ApiError } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export { USE_MOCK }

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

  const isJson = response.headers.get('content-type')?.includes('application/json')

  if (!response.ok) {
    const error: ApiError = isJson
      ? await response.json().catch(() => ({
          message: 'An unexpected error occurred',
          statusCode: response.status,
        }))
      : {
          message: await response.text().catch(() => 'An unexpected error occurred'),
          statusCode: response.status,
        }

    throw error
  }

  if (response.status === 204) {
    return { data: undefined as T }
  }

  if (!isJson) {
    return { data: undefined as T }
  }

  return response.json()
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 12)
}
