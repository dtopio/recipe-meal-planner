import { ref, onMounted, onUnmounted } from 'vue'

/** Track online/offline connectivity for PWA readiness */
export function useOnline() {
  const isOnline = ref(navigator.onLine)
  const wasOffline = ref(false)

  function handleOnline() {
    isOnline.value = true
    if (wasOffline.value) {
      wasOffline.value = false
    }
  }

  function handleOffline() {
    isOnline.value = false
    wasOffline.value = true
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { isOnline, wasOffline }
}
