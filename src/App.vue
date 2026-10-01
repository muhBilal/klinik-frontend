<script setup>
import AppBackground from '@/components/AppBackground.vue'
import ToastHost from '@/components/ToastHost.vue'
import TopProgress from '@/components/TopProgress.vue'
import { useThemeStore } from '@/stores/theme'

useThemeStore()
</script>

<template>
  <AppBackground />
  <TopProgress />
  <RouterView />
  <ToastHost />
</template>
