import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

type ThemeMode = 'light' | 'dark' | 'system'

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && getSystemDark())
  document.documentElement.classList.toggle('dark', isDark)
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const mobileNavOpen = ref(false)
  const themeMode = ref<ThemeMode>((localStorage.getItem('theme_mode') as ThemeMode) || 'light')
  const confirmDialog = ref<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({
    open: false,
    title: '',
    description: '',
  })

  // Apply theme on init and watch for changes
  applyTheme(themeMode.value)

  watch(themeMode, (mode) => {
    localStorage.setItem('theme_mode', mode)
    applyTheme(mode)
  })

  // Listen for system preference changes when in "system" mode
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themeMode.value === 'system') {
        applyTheme('system')
      }
    })
  }

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleMobileNav() {
    mobileNavOpen.value = !mobileNavOpen.value
  }

  function closeMobileNav() {
    mobileNavOpen.value = false
  }

  function showConfirm(options: {
    title: string
    description: string
    confirmLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }) {
    confirmDialog.value = { ...options, open: true }
  }

  function closeConfirm() {
    confirmDialog.value = { ...confirmDialog.value, open: false }
  }

  function executeConfirm() {
    confirmDialog.value.onConfirm?.()
    closeConfirm()
  }

  return {
    sidebarOpen,
    mobileNavOpen,
    themeMode,
    confirmDialog,
    setTheme,
    toggleSidebar,
    closeSidebar,
    toggleMobileNav,
    closeMobileNav,
    showConfirm,
    closeConfirm,
    executeConfirm,
  }
})
