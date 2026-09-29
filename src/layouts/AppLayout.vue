<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onKeyStroke } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { MOD_KEY } from '@/lib/keyboard'
import { visibleMenu } from '@/lib/menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const paletteOpen = ref(false)
// Shortcut pencarian global dengan library @vueuse/core:
// Menangani Ctrl+K, ⌘+K, dan Alt+K dari mana saja
onKeyStroke(['k', 'K'], (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    e.preventDefault()
    drawerOpen.value = false
    paletteOpen.value = !paletteOpen.value
  }
})

// Shortcut tombol '/' saat tidak sedang mengetik di input/textarea
onKeyStroke('/', (e) => {
  const target = e.target
  const tag = target?.tagName
  const isEditable = target?.isContentEditable
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !isEditable) {
    e.preventDefault()
    drawerOpen.value = false
    paletteOpen.value = true
  }
})

const ICON = {
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  back: 'M15.75 19.5L8.25 12l7.5-7.5',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  close: 'M6 18L18 6M6 6l12 12',
}

const startsWith = (path, to) => (to === '/' ? path === '/' : path.startsWith(to))
const isActive = (item) => [item.to, ...(item.match ?? [])].some((to) => startsWith(route.path, to))

/** Grup menu sesuai role: semua item tampil di rail (dipisah per grup); item grup aktif = tab di header. */
const groups = computed(() => visibleMenu(auth.hasRole))
const activeGroup = computed(() => groups.value.find((group) => group.items.some(isActive)))

// Tombol kembali hanya bila ada halaman sebelumnya di dalam aplikasi (vue-router menyimpannya di history.state)
const canGoBack = computed(() => route.fullPath && !!window.history.state?.back)

const initials = computed(() =>
  (auth.user?.name ?? '')
    .replace(/^(dr|drg|ns)\.?\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase(),
)

watch(() => route.fullPath, () => (drawerOpen.value = false))

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen">
    <!-- ===== Header ===== -->
    <header class="flex items-center gap-4 px-4 pt-4 sm:px-6 lg:gap-6 lg:pt-5 lg:pr-8 lg:pl-5 print:hidden">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2.5" aria-label="E-Klinik, ke dashboard">
        <span class="grid size-11 place-items-center rounded-2xl bg-brand-900 text-white shadow-lg shadow-sky-600/30 inset-shadow-dark">
          <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" /></svg>
        </span>
        <span class="text-[22px] leading-none tracking-tight text-slate-900"><b class="font-bold">e</b><span class="font-light">-klinik</span></span>
      </RouterLink>

      <!-- Tab halaman dalam grup aktif (desktop) -->
      <nav v-if="activeGroup" class="tabs mx-auto hidden lg:inline-flex" aria-label="Halaman">
        <RouterLink v-for="item in activeGroup.items" :key="item.to" :to="item.to" :class="{ 'tab-active': isActive(item) }" class="tab">
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2.5 sm:gap-3 lg:ml-0">
        <!-- Tombol Global Search (Algolia) tepat di samping profil kanan atas -->
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border border-white/90 bg-white/75 py-1.5 pr-2.5 pl-3 text-sm font-medium text-slate-600 shadow-xs transition hover:border-[#003DFF]/40 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003DFF]/30 active:scale-95"
          :aria-label="`Pencarian (${MOD_KEY}+K)`"
          title="Cari modul atau menu (Ctrl+K)"
          @click="paletteOpen = true"
        >
          <span class="grid size-5 place-items-center text-[#003DFF]">
            <AppIcon :path="ICON.search" size="size-4" />
          </span>
          <span class="hidden text-xs text-slate-500 sm:inline xl:text-sm">Cari modul…</span>
          <span class="flex items-center gap-0.5">
            <kbd class="kbd text-[10px]">{{ MOD_KEY }}</kbd>
            <kbd class="kbd text-[10px]">K</kbd>
          </span>
        </button>

        <!-- Garis pemisah halus di samping profil -->
        <span class="hidden h-5 w-px bg-slate-900/10 sm:block" aria-hidden="true" />

        <!-- Profil Pengguna (Nama & Avatar) di kanan atas -->
        <div class="flex items-center gap-2.5">
          <div class="hidden text-right leading-tight xl:block">
            <p class="text-sm font-semibold text-slate-900">{{ auth.user?.name }}</p>
            <p class="text-xs text-slate-500">{{ auth.user?.role_label }}<template v-if="auth.user?.poli"> · {{ auth.user.poli.nama }}</template></p>
          </div>
          <div
            class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white shadow-lg ring-2 shadow-sky-600/25 ring-white"
            :title="auth.user?.name"
          >
            {{ initials }}
          </div>
        </div>

        <button class="btn-icon hidden lg:grid" title="Keluar" aria-label="Keluar" @click="logout">
          <AppIcon :path="ICON.logout" size="size-4.5" />
        </button>
        <button class="btn-icon lg:hidden" aria-label="Menu" @click="drawerOpen = true">
          <AppIcon :path="ICON.menu" size="size-4.5" />
        </button>
      </div>
    </header>

    <!-- Tab halaman (mobile): bisa digeser horizontal -->
    <div v-if="activeGroup" class="overflow-x-auto px-4 pt-3 sm:px-6 lg:hidden print:hidden">
      <nav class="tabs flex-nowrap" aria-label="Halaman">
        <RouterLink v-for="item in activeGroup.items" :key="item.to" :to="item.to" :class="{ 'tab-active': isActive(item) }" class="tab">
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>

    <!-- ===== Rail navigasi (desktop): semua halaman, dipisah per grup, di tengah layar secara vertikal ===== -->
    <aside class="rail fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 flex-col items-center lg:flex print:hidden">
      <button v-if="canGoBack" class="rail-btn" aria-label="Kembali" @click="router.back()">
        <AppIcon :path="ICON.back" size="size-4.5" />
        <span class="rail-tip">Kembali</span>
      </button>
      <nav class="rail-nav glass flex flex-col items-center rounded-full p-1.5" aria-label="Menu utama">
        <template v-for="(group, gi) in groups" :key="group.label">
          <span v-if="gi > 0" class="rail-sep h-px w-5 shrink-0 bg-slate-900/10" aria-hidden="true" />
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            :aria-label="item.label"
            :aria-current="isActive(item) ? 'page' : undefined"
            :class="{ 'rail-btn-active': isActive(item) }"
            class="rail-btn"
          >
            <AppIcon :path="item.icon" size="size-[1.15rem]" />
            <span class="rail-tip">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>
    </aside>

    <!-- ===== Drawer menu (mobile) ===== -->
    <Transition enter-from-class="opacity-0" enter-active-class="transition duration-200" leave-to-class="opacity-0" leave-active-class="transition duration-150">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden" @click="drawerOpen = false" />
    </Transition>
    <Transition enter-from-class="-translate-x-[110%]" enter-active-class="transition duration-300" leave-to-class="-translate-x-[110%]" leave-active-class="transition duration-200">
      <aside v-if="drawerOpen" class="glass-strong fixed inset-y-3 left-3 z-50 flex w-72 flex-col rounded-3xl lg:hidden" aria-label="Menu">
        <div class="flex items-center justify-between px-5 pt-5 pb-2">
          <span class="text-[22px] leading-none tracking-tight text-slate-900"><b class="font-bold">e</b><span class="font-light">-klinik</span></span>
          <button class="btn-icon size-9" aria-label="Tutup menu" @click="drawerOpen = false"><AppIcon :path="ICON.close" size="size-4" /></button>
        </div>
        <nav class="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          <div v-for="group in groups" :key="group.label">
            <p class="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{{ group.label }}</p>
            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :class="isActive(item) ? 'bg-brand-900 text-white shadow-lg shadow-sky-600/25' : 'text-slate-600 hover:bg-white hover:text-slate-900'"
              class="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition"
            >
              <AppIcon :path="item.icon" size="size-4.5" />
              {{ item.label }}
            </RouterLink>
          </div>
        </nav>
        <div class="m-3 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/65 p-3">
          <div class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white">{{ initials }}</div>
          <div class="min-w-0 flex-1 leading-tight">
            <p class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</p>
            <p class="truncate text-xs text-slate-500">{{ auth.user?.role_label }}</p>
          </div>
          <button class="btn-icon size-9" title="Keluar" aria-label="Keluar" @click="logout"><AppIcon :path="ICON.logout" size="size-4" /></button>
        </div>
      </aside>
    </Transition>

    <CommandPalette v-model="paletteOpen" />

    <!-- ===== Konten ===== -->
    <main class="mx-auto max-w-[96rem] px-4 pt-5 pb-10 sm:px-6 lg:pt-4 lg:pr-8 lg:pl-[6.5rem] print:p-0">
      <RouterView />
    </main>
  </div>
</template>
