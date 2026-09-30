<script setup>
/**
 * Face chart injeksi (PRD ES-01): diagram wajah tampak depan; klik untuk menambah titik suntik.
 * Titik disimpan sebagai koordinat relatif 0..1 (`x`, `y`) sehingga tidak bergantung ukuran layar.
 * Kanan/kiri mengikuti sisi PASIEN (sisi kiri gambar = sisi kanan pasien).
 */
const titiks = defineModel({ type: Array, default: () => [] })
const terpilih = defineModel('terpilih', { type: Number, default: -1 })
const props = defineProps({ readonly: { type: Boolean, default: false } })
const emit = defineEmits(['tambah'])

const W = 240
const H = 300

/** Tebakan nama area dari posisi klik; tetap bisa diubah petugas. */
function tebakArea(x, y) {
  const dx = Math.abs(x - 0.5)
  const sisi = x < 0.5 ? 'kanan' : 'kiri'
  if (y < 0.3) return 'Frontalis (dahi)'
  if (y < 0.38 && dx < 0.08) return 'Glabella'
  if (y < 0.36) return `Alis ${sisi}`
  if (y < 0.47 && dx > 0.24) return `Crow's feet ${sisi}`
  if (y < 0.62 && dx < 0.05) return 'Hidung'
  if (y < 0.5 && dx > 0.08) return `Tear trough ${sisi}`
  if (y < 0.64 && dx > 0.15) return `Malar / pipi ${sisi}`
  if (y < 0.68 && dx > 0.05) return `Nasolabial ${sisi}`
  if (y < 0.75 && dx < 0.12) return 'Bibir'
  if (dx < 0.12) return 'Dagu (mentalis)'
  return `Jawline / masseter ${sisi}`
}

function klik(e) {
  if (props.readonly) return
  const svg = e.currentTarget
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const p = pt.matrixTransform(svg.getScreenCTM().inverse())
  const x = Math.min(1, Math.max(0, p.x / W))
  const y = Math.min(1, Math.max(0, p.y / H))
  emit('tambah', { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), area: tebakArea(x, y) })
}
</script>

<template>
  <div>
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="mx-auto block w-full max-w-xs touch-manipulation select-none"
      :class="readonly ? '' : 'cursor-crosshair'"
      role="img"
      aria-label="Diagram wajah tampak depan"
      @click="klik"
    >
      <g fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M120 18 C172 18 200 60 200 118 C200 170 186 214 158 246 C144 262 132 270 120 270 C108 270 96 262 82 246 C54 214 40 170 40 118 C40 60 68 18 120 18 Z" fill="#fff" />
        <path d="M41 118 C30 110 24 126 28 144 C31 158 38 166 45 164" />
        <path d="M199 118 C210 110 216 126 212 144 C209 158 202 166 195 164" />
        <path d="M52 92 C64 52 96 38 120 40 C146 38 176 52 188 92" stroke-dasharray="3 4" />
        <path d="M70 104 C82 96 98 96 108 102" />
        <path d="M132 102 C142 96 158 96 170 104" />
        <path d="M72 124 C80 116 98 116 106 124 C98 130 80 130 72 124 Z" />
        <path d="M134 124 C142 116 160 116 168 124 C160 130 142 130 134 124 Z" />
        <circle cx="89" cy="123" r="3" fill="#94a3b8" />
        <circle cx="151" cy="123" r="3" fill="#94a3b8" />
        <path d="M118 130 C116 148 110 160 108 170 C112 178 128 178 132 170" />
        <path d="M104 178 C94 188 92 198 94 206" stroke-dasharray="2 3" />
        <path d="M136 178 C146 188 148 198 146 206" stroke-dasharray="2 3" />
        <path d="M96 208 C106 200 114 202 120 205 C126 202 134 200 144 208 C134 212 106 212 96 208 Z" />
        <path d="M96 208 C106 224 134 224 144 208" />
        <path d="M92 262 L90 296 M148 262 L150 296" />
      </g>
      <g>
        <g
          v-for="(t, i) in titiks"
          :key="i"
          class="cursor-pointer"
          @click.stop="terpilih = i"
        >
          <circle :cx="t.x * W" :cy="t.y * H" :r="terpilih === i ? 8 : 6.5" :fill="terpilih === i ? '#e11d48' : '#0f172a'" stroke="#fff" stroke-width="1.5" />
          <text :x="t.x * W" :y="t.y * H + 3" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">{{ i + 1 }}</text>
        </g>
      </g>
      <text x="6" y="294" font-size="8" fill="#94a3b8">kanan pasien</text>
      <text x="234" y="294" font-size="8" fill="#94a3b8" text-anchor="end">kiri pasien</text>
    </svg>
    <p v-if="!readonly" class="mt-1 text-center text-xs text-slate-400">Klik diagram untuk menambah titik suntik · klik nomor untuk memilih</p>
  </div>
</template>
