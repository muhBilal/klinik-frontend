<script setup>
/**
 * Bidang tanda tangan untuk tablet/mouse/stylus (pointer events). v-model = PNG data URL, '' bila kosong.
 * Kanvas digambar pada resolusi perangkat (devicePixelRatio) agar garis tajam; latar putih ikut diekspor
 * supaya tanda tangan tetap terbaca saat dicetak.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const model = defineModel({ type: String, default: '' })
const props = defineProps({
  label: { type: String, default: 'Tanda tangan' },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
})

const canvas = ref(null)
let ctx = null
let menggambar = false
let adaGoresan = false
let observer = null

function siapkan() {
  const el = canvas.value
  if (!el) return
  const rasio = window.devicePixelRatio || 1
  // Ukuran layout (bukan getBoundingClientRect) agar tidak terpengaruh animasi transform modal.
  const width = el.offsetWidth
  const height = el.offsetHeight
  if (!width) return
  el.width = Math.round(width * rasio)
  el.height = Math.round(height * rasio)
  ctx = el.getContext('2d')
  ctx.scale(rasio, rasio)
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#0f172a'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  // Ukuran kanvas berubah = gambar hilang; kosongkan nilai agar tidak menyimpan tanda tangan yang tidak terlihat.
  adaGoresan = false
  model.value = ''
}

function titik(e) {
  const el = canvas.value
  const rect = el.getBoundingClientRect()
  const skala = el.offsetWidth / rect.width
  return { x: (e.clientX - rect.left) * skala, y: (e.clientY - rect.top) * skala }
}

function mulai(e) {
  if (props.disabled || !ctx) return
  e.preventDefault()
  canvas.value.setPointerCapture?.(e.pointerId)
  menggambar = true
  const { x, y } = titik(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
  // Titik tunggal (ketukan) tetap terlihat
  ctx.lineTo(x + 0.1, y + 0.1)
  ctx.stroke()
}

function gerak(e) {
  if (!menggambar) return
  e.preventDefault()
  const { x, y } = titik(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  adaGoresan = true
}

function selesai() {
  if (!menggambar) return
  menggambar = false
  if (adaGoresan) model.value = canvas.value.toDataURL('image/png')
}

function hapus() {
  siapkan()
}

onMounted(async () => {
  await nextTick()
  siapkan()
  // Modal bisa berubah lebar (rotasi tablet): siapkan ulang kanvas.
  observer = new ResizeObserver(() => {
    if (canvas.value && Math.round(canvas.value.offsetWidth * (window.devicePixelRatio || 1)) !== canvas.value.width) siapkan()
  })
  observer.observe(canvas.value)
})

onBeforeUnmount(() => observer?.disconnect())

defineExpose({ hapus })
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between">
      <span class="label mb-0">{{ label }}</span>
      <button v-if="!disabled" type="button" class="btn btn-ghost btn-sm" @click="hapus">Ulangi</button>
    </div>
    <!-- Border di pembungkus: ukuran kanvas = area gambar, sehingga koordinat pointer tidak bergeser -->
    <div :class="invalid ? 'border-rose-400 ring-2 ring-rose-300/50' : 'border-slate-300'" class="overflow-hidden rounded-2xl border-2 border-dashed bg-white">
      <canvas
        ref="canvas"
        class="block h-44 w-full cursor-crosshair touch-none"
        :aria-label="label"
        @pointerdown="mulai"
        @pointermove="gerak"
        @pointerup="selesai"
        @pointerleave="selesai"
        @pointercancel="selesai"
      />
    </div>
    <p class="mt-1 text-xs text-slate-400">{{ model ? 'Tanda tangan tersimpan di formulir ini.' : 'Tanda tangani di dalam kotak dengan jari atau stylus.' }}</p>
  </div>
</template>
