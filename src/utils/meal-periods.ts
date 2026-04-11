import type { Component } from 'vue'
import { Moon, Sparkles, Sun, Sunrise } from 'lucide-vue-next'
import type { HouseholdPreferences, MealType } from '@/types'
import { DEFAULT_MEAL_PERIODS } from '@/types'

export interface MealPeriodDisplay {
  label: string
  icon: Component
  color: string
  bg: string
  gradient: string
  border: string
  emoji: string
}

export function normalizeMealPeriod(value: string): MealType {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function formatMealPeriodLabel(value: string): string {
  const normalized = normalizeMealPeriod(value)
  if (!normalized) return 'Meal'

  return normalized
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getMealPeriods(preferences?: HouseholdPreferences | null): MealType[] {
  const periods = preferences?.mealPeriods?.map(normalizeMealPeriod).filter(Boolean) || []
  return periods.length ? periods : [...DEFAULT_MEAL_PERIODS]
}

export function getMealPeriodDisplay(value: string): MealPeriodDisplay {
  const normalized = normalizeMealPeriod(value)
  const label = formatMealPeriodLabel(normalized)

  if (/breakfast|brunch|morning/.test(normalized)) {
    return {
      label,
      icon: Sunrise,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      gradient: 'from-amber-500/8 to-orange-500/4',
      border: 'border-l-amber-400',
      emoji: 'BR',
    }
  }

  if (/lunch|midday|afternoon/.test(normalized)) {
    return {
      label,
      icon: Sun,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
      gradient: 'from-sky-500/8 to-blue-500/4',
      border: 'border-l-sky-400',
      emoji: 'LU',
    }
  }

  if (/snack|dessert|treat/.test(normalized)) {
    return {
      label,
      icon: Sparkles,
      color: 'text-fuchsia-500',
      bg: 'bg-fuchsia-500/10',
      gradient: 'from-fuchsia-500/8 to-pink-500/4',
      border: 'border-l-fuchsia-400',
      emoji: 'SN',
    }
  }

  return {
    label,
    icon: Moon,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    gradient: 'from-indigo-500/8 to-violet-500/4',
    border: 'border-l-indigo-400',
    emoji: 'DN',
  }
}

export function getPrimaryEveningPeriod(periods: MealType[]): MealType | null {
  const normalized = periods.map(normalizeMealPeriod)

  return normalized.find(period => /dinner|supper|evening/.test(period))
    || normalized.at(-1)
    || null
}
