<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onKeyStroke, useIdle } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { MOD_KEY } from '@/lib/keyboard'
import { visibleMenu } from '@/lib/menu'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useThemeStore } from '@/stores/theme'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const klinik = useKlinikStore()
const theme = useThemeStore()
const toast = useToastStore()
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

const ICON_THEME = {
  light: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.236l-1.591 1.591M5.25 12H3m4.236-4.773L5.645 5.636M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z',
  dark: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  system: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3',
}

// Navigasi terakhir per modul di sessionStorage (per tab; dikosongkan auth.clear() saat logout — perangkat bersama).
// Baca/tulis aman bila storage diblokir.
function baca(key, cadangan = null) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) ?? cadangan
  } catch {
    return cadangan
  }
}
function simpan(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* abaikan */
  }
}

const startsWith = (path, to) => (to === '/' ? path === '/' : path.startsWith(to))
const cocok = (path, item) => [item.to, ...(item.match ?? [])].some((to) => startsWith(path, to))
const isActive = (item) => cocok(route.path, item)

/**
 * Rail kiri = daftar MODUL (grup menu, satu tombol per modul); navbar = halaman milik modul yang dipilih.
 * Modul terpilih = modul halaman yang sedang dibuka. Halaman di luar menu (profil, detail kunjungan) tetap
 * menampilkan modul terakhir agar navbar tidak kosong.
 */
const groups = computed(() => visibleMenu(auth.can))
const modulRute = computed(() => groups.value.find((group) => group.items.some(isActive)) ?? null)
const modulTerakhir = ref(baca('eklinik_modul'))
const activeGroup = computed(() => modulRute.value ?? groups.value.find((g) => g.key === modulTerakhir.value) ?? null)

// Membuka modul kembali ke halaman terakhir yang dibuka di modul itu (mis. tetap di detail pasien yang tadi dibuka).
const halamanTerakhir = reactive(baca('eklinik_modul_halaman', {}))
watch(
  () => route.fullPath,
  () => {
    const modul = modulRute.value
    if (!modul) return
    modulTerakhir.value = modul.key
    halamanTerakhir[modul.key] = route.fullPath
    simpan('eklinik_modul', modul.key)
    simpan('eklinik_modul_halaman', halamanTerakhir)
  },
  { immediate: true },
)

function tujuanModul(group) {
  const terakhir = halamanTerakhir[group.key]
  return terakhir && group.items.some((item) => cocok(terakhir.split('?')[0], item)) ? terakhir : group.items[0].to
}

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

klinik.muat()

/** User lintas cabang memilih cabang aktif; halaman dimuat ulang agar semua data mengikuti cabang baru. */
function gantiCabang(event) {
  auth.setCabang(event.target.value)
  window.location.reload()
}

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// Sesi berakhir bila tidak ada interaksi (mouse/keyboard/sentuh) selama batas idle pengaturan klinik (PRD 7.2).
// Backend juga menolak token yang idle; ini menutup sesi di layar meski halaman melakukan auto-refresh.
const { idle } = useIdle((auth.user?.sesi?.idle_timeout_menit ?? 15) * 60 * 1000)
watch(idle, async (value) => {
  if (!value || !auth.isLoggedIn) return
  await auth.logout().catch(() => {})
  toast.info('Sesi diakhiri karena tidak ada aktivitas.')
  router.push({ name: 'login' })
})
</script>

<template>
  <div class="min-h-screen">
    <!-- ===== Header: logo, halaman modul terpilih (tab), alat ===== -->
    <header class="flex items-center gap-4 px-4 pt-4 sm:px-6 lg:gap-6 lg:pt-5 lg:pr-8 lg:pl-5 print:hidden">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2.5" :aria-label="`${klinik.nama}, ke dashboard`" :title="klinik.nama">
        <AppLogo class="size-11 drop-shadow-[0_6px_10px_rgba(5,103,181,0.25)]" />
        <!-- <span class="text-[22px] leading-none tracking-tight text-slate-900"><b class="font-bold">lefa</b><span class="font-light">klinik</span></span> -->
      </RouterLink>

      <!-- Tab halaman dari modul yang dipilih di rail (desktop) -->
      <nav v-if="activeGroup" class="tabs mx-auto hidden lg:inline-flex" :aria-label="`Halaman ${activeGroup.label}`">
        <RouterLink
          v-for="item in activeGroup.items"
          :key="item.to"
          :to="item.to"
          :aria-current="isActive(item) ? 'page' : undefined"
          :class="{ 'tab-active': isActive(item) }"
          class="tab"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2.5 sm:gap-3 lg:ml-0">
        <!-- Cabang aktif: pemilih untuk user lintas cabang, label untuk staf cabang -->
        <select
          v-if="auth.lintasCabang && auth.cabangs.length > 1"
          :value="auth.cabangAktif"
          class="input hidden w-auto max-w-48 py-1.5 text-sm md:block"
          aria-label="Cabang aktif"
          title="Cabang aktif"
          @change="gantiCabang"
        >
          <option value="">Semua cabang</option>
          <option v-for="c in auth.cabangs" :key="c.id" :value="String(c.id)">{{ c.nama }}</option>
        </select>
        <span v-else-if="auth.cabang" class="chip hidden md:inline-flex" title="Cabang tempat Anda bertugas">{{ auth.cabang.nama }}</span>

        <!-- Tombol Global Search -->
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border border-white/90 bg-white/75 py-1.5 pr-2.5 pl-3 text-sm font-medium text-slate-600 shadow-xs transition hover:border-[#003DFF]/40 hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003DFF]/30 active:scale-95 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          :aria-label="`Pencarian (${MOD_KEY}+K)`"
          title="Cari modul atau menu (Ctrl+K)"
          @click="paletteOpen = true"
        >
          <span class="grid size-5 place-items-center text-[#003DFF]">
            <AppIcon :path="ICON.search" size="size-4" />
          </span>
          <span class="hidden text-xs text-slate-500 sm:inline xl:text-sm dark:text-slate-400">Cari modul…</span>
          <span class="flex items-center gap-0.5">
            <kbd class="kbd text-[10px]">{{ MOD_KEY }}</kbd>
            <kbd class="kbd text-[10px]">K</kbd>
          </span>
        </button>

        <!-- Tombol Switch Tema (Light / Dark / System) -->
        <button
          type="button"
          class="btn-icon"
          :title="`Tema: ${theme.mode === 'light' ? 'Terang' : theme.mode === 'dark' ? 'Gelap' : 'Otomatis'}. Klik untuk mengubah tema.`"
          :aria-label="`Ubah tema (saat ini ${theme.mode})`"
          @click="theme.toggleMode()"
        >
          <AppIcon :path="ICON_THEME[theme.mode]" size="size-4.5" />
        </button>

        <span class="hidden h-5 w-px bg-slate-900/10 dark:bg-slate-700 sm:block" aria-hidden="true" />

        <!-- Profil Pengguna (Nama & Avatar) -> halaman profil & keamanan akun -->
        <RouterLink to="/profil" class="flex items-center gap-2.5" title="Profil & keamanan akun">
          <div class="hidden text-right leading-tight xl:block">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ auth.user?.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ auth.user?.role_label }}<template v-if="auth.user?.poli"> · {{ auth.user.poli.nama }}</template></p>
          </div>
          <div
            class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white shadow-lg ring-2 shadow-sky-600/25 ring-white dark:ring-slate-900"
            :title="auth.user?.name"
          >
            {{ initials }}
          </div>
        </RouterLink>

        <button class="btn-icon hidden lg:grid" title="Keluar" aria-label="Keluar" @click="logout">
          <AppIcon :path="ICON.logout" size="size-4.5" />
        </button>
        <button class="btn-icon lg:hidden" aria-label="Menu" @click="drawerOpen = true">
          <AppIcon :path="ICON.menu" size="size-4.5" />
        </button>
      </div>
    </header>

    <!-- Halaman modul (mobile): bisa digeser horizontal -->
    <div v-if="activeGroup" class="overflow-x-auto px-4 pt-3 sm:px-6 lg:hidden print:hidden">
      <nav class="tabs flex-nowrap" :aria-label="`Halaman ${activeGroup.label}`">
        <RouterLink v-for="item in activeGroup.items" :key="item.to" :to="item.to" :class="{ 'tab-active': isActive(item) }" class="tab">
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>

    <!-- ===== Rail modul (desktop): satu tombol per modul, di tengah layar secara vertikal ===== -->
    <aside class="rail fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 flex-col items-center lg:flex print:hidden" aria-label="Modul">
      <button v-if="canGoBack" class="rail-btn" aria-label="Kembali" @click="router.back()">
        <AppIcon :path="ICON.back" size="size-4.5" />
        <span class="rail-tip">Kembali</span>
      </button>
      <nav class="rail-nav glass flex flex-col items-center rounded-full p-1.5" aria-label="Modul">
        <RouterLink
          v-for="group in groups"
          :key="group.key"
          :to="tujuanModul(group)"
          :aria-label="group.label"
          :aria-current="activeGroup?.key === group.key ? 'true' : undefined"
          :class="{ 'rail-btn-active': activeGroup?.key === group.key }"
          class="rail-btn"
        >
          <AppIcon :path="group.icon" size="size-[1.15rem]" />
          <span class="rail-tip">{{ group.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <!-- ===== Drawer menu (mobile): modul beserta halamannya ===== -->
    <Transition enter-from-class="opacity-0" enter-active-class="transition duration-200" leave-to-class="opacity-0" leave-active-class="transition duration-150">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden" @click="drawerOpen = false" />
    </Transition>
    <Transition enter-from-class="-translate-x-[110%]" enter-active-class="transition duration-300" leave-to-class="-translate-x-[110%]" leave-active-class="transition duration-200">
      <aside v-if="drawerOpen" class="glass-strong fixed inset-y-3 left-3 z-50 flex w-72 flex-col rounded-3xl lg:hidden" aria-label="Menu">
        <div class="flex items-center justify-between px-5 pt-5 pb-2">
          <span class="flex items-center gap-2 text-[22px] leading-none tracking-tight text-slate-900 dark:text-white">
            <AppLogo class="size-8" /><span><b class="font-bold">lefa</b><span class="font-light">klinik</span></span>
          </span>
          <button class="btn-icon size-9" aria-label="Tutup menu" @click="drawerOpen = false"><AppIcon :path="ICON.close" size="size-4" /></button>
        </div>
        <nav class="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          <div v-for="group in groups" :key="group.key">
            <p class="mb-1.5 flex items-center gap-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-400">
              <AppIcon :path="group.icon" size="size-3.5" />{{ group.label }}
            </p>
            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :class="isActive(item) ? 'bg-brand-900 text-white shadow-lg shadow-sky-600/25' : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'"
              class="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition"
            >
              <AppIcon :path="item.icon" size="size-4.5" />
              {{ item.label }}
            </RouterLink>
          </div>
        </nav>
        <div v-if="auth.lintasCabang && auth.cabangs.length > 1" class="mx-3 md:hidden">
          <label class="label" for="cabang-drawer">Cabang aktif</label>
          <select id="cabang-drawer" :value="auth.cabangAktif" class="input" @change="gantiCabang">
            <option value="">Semua cabang</option>
            <option v-for="c in auth.cabangs" :key="c.id" :value="String(c.id)">{{ c.nama }}</option>
          </select>
        </div>
        <div class="m-3 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/65 p-3 dark:border-slate-800 dark:bg-slate-900/80">
          <RouterLink to="/profil" class="flex min-w-0 flex-1 items-center gap-3" title="Profil & keamanan akun">
            <div class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white">{{ initials }}</div>
            <div class="min-w-0 flex-1 leading-tight">
              <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ auth.user?.name }}</p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ auth.user?.role_label }}</p>
            </div>
          </RouterLink>
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
