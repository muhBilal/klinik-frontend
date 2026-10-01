<script setup>
/**
 * Gambar odontogram notasi FDI (PRD DG-01): 32 gigi tetap + 20 gigi sulung, tiap gigi 5 permukaan (M/O/D/B/L).
 * Permukaan diwarnai kondisinya; kondisi seluruh gigi tampil sebagai kode di bawah/atas nomor gigi, bingkai berwarna
 * (mahkota, implan, dll.), dan tanda silang untuk gigi hilang. Klik permukaan = pilih permukaan; klik nomor = pilih gigi.
 */
import { computed } from 'vue'
import { BARIS_GIGI, labelPermukaan, namaGigi, rahangAtas, sisiKananPasien } from '@/lib/gigi'

const props = defineProps({
  /** Kondisi yang berlaku: [{ id, gigi, permukaan, kondisi }] */
  kondisis: { type: Array, default: () => [] },
  /** Referensi kondisi dari backend: { kode: { label, cakupan, kelompok, warna } } */
  peta: { type: Object, default: () => ({}) },
  /** { gigi, permukaan } yang dipilih (permukaan null = seluruh gigi) */
  terpilih: { type: Object, default: null },
  tampilSulung: { type: Boolean, default: true },
})
const emit = defineEmits(['pilih'])

const S = 34 // sisi kotak gigi
const SEL = 46 // lebar sel per gigi
const TENGAH = 18 // jarak garis tengah
const LABEL = 26 // ruang nomor + kode di atas/bawah kotak
const JARAK_BARIS = 14

const baris = computed(() => BARIS_GIGI.filter((b) => props.tampilSulung || !b.sulung))
const lebar = 16 * SEL + TENGAH
const tinggiBaris = S + LABEL
const tinggi = computed(() => baris.value.length * tinggiBaris + (baris.value.length - 1) * JARAK_BARIS + 8)

/** Per gigi: { permukaan: { M: kondisi, ... }, gigi: [kondisi seluruh gigi] } */
const perGigi = computed(() => {
  const peta = {}
  for (const k of props.kondisis) {
    const g = (peta[k.gigi] ??= { permukaan: {}, gigi: [] })
    if (k.permukaan) g.permukaan[k.permukaan] = k
    else g.gigi.push(k)
  }
  return peta
})

/** Posisi x kotak gigi: sisi kiri gambar rata kanan ke garis tengah, sisi kanan rata kiri. */
function xGigi(b, sisi, i) {
  const tengah = lebar / 2
  const offset = (SEL - S) / 2
  return sisi === 'kiri' ? tengah - TENGAH / 2 - (b.kiri.length - i) * SEL + offset : tengah + TENGAH / 2 + i * SEL + offset
}

const yBaris = (index) => 4 + index * (tinggiBaris + JARAK_BARIS)

/** Kotak gigi di atas label untuk rahang atas (nomor di atas), di bawah label untuk rahang bawah. */
const yKotak = (b, index) => yBaris(index) + (b.rahang === 'atas' ? LABEL : 0)

const gigiBaris = (b) => [...b.kiri.map((g, i) => ({ g, sisi: 'kiri', i })), ...b.kanan.map((g, i) => ({ g, sisi: 'kanan', i }))]

/** Permukaan per posisi gambar: atas/bawah = bukal/lingual (tergantung rahang), kiri/kanan = distal/mesial (tergantung sisi). */
function posisiPermukaan(g) {
  const atas = rahangAtas(g)
  const kananPasien = sisiKananPasien(g)
  const a = 0.3 * S
  const b = 0.7 * S
  return [
    { kode: atas ? 'B' : 'L', titik: `0,0 ${S},0 ${b},${a} ${a},${a}` },
    { kode: atas ? 'L' : 'B', titik: `0,${S} ${S},${S} ${b},${b} ${a},${b}` },
    { kode: kananPasien ? 'D' : 'M', titik: `0,0 ${a},${a} ${a},${b} 0,${S}` },
    { kode: kananPasien ? 'M' : 'D', titik: `${S},0 ${b},${a} ${b},${b} ${S},${S}` },
    { kode: 'O', titik: `${a},${a} ${b},${a} ${b},${b} ${a},${b}` },
  ]
}

const warna = (k) => props.peta[k?.kondisi]?.warna ?? '#94a3b8'
const label = (k) => props.peta[k?.kondisi]?.label ?? k?.kondisi

/** Bingkai gigi: kondisi seluruh gigi (selain kelompok "lain") memberi warna bingkai. */
function bingkai(g) {
  const utama = perGigi.value[g]?.gigi.find((k) => !['lain'].includes(props.peta[k.kondisi]?.kelompok))
  return utama ? { warna: warna(utama), tebal: 3, putus: ['une', 'pre', 'imv'].includes(utama.kondisi) } : { warna: '#94a3b8', tebal: 1, putus: false }
}

const hilang = (g) => perGigi.value[g]?.gigi.some((k) => k.kondisi === 'mis')
const kodeGigi = (g) => (perGigi.value[g]?.gigi ?? []).map((k) => k.kondisi)

function ringkasan(g) {
  const d = perGigi.value[g]
  if (!d) return `Gigi ${g} — ${namaGigi(g)}: tidak ada catatan`
  const daftar = [...d.gigi.map(label), ...Object.entries(d.permukaan).map(([p, k]) => `${label(k)} ${labelPermukaan(g, p).toLowerCase()}`)]
  return `Gigi ${g} — ${namaGigi(g)}: ${daftar.join(', ')}`
}

const dipilih = (g, p = undefined) => props.terpilih?.gigi === g && (p === undefined || props.terpilih?.permukaan === p)

// Mode baca tetap bisa memilih gigi (untuk melihat rincian kondisinya).
const pilih = (gigi, permukaan = null) => emit('pilih', { gigi, permukaan })

function tekan(e, gigi) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pilih(gigi)
  }
}
</script>

<template>
  <svg :viewBox="`0 0 ${lebar} ${tinggi}`" class="w-full min-w-[640px] select-none" role="group" aria-label="Odontogram">
    <!-- Garis tengah -->
    <line :x1="lebar / 2" :x2="lebar / 2" y1="0" :y2="tinggi" stroke="#cbd5e1" stroke-dasharray="3 3" />
    <template v-for="(b, bi) in baris" :key="bi">
      <g
        v-for="{ g, sisi, i } in gigiBaris(b)"
        :key="g"
        :transform="`translate(${xGigi(b, sisi, i)}, ${yKotak(b, bi)})`"
        class="cursor-pointer outline-none [&:focus-visible>rect.sel]:stroke-slate-900"
        tabindex="0"
        role="button"
        :aria-label="ringkasan(g)"
        :aria-pressed="dipilih(g)"
        :data-gigi="g"
        @keydown="tekan($event, g)"
      >
        <title>{{ ringkasan(g) }}</title>
        <!-- Sorotan gigi terpilih -->
        <rect class="sel" :x="-5" :y="b.rahang === 'atas' ? -LABEL : -4" :width="S + 10" :height="S + LABEL + 4" rx="8"
          :fill="dipilih(g) ? 'rgba(15,23,42,0.07)' : 'transparent'" :stroke="dipilih(g) ? '#0f172a' : 'transparent'" stroke-width="1.5"
          @click="pilih(g)" />
        <!-- Nomor & kode kondisi seluruh gigi -->
        <text :x="S / 2" :y="b.rahang === 'atas' ? -14 : S + 12" text-anchor="middle" class="fill-slate-700 text-[11px] font-semibold tabular-nums" @click="pilih(g)">{{ g }}</text>
        <text v-if="kodeGigi(g).length" :x="S / 2" :y="b.rahang === 'atas' ? -3 : S + 23" text-anchor="middle" class="fill-slate-500 text-[8.5px] font-semibold" @click="pilih(g)">
          {{ kodeGigi(g).slice(0, 2).join(' ') }}{{ kodeGigi(g).length > 2 ? ` +${kodeGigi(g).length - 2}` : '' }}
        </text>
        <!-- Permukaan -->
        <polygon
          v-for="p in posisiPermukaan(g)"
          :key="p.kode"
          :points="p.titik"
          :fill="perGigi[g]?.permukaan[p.kode] ? warna(perGigi[g].permukaan[p.kode]) : '#ffffff'"
          :fill-opacity="perGigi[g]?.permukaan[p.kode] ? 0.85 : 1"
          :stroke="dipilih(g, p.kode) ? '#0f172a' : '#94a3b8'"
          :stroke-width="dipilih(g, p.kode) ? 2 : 0.75"
          stroke-linejoin="round"
          :data-permukaan="p.kode"
          class="transition-opacity hover:opacity-70"
          @click.stop="pilih(g, p.kode)"
        >
          <title>{{ g }} {{ labelPermukaan(g, p.kode) }}{{ perGigi[g]?.permukaan[p.kode] ? `: ${label(perGigi[g].permukaan[p.kode])}` : '' }}</title>
        </polygon>
        <!-- Bingkai kondisi seluruh gigi -->
        <rect x="0" y="0" :width="S" :height="S" fill="none" :stroke="bingkai(g).warna" :stroke-width="bingkai(g).tebal"
          :stroke-dasharray="bingkai(g).putus ? '4 3' : null" rx="2" pointer-events="none" />
        <!-- Gigi hilang -->
        <g v-if="hilang(g)" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" pointer-events="none">
          <line x1="-3" y1="-3" :x2="S + 3" :y2="S + 3" />
          <line :x1="S + 3" y1="-3" x2="-3" :y2="S + 3" />
        </g>
      </g>
    </template>
  </svg>
</template>
