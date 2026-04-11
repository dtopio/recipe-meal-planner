import type { ConnectionStatus, SyncEvent } from '@/types'
import { ref } from 'vue'

/**
 * Lightweight sync status abstraction.
 * Uses the API health endpoint so the UI status reflects the actual backend.
 */
class SyncService {
  status = ref<ConnectionStatus>('disconnected')
  pendingCount = ref(0)
  private listeners = new Map<string, Set<(payload: unknown) => void>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.status.value = 'reconnecting'

    try {
      const response = await fetch('/api/health')
      if (!response.ok) {
        throw new Error('Health check failed')
      }
      this.status.value = 'connected'
    } catch {
      this.status.value = 'disconnected'
      this.reconnectTimer = setTimeout(() => {
        this.connect()
      }, 3000)
    }
  }

  disconnect() {
    this.status.value = 'disconnected'
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
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
