<script setup>
import AppBackground from '@/components/AppBackground.vue'
import ToastHost from '@/components/ToastHost.vue'
import TopProgress from '@/components/TopProgress.vue'
</script>

<template>
  <AppBackground />
  <TopProgress />
  <RouterView />
  <ToastHost />
</template>
