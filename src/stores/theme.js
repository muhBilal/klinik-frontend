import { defineStore } from 'pinia'
import { ref } from 'vue'

export const COLOR_PALETTES = [
  { key: 'sky', label: 'Biru Kesehatan', primary: '#0284c7', hover: '#0369a1', bg: 'bg-sky-600' },
  { key: 'emerald', label: 'Hijau Medis', primary: '#059669', hover: '#047857', bg: 'bg-emerald-600' },
  { key: 'violet', label: 'Ungu Estetika', primary: '#7c3aed', hover: '#6d28d9', bg: 'bg-violet-600' },
  { key: 'teal', label: 'Teal Klinik', primary: '#0d9488', hover: '#0f766e', bg: 'bg-teal-600' },
  { key: 'rose', label: 'Rose Estetika', primary: '#e11d48', hover: '#be123c', bg: 'bg-rose-600' },
]

export const MODE_OPTIONS = [
  { key: 'light', label: 'Terang', icon: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.236l-1.591 1.591M5.25 12H3m4.236-4.773L5.645 5.636M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z' },
  { key: 'dark', label: 'Gelap', icon: 'M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z' },
  { key: 'system', label: 'Otomatis', icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3' },
]

export const DENSITY_OPTIONS = [
  { key: 'normal', label: 'Nyaman (Standard)' },
  { key: 'compact', label: 'Rapat (Compact)' },
]

export const useThemeStore = defineStore('theme', () => {
  const mode = ref(localStorage.getItem('theme_mode') || 'system')
  const color = ref(localStorage.getItem('theme_color') || 'sky')
  const density = ref(localStorage.getItem('theme_density') || 'normal')

  function applyTheme() {
    // Mode (Dark / Light)
    const isDark = mode.value === 'dark' || (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)

    // Color palette
    const palette = COLOR_PALETTES.find((p) => p.key === color.value) || COLOR_PALETTES[0]
    document.documentElement.style.setProperty('--color-brand-600', palette.primary)
    document.documentElement.style.setProperty('--color-brand-900', palette.primary)
    document.documentElement.style.setProperty('--color-brand-950', palette.hover)

    // Density
    document.documentElement.classList.toggle('density-compact', density.value === 'compact')
  }

  function setMode(newMode) {
    mode.value = newMode
    localStorage.setItem('theme_mode', newMode)
    applyTheme()
  }

  function toggleMode() {
    const modes = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(mode.value)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setMode(nextMode)
  }

  function setColor(newColor) {
    color.value = newColor
    localStorage.setItem('theme_color', newColor)
    applyTheme()
  }

  function setDensity(newDensity) {
    density.value = newDensity
    localStorage.setItem('theme_density', newDensity)
    applyTheme()
  }

  // Listen for system theme changes dynamically
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value === 'system') {
        applyTheme()
      }
    })
  }

  // Initial call
  applyTheme()

  return { mode, color, density, setMode, toggleMode, setColor, setDensity, applyTheme }
})
