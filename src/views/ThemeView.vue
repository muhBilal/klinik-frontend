<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import PageHeader from '@/components/PageHeader.vue'
import { DEFAULT_THEME, PRESETS, setTheme, theme, themeVars } from '@/lib/theme'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const ICON = {
  reset: 'M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M4.031 9.348a8.25 8.25 0 0113.803-3.7l3.181 3.7m-18 6a8.25 8.25 0 0013.803 3.7l3.181-3.7',
  check: 'M4.5 12.75l6 6 9-13.5',
}

const isPresetActive = (p) => p.hue === theme.hue && p.chroma === theme.chroma && p.depth === theme.depth

/** Contoh palet pada bilah pratinjau: dari terang ke isian primary. */
const swatches = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/** Gaya inline pratinjau sebuah preset (tidak mengubah tema aktif). */
const previewStyle = (preset) => themeVars(preset)

const reset = () => {
  setTheme(DEFAULT_THEME)
  toast.success('Tema dikembalikan ke bawaan.')
}

const aktif = computed(() => PRESETS.find(isPresetActive)?.label ?? 'Khusus')
</script>

<template>
  <div>
    <PageHeader title="Tema" subtitle="Ubah warna aksen aplikasi. Pilihan tersimpan otomatis di akun Anda.">
      <button class="btn btn-secondary" @click="reset">
        <AppIcon :path="ICON.reset" size="size-4" /> Kembalikan bawaan
      </button>
    </PageHeader>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <!-- ===== Pilihan tema ===== -->
      <div class="space-y-5">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Warna siap pakai</h2>
            <span class="chip">{{ aktif }}</span>
          </div>
          <div class="card-body grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              v-for="p in PRESETS"
              :key="p.label"
              type="button"
              :style="previewStyle(p)"
              :aria-pressed="isPresetActive(p)"
              :class="isPresetActive(p) ? 'border-brand-900 ring-2 ring-brand-500/30' : 'border-slate-200/80 hover:bg-white'"
              class="flex items-center gap-3 rounded-2xl border bg-white/80 px-3.5 py-3 text-left shadow-xs transition"
              @click="setTheme(p)"
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-900 text-white shadow-lg shadow-brand-900/30 inset-shadow-dark">
                <AppIcon v-if="isPresetActive(p)" :path="ICON.check" size="size-4" />
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{{ p.label }}</span>
            </button>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2 class="card-title">Setel sendiri</h2></div>
          <div class="card-body space-y-5">
            <div>
              <label class="label" for="t-hue">Rona <span class="font-normal text-slate-400">({{ Math.round(theme.hue) }}°)</span></label>
              <input
                id="t-hue"
                v-model.number="theme.hue"
                type="range"
                min="0"
                max="359"
                class="h-2.5 w-full cursor-pointer appearance-none rounded-full accent-brand-900"
                style="background: linear-gradient(to right, oklch(0.6 0.16 0), oklch(0.6 0.16 60), oklch(0.6 0.16 120), oklch(0.6 0.16 180), oklch(0.6 0.16 240), oklch(0.6 0.16 300), oklch(0.6 0.16 360))"
              />
            </div>
            <div>
              <label class="label" for="t-chroma">Kepekatan <span class="font-normal text-slate-400">({{ Math.round(theme.chroma * 100) }}%)</span></label>
              <input id="t-chroma" v-model.number="theme.chroma" type="range" min="0" max="1.4" step="0.05" class="w-full cursor-pointer accent-brand-900" />
              <p class="mt-1 text-xs text-slate-500">0% menghasilkan abu-abu netral.</p>
            </div>
            <div>
              <label class="label" for="t-depth">Kecerahan warna utama <span class="font-normal text-slate-400">({{ Math.round(theme.depth * 100) }}%)</span></label>
              <input id="t-depth" v-model.number="theme.depth" type="range" min="0.38" max="0.68" step="0.01" class="w-full cursor-pointer accent-brand-900" />
              <p class="mt-1 text-xs text-slate-500">Memengaruhi tombol, tab, dan menu yang sedang aktif.</p>
            </div>
          </div>
        </section>
      </div>

      <!-- ===== Pratinjau ===== -->
      <section class="card h-fit lg:sticky lg:top-5">
        <div class="card-header"><h2 class="card-title">Pratinjau</h2></div>
        <div class="card-body space-y-4">
          <div class="flex overflow-hidden rounded-xl">
            <span v-for="s in swatches" :key="s" :style="{ background: `var(--color-brand-${s})` }" class="h-9 flex-1" :title="`brand-${s}`" />
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary">Simpan</button>
            <button type="button" class="btn btn-secondary">Batal</button>
          </div>

          <nav class="tabs">
            <span class="tab tab-active">Aktif</span>
            <span class="tab">Lainnya</span>
          </nav>

          <input type="search" class="input" placeholder="Cari pasien…" aria-label="Contoh kotak pencarian" />

          <div class="tile flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white shadow-lg shadow-brand-900/30">RM</span>
            <div class="min-w-0 leading-tight">
              <p class="truncate text-sm font-semibold text-slate-900">Contoh kartu</p>
              <p class="truncate text-xs text-brand-700">Teks beraksen tema</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
