/** Label tombol modifier sesuai OS, untuk petunjuk shortcut (⌘K di Mac, Ctrl K di Windows/Linux). */
export const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? '')
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

/** Ctrl/⌘ + K atau Alt + K (pakai e.code agar Alt+K di Mac yang menghasilkan "˚" tetap terdeteksi). */
export function isPaletteShortcut(e) {
  const k = e.key?.toLowerCase()
  return ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'k') || (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyK')
}
