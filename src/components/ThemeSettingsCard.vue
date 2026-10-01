<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { COLOR_PALETTES, DENSITY_OPTIONS, MODE_OPTIONS, useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Tema & Tampilan</h2>
    </div>
    <div class="card-body space-y-5">
      <!-- Mode Tema (Light / Dark / System) -->
      <div>
        <label class="label">Mode Tampilan</label>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="m in MODE_OPTIONS"
            :key="m.key"
            type="button"
            :class="theme.mode === m.key ? 'choice-active' : ''"
            class="choice flex flex-col items-center gap-2 py-3"
            @click="theme.setMode(m.key)"
          >
            <AppIcon :path="m.icon" size="size-5" />
            <span>{{ m.label }}</span>
          </button>
        </div>
      </div>

      <!-- Warna Aksen Utama -->
      <div>
        <label class="label">Warna Aksen Tema</label>
        <div class="flex flex-wrap items-center gap-3">
          <button
            v-for="p in COLOR_PALETTES"
            :key="p.key"
            type="button"
            :title="p.label"
            :class="theme.color === p.key ? 'ring-3 ring-slate-800 ring-offset-2 dark:ring-white dark:ring-offset-slate-900' : ''"
            class="group relative flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:scale-105 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            @click="theme.setColor(p.key)"
          >
            <span :style="{ backgroundColor: p.primary }" class="size-4 rounded-full shadow-xs" />
            <span>{{ p.label }}</span>
          </button>
        </div>
      </div>

      <!-- Densitas Layout -->
      <div>
        <label class="label">Densitas Antarmuka</label>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="d in DENSITY_OPTIONS"
            :key="d.key"
            type="button"
            :class="theme.density === d.key ? 'choice-active' : ''"
            class="choice py-2.5 text-center text-xs font-semibold"
            @click="theme.setDensity(d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
