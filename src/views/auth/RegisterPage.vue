<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-vue-next'
import GoogleSignInButton from '@/components/app/GoogleSignInButton.vue'

const router = useRouter()
const auth = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const formError = ref('')

const passwordChecks = computed(() => [
  { label: 'At least 8 characters', met: password.value.length >= 8 },
  { label: 'Contains uppercase', met: /[A-Z]/.test(password.value) },
  { label: 'Contains number', met: /[0-9]/.test(password.value) },
  { label: 'Passwords match', met: password.value === confirmPassword.value && confirmPassword.value.length > 0 },
])

const strength = computed(() => {
  const met = passwordChecks.value.filter(c => c.met).length
  if (met <= 1) return { level: 'weak', color: 'bg-destructive', width: 'w-1/4' }
  if (met <= 2) return { level: 'fair', color: 'bg-amber-500', width: 'w-2/4' }
  if (met <= 3) return { level: 'good', color: 'bg-blue-500', width: 'w-3/4' }
  return { level: 'strong', color: 'bg-emerald-500', width: 'w-full' }
})

const isValid = computed(() =>
  displayName.value.trim().length >= 2 &&
  email.value.includes('@') &&
  password.value.length >= 8 &&
  password.value === confirmPassword.value
)

async function handleRegister() {
  formError.value = ''
  try {
    await auth.register({
      displayName: displayName.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    router.push('/onboarding')
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Registration failed'
  }
}

async function handleGoogleCredential(credential: string) {
  formError.value = ''
  try {
    const session = await auth.loginWithGoogle(credential)
    router.push(session.user.currentHouseholdId ? '/dashboard' : '/onboarding')
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Google sign-in failed'
  }
}
</script>

<template>
  <!-- Heading -->
  <div class="mb-8">
    <h1 class="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Create your account</h1>
    <p class="text-muted-foreground mt-2">Start planning meals with your household</p>
  </div>

  <!-- OAuth -->
  <div class="space-y-3 mb-6">
    <GoogleSignInButton
      text="signup_with"
      @credential="handleGoogleCredential"
      @error="(msg) => formError = msg"
    />
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
  <form @submit.prevent="handleRegister" class="space-y-5">
    <!-- Error -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div v-if="formError" class="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/5 border border-destructive/15 text-sm text-destructive">
        <svg class="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        {{ formError }}
      </div>
    </Transition>

    <!-- Display name -->
    <div class="space-y-2">
      <Label for="name" class="text-sm font-medium text-foreground">Display name</Label>
      <Input
        id="name"
        v-model="displayName"
        placeholder="Sarah Chen"
        required
        autocomplete="name"
        :style="{ height: '2.75rem', borderRadius: '0.75rem', backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)', borderColor: 'color-mix(in oklch, var(--border) 70%, transparent)' }"
      />
    </div>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="reg-email" class="text-sm font-medium text-foreground">Email address</Label>
      <Input
        id="reg-email"
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
      <Label for="reg-password" class="text-sm font-medium text-foreground">Password</Label>
      <div style="position: relative;">
        <Input
          id="reg-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Create a strong password"
          required
          autocomplete="new-password"
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

      <!-- Strength bar -->
      <div v-if="password.length > 0" class="space-y-2.5 pt-1">
        <div class="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="[strength.color, strength.width]"
          />
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div v-for="check in passwordChecks" :key="check.label" class="flex items-center gap-1.5">
            <Check v-if="check.met" class="w-3 h-3 text-emerald-500 shrink-0" />
            <X v-else class="w-3 h-3 text-muted-foreground/40 shrink-0" />
            <span class="text-[11px]" :class="check.met ? 'text-emerald-600 font-medium' : 'text-muted-foreground'">{{ check.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm password -->
    <div class="space-y-2">
      <Label for="confirm-password" class="text-sm font-medium text-foreground">Confirm password</Label>
      <Input
        id="confirm-password"
        v-model="confirmPassword"
        type="password"
        placeholder="Re-enter your password"
        required
        autocomplete="new-password"
        :style="{ height: '2.75rem', borderRadius: '0.75rem', backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)', borderColor: 'color-mix(in oklch, var(--border) 70%, transparent)' }"
      />
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full font-semibold text-sm"
      :style="{ height: '2.75rem', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px color-mix(in oklch, var(--primary) 20%, transparent)' }"
      :disabled="!isValid || auth.loading"
    >
      <Loader2 v-if="auth.loading" class="w-4 h-4 mr-2 animate-spin" />
      Create account
    </Button>
  </form>

  <!-- Footer -->
  <p class="text-center text-sm text-muted-foreground mt-8">
    Already have an account?
    <router-link to="/login" class="text-primary font-semibold hover:text-primary/80 transition-colors">Sign in</router-link>
  </p>
</template>
