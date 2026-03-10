<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const formError = ref('')

const isValid = computed(() => email.value.includes('@') && password.value.length >= 6)

async function handleLogin() {
  formError.value = ''
  try {
    await auth.login({ email: email.value, password: password.value })
    const redirect = (router.currentRoute.value.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Login failed'
  }
}
</script>

<template>
  <!-- Mobile-only brand (desktop brand is on the left panel) -->
  <div class="lg:hidden text-center mb-8">
    <div class="inline-flex items-center gap-2.5 mb-6">
      <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
        <span class="text-lg">🍽</span>
      </div>
      <span class="text-xl font-bold text-foreground tracking-tight">MealSync</span>
    </div>
  </div>

  <!-- Heading -->
  <div class="mb-8">
    <h1 class="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Welcome back</h1>
    <p class="text-muted-foreground mt-2">Sign in to continue to your kitchen</p>
  </div>

  <!-- OAuth first (modern pattern) -->
  <div class="space-y-3 mb-6">
    <button
      type="button"
      class="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card hover:bg-muted/60 transition-all duration-200 text-sm font-medium text-foreground shadow-sm hover:shadow"
    >
      <svg width="20" height="20" class="shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  </div>

  <!-- Divider -->
  <div class="relative mb-6">
    <div class="absolute inset-0 flex items-center">
      <div class="w-full border-t border-border" />
    </div>
    <div class="relative flex justify-center">
      <span class="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">or</span>
    </div>
  </div>

  <!-- Form -->
  <form @submit.prevent="handleLogin" class="space-y-5">
    <!-- Error -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="formError" class="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/5 border border-destructive/15 text-sm text-destructive">
        <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        {{ formError }}
      </div>
    </Transition>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="email" class="text-sm font-medium text-foreground">Email address</Label>
      <Input
        id="email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        required
        autocomplete="email"
        :style="{ height: '2.75rem', borderRadius: '0.75rem', backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)', borderColor: 'color-mix(in oklch, var(--border) 70%, transparent)' }"
      />
    </div>

    <!-- Password -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="password" class="text-sm font-medium text-foreground">Password</Label>
        <a href="#" class="text-xs text-primary/80 hover:text-primary transition-colors">Forgot password?</a>
      </div>
      <div style="position: relative;">
        <Input
          id="password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="••••••••"
          required
          autocomplete="current-password"
          :style="{ height: '2.75rem', borderRadius: '0.75rem', backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)', borderColor: 'color-mix(in oklch, var(--border) 70%, transparent)', paddingRight: '2.75rem' }"
        />
        <button
          type="button"
          @click="showPassword = !showPassword"
          style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); padding: 0.125rem; border-radius: 0.375rem; color: var(--muted-foreground);"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
        >
          <EyeOff v-if="showPassword" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full font-semibold text-sm"
      :style="{ height: '2.75rem', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px color-mix(in oklch, var(--primary) 20%, transparent)' }"
      :disabled="!isValid || auth.loading"
    >
      <Loader2 v-if="auth.loading" class="w-4 h-4 mr-2 animate-spin" />
      Sign in
    </Button>
  </form>

  <!-- Footer -->
  <p class="text-center text-sm text-muted-foreground mt-8">
    Don't have an account?
    <router-link to="/register" class="text-primary font-semibold hover:text-primary/80 transition-colors">Create account</router-link>
  </p>
</template>
