<script setup>
/**
 * Deretan garis gedung klinik (tanpa isian) sebagai pola latar samar halaman login. Warna dari `currentColor`
 * — atur kepekatan lewat kelas text-* (mis. `text-white/[0.07]`). `xMidYMax slice`: menempel di bawah, sisi terpotong.
 */
const DASAR = 300

// [x, lebar, tinggi, papan tanda silang di atap]
const gedung = [
  [20, 120, 130],
  [152, 70, 210, true],
  [234, 160, 110],
  [406, 64, 180],
  [520, 140, 150, true],
  [672, 80, 240],
  [764, 150, 120],
  [960, 70, 200, true],
  [1042, 130, 140],
  [1184, 76, 230],
  [1272, 150, 120, true],
]
const pohon = [
  [490, 18],
  [934, 16],
  [1436, 20],
]

/** Path tanda tambah berpusat (cx, cy); a = setengah tebal lengan, b = setengah panjang lengan. */
const tanda = (cx, cy, a, b) => `M${cx - a} ${cy - b}h${2 * a}v${b - a}h${b - a}v${2 * a}h${a - b}v${b - a}h${-2 * a}v${a - b}h${a - b}v${-2 * a}h${b - a}z`

const bentuk = gedung.map(([x, w, h, silang]) => {
  const atas = DASAR - h
  const cx = x + w / 2
  const kolom = Math.max(1, Math.round(w / 28) - 1)
  return {
    x,
    w,
    atas,
    jendela: Array.from({ length: kolom }, (_, i) => x + ((i + 1) * w) / (kolom + 1)),
    silang: silang ? { cx, d: tanda(cx, atas - 27, 4, 11) } : null,
  }
})
</script>

<template>
  <svg
    viewBox="0 0 1440 300"
    preserveAspectRatio="xMidYMax slice"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-for="g in bentuk" :key="g.x">
      <rect :x="g.x" :y="g.atas" :width="g.w" :height="DASAR - g.atas + 10" rx="2" />
      <line v-for="jx in g.jendela" :key="jx" :x1="jx" :x2="jx" :y1="g.atas + 18" :y2="DASAR" stroke-dasharray="10 8" />
      <template v-if="g.silang">
        <line :x1="g.silang.cx - 8" :x2="g.silang.cx - 8" :y1="g.atas - 10" :y2="g.atas" />
        <line :x1="g.silang.cx + 8" :x2="g.silang.cx + 8" :y1="g.atas - 10" :y2="g.atas" />
        <rect :x="g.silang.cx - 17" :y="g.atas - 44" width="34" height="34" rx="6" />
        <path :d="g.silang.d" />
      </template>
    </g>
    <g v-for="[x, r] in pohon" :key="x">
      <circle :cx="x" :cy="DASAR - 30 - r" :r="r" />
      <path :d="`M${x} ${DASAR}v${-30 - r * 0.6}m0 ${r * 0.5}-${r * 0.45}-${r * 0.45}`" />
    </g>
  </svg>
</template>
