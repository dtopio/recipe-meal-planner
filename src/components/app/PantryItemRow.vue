<script setup lang="ts">
import type { PantryItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-vue-next'
import { formatDateShort, getTodayDateKey } from '@/utils/date'

defineProps<{
  item: PantryItem
}>()

defineEmits<{
  decrement: []
  increment: []
  remove: []
}>()
</script>

<template>
  <div class="flex items-center gap-4 py-3.5 px-4 transition-all duration-200 group">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <p class="grocery-text text-foreground">{{ item.name }}</p>
        <span
          v-if="item.quantity <= item.lowStockThreshold"
          class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
        >
          <AlertTriangle class="h-3 w-3" />
          Low stock
        </span>
      </div>

      <div class="mt-0.5 flex items-center gap-2.5 text-sm text-muted-foreground">
        <span>{{ item.quantity }} {{ item.unit }}</span>
        <span>Threshold {{ item.lowStockThreshold }}</span>
        <span v-if="item.expiresAt">Expires {{ formatDateShort(item.expiresAt) }}</span>
        <span
          v-if="item.expiresAt && item.expiresAt <= getTodayDateKey()"
          class="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
        >
          Expired
        </span>
      </div>
    </div>

    <div class="flex items-center gap-1.5">
      <Button variant="outline" size="icon" class="h-9 w-9" @click="$emit('decrement')">
        <Minus class="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" class="h-9 w-9" @click="$emit('increment')">
        <Plus class="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" class="h-9 w-9 text-muted-foreground hover:text-destructive" @click="$emit('remove')">
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
