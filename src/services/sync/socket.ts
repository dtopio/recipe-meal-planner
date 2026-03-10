import type { ConnectionStatus, SyncEvent } from '@/types'
import { ref } from 'vue'

/**
 * WebSocket sync service abstraction.
 * Currently uses mock events; ready for real WebSocket integration.
 */
class SyncService {
  status = ref<ConnectionStatus>('disconnected')
  pendingCount = ref(0)
  private listeners = new Map<string, Set<(payload: unknown) => void>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    // Simulate connection
    this.status.value = 'reconnecting'
    setTimeout(() => {
      this.status.value = 'connected'
    }, 800)
  }

  disconnect() {
    this.status.value = 'disconnected'
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
  }

  on(eventType: string, callback: (payload: unknown) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)
  }

  off(eventType: string, callback: (payload: unknown) => void) {
    this.listeners.get(eventType)?.delete(callback)
  }

  /** Emit a mock event for testing */
  emitMock(event: SyncEvent) {
    const callbacks = this.listeners.get(event.type)
    if (callbacks) {
      callbacks.forEach(cb => cb(event.payload))
    }
  }

  /** Track pending sync operations */
  addPending() {
    this.pendingCount.value++
  }

  resolvePending() {
    this.pendingCount.value = Math.max(0, this.pendingCount.value - 1)
  }
}

export const syncService = new SyncService()
