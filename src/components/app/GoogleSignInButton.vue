<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

const props = defineProps<{
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
}>()

const emit = defineEmits<{
  credential: [credential: string]
  error: [message: string]
}>()

const buttonRef = useTemplateRef<HTMLDivElement>('buttonRef')
const fallbackError = ref<string | null>(null)

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

function waitForGsi(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const start = Date.now()
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer)
        reject(new Error('Google Identity Services failed to load'))
      }
    }, 50)
  })
}

onMounted(async () => {
  if (!clientId) {
    fallbackError.value = 'Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID)'
    emit('error', fallbackError.value)
    return
  }

  try {
    await waitForGsi()
  } catch (e) {
    fallbackError.value = e instanceof Error ? e.message : 'Failed to load Google sign-in'
    emit('error', fallbackError.value)
    return
  }

  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      if (response.credential) {
        emit('credential', response.credential)
      } else {
        emit('error', 'No Google credential received')
      }
    },
  })

  if (buttonRef.value) {
    window.google!.accounts.id.renderButton(buttonRef.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: props.text || 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: buttonRef.value.clientWidth || 320,
    })
  }
})
</script>

<template>
  <div>
    <div ref="buttonRef" class="w-full flex justify-center" />
    <p v-if="fallbackError" class="mt-2 text-xs text-destructive">{{ fallbackError }}</p>
  </div>
</template>
