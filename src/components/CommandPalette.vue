<script setup>
/**
 * Global Search / Algolia DocSearch Modal untuk E-Klinik.
 * Mendukung shortcut Ctrl/⌘+K, Alt+K, atau '/' dari mana saja.
 * Fitur:
 * - Algolia fuzzy matching & typo tolerance (Damerau-Levenshtein)
 * - Pencarian multi-token instan untuk Menu, Modul, Submodul, Aksi Cepat, dan Pasien
 * - Riwayat pencarian terkini (Recent searches) dengan penyimpanan localStorage
 * - Rekomendasi menu populer saat input kosong
 * - Tampilan kategori hierarki & breadcrumb ala Algolia DocSearch
 * - Highlight karakter yang cocok (aman XSS tanpa v-html)
 * - Navigasi keyboard penuh (↑, ↓, Tab, Enter, Esc)
 * - Footer resmi dengan badge "Search by Algolia"
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { isCanceled } from '@/lib/api'
import {
  algoliaRank,
  clearRecentSearches,
  getRecentSearches,
  highlightSegments,
  removeRecentSearch,
  saveRecentSearch,
} from '@/lib/algoliaSearch'
import { debounce, jenisKelamin } from '@/lib/format'
import { MOD_KEY } from '@/lib/keyboard'
import { visibleMenu } from '@/lib/menu'
import { useAuthStore } from '@/stores/auth'

const open = defineModel({ type: Boolean, default: false })

const router = useRouter()
const auth = useAuthStore()

const ICON = {
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  userPlus: 'M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  close: 'M6 18L18 6M6 6l12 12',
  trash: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  hash: 'M5.25 8.25h13.5m-13.5 7.5h13.5m-1.5-12l-3 16.5m-4.5-16.5l-3 16.5',
  arrowReturn: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3',
  clipboard: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  building: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  theme: 'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.88 2.88M6.75 17.25h.008v.008H6.75v-.008z',
  documentPlus: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
}

const ACTIONS = [
  {
    id: 'aksi:pasien-baru',
    label: 'Tambah Pasien Baru',
    category: 'Aksi Cepat',
    hint: 'Formulir pendaftaran rekam medis pasien baru',
    to: '/pasien?baru=1',
    roles: ['pendaftaran'],
    icon: ICON.userPlus,
    keywords: ['tambah pasien', 'registrasi', 'pasien baru', 'rekam medis baru', 'input pasien'],
  },
  {
    id: 'aksi:daftar-kunjungan',
    label: 'Pendaftaran Kunjungan Baru',
    category: 'Aksi Cepat',
    hint: 'Daftarkan pasien berobat ke antrian poliklinik',
    to: '/pendaftaran',
    roles: ['pendaftaran'],
    icon: ICON.clipboard,
    keywords: ['kunjungan baru', 'daftar poli', 'antrian baru', 'tiket kunjungan'],
  },
  {
    id: 'aksi:obat-baru',
    label: 'Tambah Master Obat',
    category: 'Aksi Cepat',
    hint: 'Input data obat baru ke katalog farmasi',
    to: '/farmasi/obat?baru=1',
    roles: ['apoteker', 'admin'],
    icon: ICON.plus,
    keywords: ['tambah obat', 'farmasi', 'master obat', 'katalog obat', 'input obat'],
  },
  {
    id: 'aksi:poli-baru',
    label: 'Tambah Poliklinik Baru',
    category: 'Aksi Cepat',
    hint: 'Buat unit poliklinik baru pada master data',
    to: '/master/poli?baru=1',
    roles: ['admin'],
    icon: ICON.building,
    keywords: ['tambah poli', 'buat klinik', 'unit baru', 'spesialis'],
  },
  {
    id: 'aksi:tindakan-baru',
    label: 'Tambah Tindakan Medis',
    category: 'Aksi Cepat',
    hint: 'Input tarif & jenis tindakan medis baru',
    to: '/master/tindakan?baru=1',
    roles: ['admin'],
    icon: ICON.documentPlus,
    keywords: ['tambah tindakan', 'tarif baru', 'layanan baru', 'prosedur baru'],
  },
  {
    id: 'aksi:user-baru',
    label: 'Tambah Pengguna / Petugas',
    category: 'Aksi Cepat',
    hint: 'Buat akun staf, dokter, perawat, atau kasir baru',
    to: '/master/user?baru=1',
    roles: ['admin'],
    icon: ICON.userPlus,
    keywords: ['tambah user', 'tambah akun', 'dokter baru', 'perawat baru', 'buat user'],
  },
  {
    id: 'aksi:profil',
    label: 'Profil Saya',
    category: 'Akun & Sesi',
    hint: 'Ubah nama, email, dan password akun Anda',
    to: '/profil',
    icon: ICON.user,
    keywords: ['profil', 'akun saya', 'ganti password', 'ubah email', 'ubah nama', 'password'],
  },
  {
    id: 'aksi:tema',
    label: 'Tema Tampilan',
    category: 'Akun & Sesi',
    hint: 'Ganti warna aksen aplikasi',
    to: '/themes',
    icon: ICON.theme,
    keywords: ['tema', 'warna', 'theme', 'tampilan', 'aksen', 'kustomisasi', 'personalisasi'],
  },
  {
    id: 'aksi:keluar',
    label: 'Keluar / Logout',
    category: 'Akun & Sesi',
    hint: 'Akhiri sesi login pengguna saat ini',
    action: 'logout',
    icon: ICON.logout,
    keywords: ['logout', 'sign out', 'keluar', 'ganti akun', 'tutup sesi'],
  },
]

const query = ref('')
const active = ref(0)
const inputEl = ref(null)
const listEl = ref(null)
const pasiens = ref([])
const pasienLoading = ref(false)
const recents = ref([])
let controller = null
let lastFocus = null

const canSearchPasien = computed(() => auth.hasRole('pendaftaran', 'perawat', 'dokter'))

/**
 * Verifikasi ketat apakah pengguna berhak mengakses modul/item pencarian.
 * Mengecek:
 * 1. Properti `roles` eksplisit pada item
 * 2. `meta.roles` dari route tujuan Vue Router
 * 3. Hak akses pencarian data pasien
 */
function canAccess(item) {
  if (!item) return false
  if (item.action === 'logout') return true

  // 1. Cek peran eksplisit pada item jika didefinisikan
  if (Array.isArray(item.roles) && item.roles.length > 0) {
    if (!auth.hasRole(...item.roles)) {
      return false
    }
  }

  // 2. Pasien hanya dapat diakses oleh role yang diizinkan (pendaftaran, perawat, dokter, admin)
  if (item.kind === 'pasien' && !canSearchPasien.value) {
    return false
  }

  // 3. Cek meta.roles rute Vue Router jika memiliki path 'to'
  if (item.to) {
    try {
      const cleanPath = String(item.to).split('?')[0]
      const resolved = router.resolve(cleanPath)
      const routeRoles = resolved?.matched?.flatMap((r) => r.meta?.roles ?? []) ?? []
      if (routeRoles.length > 0 && !auth.hasRole(...routeRoles)) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

// Daftar semua menu yang dapat diakses oleh user saat ini
const menuEntries = computed(() =>
  visibleMenu(auth.hasRole)
    .flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        id: `menu:${item.to}`,
        kind: 'menu',
        category: item.category || group.label || 'Menu',
        description: item.description || item.hint || '',
      })),
    )
    .filter(canAccess),
)

// Aksi cepat yang diizinkan sesuai role
const actionEntries = computed(() =>
  ACTIONS.filter(canAccess).map((a) => ({
    ...a,
    kind: 'action',
    description: a.hint,
  })),
)

// Pasien hasil pencarian langsung
const pasienEntries = computed(() => {
  if (!canSearchPasien.value) return []
  return pasiens.value
    .map((p) => ({
      id: `pasien:${p.id}`,
      kind: 'pasien',
      category: 'Pasien Terdaftar',
      label: p.nama,
      description: [`RM: ${p.no_rm}`, jenisKelamin(p.jenis_kelamin), p.umur, p.nik ? `NIK: ${p.nik}` : null]
        .filter(Boolean)
        .join(' · '),
      to: `/pasien/${p.id}`,
      icon: ICON.user,
    }))
    .filter(canAccess)
})

// Bagian / Section hasil pencarian Algolia
const sections = computed(() => {
  const trimmed = query.value.trim()

  // Saat input kosong: tampilkan Riwayat Pencarian Terkini & Modul Populer yang berizin
  if (!trimmed) {
    const list = []
    const validRecents = recents.value.filter(canAccess)
    if (validRecents.length) {
      list.push({
        title: 'Pencarian Terkini',
        isRecent: true,
        items: validRecents,
      })
    }
    // Modul Rekomendasi/Utama sesuai role yang diizinkan
    const popularItems = menuEntries.value.filter(canAccess).slice(0, 6)
    if (popularItems.length) {
      list.push({
        title: 'Modul & Navigasi Populer',
        items: popularItems,
      })
    }
    return list
  }

  // Pencarian aktif menggunakan algoritma Algolia fuzzy match
  const rankedMenu = algoliaRank(menuEntries.value, trimmed).filter(canAccess)
  const rankedActions = algoliaRank(actionEntries.value, trimmed).filter(canAccess)
  const rankedPatients = canSearchPasien.value && trimmed.length >= 2 ? pasienEntries.value.filter(canAccess) : []

  const list = [
    { title: 'Menu & Modul', items: rankedMenu },
    { title: 'Aksi Cepat', items: rankedActions },
    { title: 'Data Pasien', items: rankedPatients },
  ].filter((s) => s.items.length)

  // Jika input berupa angka murni (No RM atau NIK), prioritaskan Pasien di atas
  if (/^\d+$/.test(trimmed)) {
    return [...list.filter((s) => s.title === 'Data Pasien'), ...list.filter((s) => s.title !== 'Data Pasien')]
  }

  return list
})

const flat = computed(() => sections.value.flatMap((s) => s.items))
const activeEntry = computed(() => flat.value[active.value])

// Debounce pencarian data pasien ke backend
const searchPasien = debounce(async (q) => {
  controller?.abort()
  if (!canSearchPasien.value || q.trim().length < 2) {
    pasiens.value = []
    pasienLoading.value = false
    return
  }
  const current = (controller = new AbortController())
  pasienLoading.value = true
  try {
    const { data } = await api.get('/pasiens', {
      params: { q: q.trim(), per_page: 5, simple: 1 },
      signal: current.signal,
      silent: true,
    })
    pasiens.value = data.data ?? data
  } catch (e) {
    if (!isCanceled(e)) pasiens.value = []
  } finally {
    if (controller === current) pasienLoading.value = false
  }
}, 220)

watch(query, (q) => {
  active.value = 0
  searchPasien(q)
})

watch(flat, (list) => {
  if (active.value >= list.length) {
    active.value = Math.max(0, list.length - 1)
  }
})

// Buka/tutup modal
watch(open, async (value) => {
  if (value) {
    lastFocus = document.activeElement
    query.value = ''
    pasiens.value = []
    refreshRecents()
    active.value = 0
    await nextTick()
    inputEl.value?.focus()
  } else {
    controller?.abort()
    lastFocus?.focus?.()
  }
})

// Sinkronkan riwayat jika role pengguna berganti
watch(() => auth.user?.role, () => refreshRecents())

onBeforeUnmount(() => controller?.abort())

function refreshRecents() {
  recents.value = getRecentSearches().filter(canAccess)
}

function handleRemoveRecent(e, item) {
  e.stopPropagation()
  removeRecentSearch(item.id)
  refreshRecents()
}

function handleClearAllRecents(e) {
  e.stopPropagation()
  clearRecentSearches()
  refreshRecents()
}

async function select(entry) {
  if (!entry || !canAccess(entry)) return
  saveRecentSearch(entry)
  open.value = false

  if (entry.action === 'logout') {
    await auth.logout()
    router.push({ name: 'login' })
    return
  }
  if (entry.to) {
    router.push(entry.to)
  }
}

async function move(delta) {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  await nextTick()
  listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    move(e.shiftKey ? -1 : 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    select(activeEntry.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    open.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-from-class="opacity-0"
      enter-active-class="transition duration-150 ease-out"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 p-3 pt-[8vh] backdrop-blur-md sm:p-4 sm:pt-[11vh] print:hidden"
        @mousedown.self="open = false"
      >
        <!-- Modal Card Bergaya Algolia DocSearch -->
        <div
          class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl shadow-slate-900/30 inset-shadow-glass backdrop-blur-2xl motion-safe:animate-pop"
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian Global Algolia"
        >
          <!-- ===== Input Header Ala Algolia ===== -->
          <div class="relative flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-5 sm:py-3.5">
            <!-- Icon Algolia Search -->
            <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcon :path="ICON.search" size="size-5" />
            </div>

            <!-- Input Box -->
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="algolia-palette-list"
              aria-autocomplete="list"
              :aria-activedescendant="activeEntry ? `algolia-${activeEntry.id}` : undefined"
              :placeholder="canSearchPasien ? 'Cari menu, modul, aksi, atau pasien...' : 'Cari menu, modul, atau aksi cepat...'"
              class="h-11 min-w-0 flex-1 bg-transparent text-base font-normal text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-lg"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeydown"
            />

            <!-- Reset / Clear Button -->
            <button
              v-if="query"
              type="button"
              class="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Bersihkan input"
              aria-label="Bersihkan"
              @click="query = ''; inputEl?.focus()"
            >
              <AppIcon :path="ICON.close" size="size-4" />
            </button>

            <!-- Spinner status -->
            <AppSpinner v-if="pasienLoading" class="text-brand-600" />

            <!-- ESC Shortcut Badge -->
            <button
              type="button"
              class="grid h-7 items-center rounded-lg border border-slate-200 bg-slate-100/80 px-2 text-[11px] font-semibold text-slate-500 shadow-xs transition hover:bg-slate-200"
              title="Tutup (Esc)"
              @click="open = false"
            >
              ESC
            </button>
          </div>

          <!-- ===== Hasil Pencarian Algolia ===== -->
          <div
            id="algolia-palette-list"
            ref="listEl"
            role="listbox"
            aria-label="Daftar Modul & Menu"
            class="max-h-[min(65vh,30rem)] overflow-y-auto p-3 space-y-4"
          >
            <!-- Render Setiap Kategori -->
            <template v-for="section in sections" :key="section.title">
              <div class="space-y-1">
                <!-- Judul Section / Kategori -->
                <div class="flex items-center justify-between px-3 pt-1 pb-1">
                  <span class="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    <AppIcon v-if="section.isRecent" :path="ICON.clock" size="size-3.5" class="text-slate-400" />
                    <AppIcon v-else :path="ICON.hash" size="size-3.5" class="text-slate-400" />
                    {{ section.title }}
                  </span>

                  <!-- Tombol Hapus Semua jika Recent Searches -->
                  <button
                    v-if="section.isRecent"
                    type="button"
                    class="text-[11px] font-medium text-slate-400 transition hover:text-red-600"
                    @click="handleClearAllRecents"
                  >
                    Bersihkan riwayat
                  </button>
                </div>

                <!-- Item Hasil -->
                <div
                  v-for="entry in section.items"
                  :id="`algolia-${entry.id}`"
                  :key="entry.id"
                  role="option"
                  :aria-selected="entry === activeEntry"
                  :class="[
                    entry === activeEntry
                      ? 'bg-brand-900 text-white shadow-lg shadow-brand-900/30 ring-1 ring-brand-900'
                      : 'text-slate-700 hover:bg-slate-100/80',
                  ]"
                  class="group relative flex cursor-pointer items-center gap-3.5 rounded-2xl px-3.5 py-3 transition duration-150 select-none"
                  @mousemove="active = flat.indexOf(entry)"
                  @click="select(entry)"
                >
                  <!-- Ikon Item / Kategori -->
                  <span
                    :class="[
                      entry === activeEntry
                        ? 'border-white/20 bg-white/15 text-white'
                        : 'border-slate-200/90 bg-white text-slate-600 group-hover:border-slate-300 shadow-2xs',
                    ]"
                    class="grid size-9 shrink-0 place-items-center rounded-xl border transition"
                  >
                    <AppIcon :path="entry.icon || ICON.hash" size="size-4.5" />
                  </span>

                  <!-- Info Teks -->
                  <div class="min-w-0 flex-1">
                    <!-- Breadcrumb Kategori & Label -->
                    <div class="flex items-center gap-1.5 leading-tight">
                      <span
                        :class="entry === activeEntry ? 'text-brand-100/90' : 'text-slate-400'"
                        class="text-xs font-medium tracking-wide"
                      >
                        {{ entry.category || entry.group }}
                      </span>
                      <span :class="entry === activeEntry ? 'text-white/40' : 'text-slate-300'" class="text-xs">›</span>
                      <span class="truncate text-sm font-semibold">
                        <template v-for="(seg, i) in highlightSegments(entry.label, query)" :key="i">
                          <mark
                            v-if="seg.isMatch"
                            :class="[
                              entry === activeEntry
                                ? 'bg-white/30 text-white font-bold'
                                : 'bg-brand-200 text-brand-950 font-bold',
                            ]"
                            class="rounded-sm px-0.5"
                          >{{ seg.text }}</mark>
                          <template v-else>{{ seg.text }}</template>
                        </template>
                      </span>
                    </div>

                    <!-- Deskripsi / Hint -->
                    <p
                      v-if="entry.description || entry.hint"
                      :class="entry === activeEntry ? 'text-brand-100/80' : 'text-slate-500'"
                      class="mt-0.5 truncate text-xs font-normal"
                    >
                      <template v-for="(seg, i) in highlightSegments(entry.description || entry.hint, query)" :key="i">
                        <mark
                          v-if="seg.isMatch"
                          :class="[
                            entry === activeEntry
                              ? 'bg-white/25 text-white'
                              : 'bg-brand-100 text-brand-950 font-semibold',
                          ]"
                          class="rounded-sm px-0.5"
                        >{{ seg.text }}</mark>
                        <template v-else>{{ seg.text }}</template>
                      </template>
                    </p>
                  </div>

                  <!-- Tombol Hapus untuk Riwayat -->
                  <button
                    v-if="section.isRecent"
                    type="button"
                    :class="entry === activeEntry ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-red-500'"
                    class="grid size-6 place-items-center rounded-md transition"
                    title="Hapus dari riwayat"
                    aria-label="Hapus dari riwayat"
                    @click="handleRemoveRecent($event, entry)"
                  >
                    <AppIcon :path="ICON.close" size="size-3.5" />
                  </button>

                  <!-- Badge Navigasi Enter Ala Algolia -->
                  <span
                    v-if="entry === activeEntry && !section.isRecent"
                    class="hidden shrink-0 items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-medium text-white shadow-2xs sm:inline-flex"
                  >
                    Buka <AppIcon :path="ICON.arrowReturn" size="size-3" />
                  </span>
                </div>
              </div>
            </template>

            <!-- State Ketika Tidak Ditemukan Hasil -->
            <div v-if="!flat.length" class="flex flex-col items-center justify-center py-12 text-center">
              <div class="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <AppIcon :path="ICON.search" size="size-7" />
              </div>
              <h3 class="mt-4 text-sm font-semibold text-slate-900">
                <template v-if="pasienLoading">Mencari data...</template>
                <template v-else>Tidak ada hasil untuk “{{ query }}”</template>
              </h3>
              <p class="mt-1 max-w-sm text-xs text-slate-500">
                Coba gunakan kata kunci modul lain seperti:
                <span class="font-medium text-slate-700">pasien, resep, obat, kasir, poli, tindakan, icd</span>, atau <span class="font-medium text-slate-700">user</span>.
              </p>
            </div>
          </div>

          <!-- ===== Footer Algolia DocSearch ===== -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-4 py-2.5 sm:px-5">
            <!-- Petunjuk Tombol Keyboard -->
            <div class="flex items-center gap-3 text-[11px] text-slate-500">
              <span class="flex items-center gap-1">
                <kbd class="kbd">↵</kbd>
                <span>Pilih</span>
              </span>
              <span class="flex items-center gap-1">
                <kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>
                <span>Navigasi</span>
              </span>
              <span class="flex items-center gap-1">
                <kbd class="kbd">Esc</kbd>
                <span>Tutup</span>
              </span>
            </div>

            <!-- Badge Otentik "Search by Algolia" -->
            <a
              href="https://www.algolia.com"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex items-center gap-1.5 transition select-none"
              title="Didukung oleh Algolia Search Engine"
              aria-label="Search by Algolia"
            >
              <span class="text-[11px] font-medium text-slate-400 group-hover:text-slate-600">Search by</span>
              <span class="inline-flex items-center gap-1 text-brand-600 group-hover:brightness-110">
                <!-- Logo Algolia SVG Resmi -->
                <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.182c5.422 0 9.818 4.396 9.818 9.818 0 5.422-4.396 9.818-9.818 9.818S2.182 17.422 2.182 12c0-5.422 4.396-9.818 9.818-9.818zm1.09 3.273a1.09 1.09 0 00-1.09 1.091v4.364H7.636a1.09 1.09 0 100 2.182h5.455a1.09 1.09 0 001.09-1.091V6.545a1.09 1.09 0 00-1.09-1.09z" />
                  <path d="M14.545 14.545l4.364 4.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                </svg>
                <span class="text-[13px] font-extrabold tracking-tight">algolia</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
