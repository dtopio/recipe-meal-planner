<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { LogOut, User, Bell, Accessibility, Moon } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.push('/login')
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
          <Input id="settings-name" :model-value="auth.user?.displayName" placeholder="Your name" />
        </div>
        <div class="space-y-2">
          <Label for="settings-email">Email</Label>
          <Input id="settings-email" :model-value="auth.user?.email" disabled />
        </div>
        <Button size="sm" class="shadow-md shadow-primary/10 press-scale">Save changes</Button>
      </div>
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
          <Switch :checked="true" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Meal plan reminders</p>
            <p class="text-xs text-muted-foreground">Daily reminder about tonight's meal</p>
          </div>
          <Switch :checked="true" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">New member joins</p>
            <p class="text-xs text-muted-foreground">When someone joins your household</p>
          </div>
          <Switch :checked="false" />
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
          <Switch :checked="false" />
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Reduce motion</p>
            <p class="text-xs text-muted-foreground">Minimize animations and transitions</p>
          </div>
          <Switch :checked="false" />
        </div>
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
