import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const mobileNavOpen = ref(false)
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
    confirmDialog,
    toggleSidebar,
    closeSidebar,
    toggleMobileNav,
    closeMobileNav,
    showConfirm,
    closeConfirm,
    executeConfirm,
  }
})
