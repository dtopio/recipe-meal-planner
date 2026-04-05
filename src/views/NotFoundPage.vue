<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-5">
    <div class="text-center max-w-md">
      <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-sm">
        <span class="text-5xl">🍽</span>
      </div>
      <h1 class="text-5xl font-extrabold text-foreground mb-3 tracking-tight">404</h1>
      <p class="text-lg text-muted-foreground mb-8 leading-relaxed">
        Oops! This page doesn't exist.<br class="hidden sm:block" /> Maybe the recipe was moved?
      </p>
      <div class="flex items-center justify-center gap-3">
        <Button @click="router.push('/dashboard')" class="shadow-md shadow-primary/10 press-scale">
          <Home class="w-4 h-4 mr-1.5" /> Go to Dashboard
        </Button>
        <Button variant="outline" @click="router.back()" class="press-scale">
          <ArrowLeft class="w-4 h-4 mr-1.5" /> Go Back
        </Button>
      </div>
    </div>
  </div>
</template>
