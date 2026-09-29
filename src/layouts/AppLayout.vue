<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { MENU } from '@/lib/menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

const menu = computed(() =>
  MENU.map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || auth.hasRole(...item.roles)) })).filter(
    (group) => group.items.length,
  ),
)

const isActive = (to) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

const initials = computed(() =>
  (auth.user?.name ?? '')
    .replace(/^(dr|drg|ns)\.?\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
)

watch(() => route.fullPath, () => (sidebarOpen.value = false))

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Sidebar -->
    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" @click="sidebarOpen = false" />
    <aside
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 text-brand-50 transition-transform lg:translate-x-0 print:hidden"
    >
      <div class="flex h-16 items-center gap-2.5 px-5">
        <div class="grid size-9 place-items-center rounded-lg bg-white/10">
          <svg class="size-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></svg>
        </div>
        <div>
          <p class="text-sm leading-tight font-semibold">E-Klinik</p>
          <p class="text-xs text-brand-100/70">Sistem Informasi Klinik</p>
        </div>
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <div v-for="(group, gi) in menu" :key="gi">
          <p v-if="group.title" class="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-brand-100/50 uppercase">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :class="isActive(item.to) ? 'bg-white/15 text-white' : 'text-brand-100/80 hover:bg-white/5 hover:text-white'"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <AppIcon :path="item.icon" />
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>

      <div class="border-t border-white/10 p-3">
        <div class="flex items-center gap-3 rounded-lg px-2 py-2">
          <div class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold">{{ initials }}</div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ auth.user?.name }}</p>
            <p class="truncate text-xs text-brand-100/60">{{ auth.user?.role_label }}<template v-if="auth.user?.poli"> · {{ auth.user.poli.nama }}</template></p>
          </div>
          <button class="rounded-lg p-1.5 text-brand-100/70 hover:bg-white/10 hover:text-white" title="Keluar" @click="logout">
            <AppIcon path="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Konten -->
    <div class="lg:pl-64 print:pl-0">
      <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden print:hidden">
        <button class="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Menu" @click="sidebarOpen = true">
          <AppIcon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </button>
        <span class="font-semibold">E-Klinik</span>
      </header>

      <main class="mx-auto max-w-7xl p-4 sm:p-6 print:p-0">
        <RouterView />
      </main>
    </div>
  </div>
</template>
