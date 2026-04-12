<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useHouseholdStore } from '@/stores/household'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { LogOut, User, Bell, Accessibility, ShieldCheck, Activity, Sun, Moon, Monitor, Palette, Lock, Trash2 } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { toast } from 'vue-sonner'
import { DEFAULT_HEALTH_TARGETS, DEFAULT_MEAL_PERIODS } from '@/types'
import type { DietaryPreference, HealthTargets, MealType } from '@/types'
import { formatMealPeriodLabel, normalizeMealPeriod } from '@/utils/meal-periods'

const router = useRouter()
const auth = useAuthStore()
const household = useHouseholdStore()
const ui = useUiStore()
const displayName = ref(auth.user?.displayName || '')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const deletePassword = ref('')
const dietaryPreferences = ref<DietaryPreference[]>([])
const mealPeriods = ref<MealType[]>([...DEFAULT_MEAL_PERIODS])
const newMealPeriod = ref('')
const healthTargets = ref<HealthTargets>({ ...DEFAULT_HEALTH_TARGETS })

const dietaryOptions: { value: DietaryPreference; label: string; description: string }[] = [
  {
    value: 'vegetarian',
    label: 'Vegetarian',
    description: 'Hide or warn on recipes that contain meat or seafood.',
  },
  {
    value: 'halal',
    label: 'Halal',
    description: 'Warn on pork, alcohol, and other likely non-halal ingredients.',
  },
  {
    value: 'nut-free',
    label: 'Nut-free',
    description: 'Flag recipes that likely include peanuts or tree nuts.',
  },
  {
    value: 'dairy-free',
    label: 'Dairy-free',
    description: 'Flag recipes that likely contain milk, butter, cheese, or cream.',
  },
]

const preferencesDirty = computed(() => {
  const persistedDietary = [...(household.preferences?.dietaryPreferences || [])].sort().join(',')
  const draftDietary = [...dietaryPreferences.value].sort().join(',')
  const persistedPeriods = [...(household.preferences?.mealPeriods || DEFAULT_MEAL_PERIODS)].join(',')
  const draftPeriods = [...mealPeriods.value].join(',')
  return persistedDietary !== draftDietary || persistedPeriods !== draftPeriods
})

const healthTargetsDirty = computed(() => {
  const persisted = auth.user?.healthTargets || DEFAULT_HEALTH_TARGETS
  return ['calories', 'protein', 'carbs', 'fat'].some(key => (
    Number(healthTargets.value[key as keyof HealthTargets]) !== Number(persisted[key as keyof HealthTargets])
  ))
})

const healthTargetsValid = computed(() => (
  ['calories', 'protein', 'carbs', 'fat'].every(key => Number(healthTargets.value[key as keyof HealthTargets]) > 0)
))

onMounted(async () => {
  if (localStorage.getItem('household_id') && !household.household) {
    await household.loadHousehold()
  }
})

watch(() => auth.user?.displayName, value => {
  displayName.value = value || ''
}, { immediate: true })

watch(() => auth.user?.healthTargets, value => {
  healthTargets.value = { ...(value || DEFAULT_HEALTH_TARGETS) }
}, { immediate: true })

watch(() => household.preferences?.dietaryPreferences, value => {
  dietaryPreferences.value = [...(value || [])]
}, { immediate: true })

watch(() => household.preferences?.mealPeriods, value => {
  mealPeriods.value = [...(value?.length ? value : DEFAULT_MEAL_PERIODS)]
}, { immediate: true })

function handleLogout() {
  auth.logout()
  router.push('/login')
}

function hasPreference(preference: DietaryPreference) {
  return dietaryPreferences.value.includes(preference)
}

function setPreference(preference: DietaryPreference, enabled: boolean) {
  if (enabled) {
    if (!dietaryPreferences.value.includes(preference)) {
      dietaryPreferences.value = [...dietaryPreferences.value, preference]
    }
    return
  }

  dietaryPreferences.value = dietaryPreferences.value.filter(value => value !== preference)
}

function hasMealPeriod(period: string) {
  const normalized = normalizeMealPeriod(period)
  return mealPeriods.value.includes(normalized)
}

function addMealPeriod(period = newMealPeriod.value) {
  const normalized = normalizeMealPeriod(period)

  if (!normalized) {
    return
  }

  if (hasMealPeriod(normalized)) {
    newMealPeriod.value = ''
    return
  }

  if (mealPeriods.value.length >= 8) {
    toast.error('Keep meal periods to 8 or fewer')
    return
  }

  mealPeriods.value = [...mealPeriods.value, normalized]
  newMealPeriod.value = ''
}

function removeMealPeriod(period: MealType) {
  if (mealPeriods.value.length <= 1) {
    toast.error('At least one meal period is required')
    return
  }

  mealPeriods.value = mealPeriods.value.filter(value => value !== period)
}

async function handleSaveProfile() {
  try {
    await auth.updateProfile(displayName.value)
    toast.success('Profile updated')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update profile')
  }
}

async function handleSavePreferences() {
  try {
    await household.updatePreferences({
      dietaryPreferences: dietaryPreferences.value,
      mealPeriods: mealPeriods.value,
    })
    toast.success('Household preferences updated')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update household preferences')
  }
}

async function handleChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    toast.error('New passwords do not match')
    return
  }
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toast.success('Password changed. All other sessions have been signed out.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to change password')
  }
}

function handleDeleteAccount() {
  ui.showConfirm({
    title: 'Delete your account?',
    description: 'This will permanently delete your account, remove you from your household, and erase your personal data. This cannot be undone.',
    confirmLabel: 'Delete my account',
    variant: 'destructive',
    onConfirm: async () => {
      if (!deletePassword.value) {
        toast.error('Enter your password to confirm')
        return
      }
      try {
        await auth.deleteAccount(deletePassword.value)
        router.push('/login')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete account')
      }
    },
  })
}

async function handleSaveHealthTargets() {
  try {
    await auth.updateHealthTargets({
      calories: Number(healthTargets.value.calories),
      protein: Number(healthTargets.value.protein),
      carbs: Number(healthTargets.value.carbs),
      fat: Number(healthTargets.value.fat),
    })
    toast.success('Health targets updated')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update health targets')
  }
}
</script>

<template>
  <PageHeader title="Settings" description="Manage your profile and preferences" />

  <div class="max-w-2xl space-y-6">
    <!-- Profile -->
    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <User class="w-4 h-4 text-primary" />
        </div>
        Profile
      </h3>

      <div class="flex items-center gap-4 mb-6">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
          {{ auth.initials }}
        </div>
        <div>
          <p class="font-semibold text-foreground">{{ auth.displayName }}</p>
          <p class="text-sm text-muted-foreground">{{ auth.user?.email }}</p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="settings-name">Display name</Label>
          <Input id="settings-name" v-model="displayName" placeholder="Your name" />
        </div>
        <div class="space-y-2">
          <Label for="settings-email">Email</Label>
          <Input id="settings-email" :model-value="auth.user?.email" disabled />
        </div>
        <Button
          size="sm"
          class="shadow-md shadow-primary/10 press-scale"
          :disabled="!displayName.trim() || auth.loading"
          @click="handleSaveProfile"
        >
          Save changes
        </Button>
      </div>
    </div>

    <!-- Appearance -->
    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Palette class="w-4 h-4 text-primary" />
        </div>
        Appearance
      </h3>

      <p class="text-sm text-muted-foreground mb-5">
        Choose how MealSync looks. System will follow your device settings.
      </p>

      <div class="grid grid-cols-3 gap-3">
        <button
          @click="ui.setTheme('light')"
          class="flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all press-scale"
          :class="ui.themeMode === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'"
        >
          <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
            <Sun class="w-5 h-5 text-amber-600" />
          </div>
          <span class="text-sm font-semibold" :class="ui.themeMode === 'light' ? 'text-primary' : 'text-muted-foreground'">Light</span>
        </button>

        <button
          @click="ui.setTheme('dark')"
          class="flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all press-scale"
          :class="ui.themeMode === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'"
        >
          <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <Moon class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span class="text-sm font-semibold" :class="ui.themeMode === 'dark' ? 'text-primary' : 'text-muted-foreground'">Dark</span>
        </button>

        <button
          @click="ui.setTheme('system')"
          class="flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all press-scale"
          :class="ui.themeMode === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'"
        >
          <div class="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Monitor class="w-5 h-5 text-muted-foreground" />
          </div>
          <span class="text-sm font-semibold" :class="ui.themeMode === 'system' ? 'text-primary' : 'text-muted-foreground'">System</span>
        </button>
      </div>
    </div>

    <div v-if="household.household" class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck class="w-4 h-4 text-primary" />
        </div>
        Household Preferences
      </h3>

      <p class="text-sm text-muted-foreground mb-5">
        These preferences drive recipe warnings, planner layout, recipe filtering, and shopping generation across the household.
      </p>

      <div class="space-y-4">
        <div>
          <p class="text-sm font-semibold text-foreground">Meal periods</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Customize the planner rows for this household. These periods show up across the planner and weekly report.
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="period in mealPeriods"
              :key="period"
              class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              {{ formatMealPeriodLabel(period) }}
              <button
                type="button"
                class="rounded-full text-primary/70 transition-colors hover:text-primary"
                @click="removeMealPeriod(period)"
              >
                ×
              </button>
            </span>
          </div>

          <div class="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              v-model="newMealPeriod"
              placeholder="Add a period like snack or supper"
              class="flex-1"
              @keydown.enter.prevent="addMealPeriod()"
            />
            <Button variant="outline" type="button" class="press-scale" @click="addMealPeriod()">
              Add period
            </Button>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="preset in ['snack', 'brunch', 'supper', 'dessert']"
              :key="preset"
              type="button"
              class="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary"
              :disabled="hasMealPeriod(preset)"
              @click="addMealPeriod(preset)"
            >
              Add {{ formatMealPeriodLabel(preset) }}
            </button>
          </div>
        </div>

        <Separator />

        <div>
          <p class="text-sm font-semibold text-foreground">Dietary guardrails</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Household dietary rules show warnings on recipes and help filter what should be planned.
          </p>
        </div>

        <div
          v-for="option in dietaryOptions"
          :key="option.value"
          class="flex items-start justify-between gap-4"
        >
          <div>
            <p class="text-sm font-medium text-foreground">{{ option.label }}</p>
            <p class="text-xs text-muted-foreground mt-1">{{ option.description }}</p>
          </div>
          <Switch
            :model-value="hasPreference(option.value)"
            @update:model-value="setPreference(option.value, Boolean($event))"
          />
        </div>
      </div>

      <div v-if="dietaryPreferences.length" class="flex flex-wrap gap-2 mt-5">
        <span
          v-for="preference in dietaryPreferences"
          :key="preference"
          class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        >
          {{ preference }}
        </span>
      </div>

      <Button
        size="sm"
        class="mt-5 shadow-md shadow-primary/10 press-scale"
        :disabled="!preferencesDirty || household.loading"
        @click="handleSavePreferences"
      >
        Save household preferences
      </Button>
    </div>

    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Activity class="w-4 h-4 text-primary" />
        </div>
        Health Targets
      </h3>

      <p class="text-sm text-muted-foreground mb-5">
        Set your personal daily targets so the dashboard can flag when calories, protein, carbs, or fat are off pace.
      </p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="target-calories">Daily calories</Label>
          <Input id="target-calories" v-model.number="healthTargets.calories" type="number" min="1" step="10" />
        </div>
        <div class="space-y-2">
          <Label for="target-protein">Daily protein (g)</Label>
          <Input id="target-protein" v-model.number="healthTargets.protein" type="number" min="1" step="1" />
        </div>
        <div class="space-y-2">
          <Label for="target-carbs">Daily carbs (g)</Label>
          <Input id="target-carbs" v-model.number="healthTargets.carbs" type="number" min="1" step="1" />
        </div>
        <div class="space-y-2">
          <Label for="target-fat">Daily fat (g)</Label>
          <Input id="target-fat" v-model.number="healthTargets.fat" type="number" min="1" step="1" />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Weekly calories: {{ healthTargets.calories * 7 }}
        </span>
        <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Weekly protein: {{ healthTargets.protein * 7 }}g
        </span>
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          Weekly carbs: {{ healthTargets.carbs * 7 }}g
        </span>
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          Weekly fat: {{ healthTargets.fat * 7 }}g
        </span>
      </div>

      <Button
        size="sm"
        class="mt-5 shadow-md shadow-primary/10 press-scale"
        :disabled="!healthTargetsDirty || !healthTargetsValid || auth.loading"
        @click="handleSaveHealthTargets"
      >
        Save health targets
      </Button>
    </div>

    <!-- Notifications -->
    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bell class="w-4 h-4 text-primary" />
        </div>
        Notifications
      </h3>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Shopping list updates</p>
            <p class="text-xs text-muted-foreground">Get notified when items are checked off</p>
          </div>
          <Switch :model-value="true" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Meal plan reminders</p>
            <p class="text-xs text-muted-foreground">Daily reminder about tonight's meal</p>
          </div>
          <Switch :model-value="true" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">New member joins</p>
            <p class="text-xs text-muted-foreground">When someone joins your household</p>
          </div>
          <Switch :model-value="false" />
        </div>
      </div>
    </div>

    <!-- Accessibility -->
    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Accessibility class="w-4 h-4 text-primary" />
        </div>
        Accessibility
      </h3>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">High contrast mode</p>
            <p class="text-xs text-muted-foreground">Increase contrast for better readability</p>
          </div>
          <Switch :model-value="false" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Reduce motion</p>
            <p class="text-xs text-muted-foreground">Minimize animations and transitions</p>
          </div>
          <Switch :model-value="false" />
        </div>
      </div>
    </div>

    <!-- Change password -->
    <div class="surface-card p-5 lg:p-6">
      <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Lock class="w-4 h-4 text-primary" />
        </div>
        Change Password
      </h3>

      <p class="text-sm text-muted-foreground mb-5">
        Must be at least 8 characters with an uppercase letter, lowercase letter, and a number.
      </p>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="current-password">Current password</Label>
          <Input id="current-password" v-model="currentPassword" type="password" placeholder="Enter current password" />
        </div>
        <div class="space-y-2">
          <Label for="new-password">New password</Label>
          <Input id="new-password" v-model="newPassword" type="password" placeholder="Enter new password" />
        </div>
        <div class="space-y-2">
          <Label for="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" v-model="confirmPassword" type="password" placeholder="Re-enter new password" />
        </div>
        <Button
          size="sm"
          class="shadow-md shadow-primary/10 press-scale"
          :disabled="!currentPassword || !newPassword || !confirmPassword || auth.loading"
          @click="handleChangePassword"
        >
          Change password
        </Button>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="bg-card border border-destructive/20 rounded-2xl shadow-sm p-5 lg:p-6">
      <h3 class="font-bold text-destructive tracking-tight mb-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Trash2 class="w-4 h-4 text-destructive" />
        </div>
        Delete Account
      </h3>

      <p class="text-sm text-muted-foreground mb-5">
        Permanently delete your account and all personal data. If you are the last member of a household, that household and all its data will also be deleted.
      </p>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="delete-password">Confirm your password</Label>
          <Input id="delete-password" v-model="deletePassword" type="password" placeholder="Enter your password" />
        </div>
        <Button
          variant="outline"
          class="w-full text-destructive border-destructive/30 hover:bg-destructive/10 press-scale"
          :disabled="!deletePassword || auth.loading"
          @click="handleDeleteAccount"
        >
          <Trash2 class="w-4 h-4 mr-1.5" /> Delete my account
        </Button>
      </div>
    </div>

    <!-- Sign out -->
    <div class="surface-card p-5">
      <Button variant="outline" class="w-full text-destructive press-scale" @click="handleLogout">
        <LogOut class="w-4 h-4 mr-1.5" /> Sign out
      </Button>
    </div>
  </div>
</template>
