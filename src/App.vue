<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { Toaster } from 'vue-sonner'

const route = useRoute()

const layout = computed(() => {
  const l = route.meta.layout as string
  if (l === 'app') return AppLayout
  if (l === 'fullscreen') return null // fullscreen pages render directly
  return AuthLayout
})
</script>

<template>
  <Toaster position="top-right" :toastOptions="{ duration: 4000 }" rich-colors />

  <!-- Fullscreen layout (e.g. Cook Mode) – no wrapper -->
  <router-view v-if="route.meta.layout === 'fullscreen'" />

  <!-- Standard layouts -->
  <component v-else :is="layout">
    <router-view />
  </component>
</template>
