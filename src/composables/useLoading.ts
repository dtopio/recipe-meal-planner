import { ref } from 'vue'

/** Generic composable for tracking async loading state */
export function useLoading() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function withLoading<T>(fn: () => Promise<T>): Promise<T | undefined> {
    isLoading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'An error occurred'
      return undefined
    } finally {
      isLoading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return { isLoading, error, withLoading, clearError }
}
