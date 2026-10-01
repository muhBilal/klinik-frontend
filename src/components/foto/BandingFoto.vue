<script setup>
/**
 * Perbandingan before-after lintas kunjungan (PRD FT-02): berdampingan atau slider (geser pembatas).
 * Foto penuh diminta lewat satu `POST /berkas/tautan` saat modal dibuka (tercatat audit), tidak di-cache.
 */
import { computed, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import { errorMessage } from '@/lib/api'
import { labelPosisi, tautanFoto } from '@/lib/foto'
import { TAHAP_FOTO, tanggal } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
/** `fotos` = dua berkas foto; yang lebih lama tampil di kiri (sebelum). */
const props = defineProps({ fotos: { type: Array, default: () => [] } })
const toast = useToastStore()

const mode = ref('slider')
const geser = ref(50)
const url = ref({})
const loading = ref(false)

const urut = computed(() => [...props.fotos].sort((a, b) => new Date(a.diambil_at ?? a.created_at) - new Date(b.diambil_at ?? b.created_at)))
const kiri = computed(() => urut.value[0])
const kanan = computed(() => urut.value[1])
// Kotak mengikuti rasio foto pertama agar keduanya sejajar
const rasio = computed(() => (kiri.value?.lebar && kiri.value?.tinggi ? `${kiri.value.lebar} / ${kiri.value.tinggi}` : '4 / 3'))

const keterangan = (f) => [tanggal(f.kunjungan?.tanggal ?? f.diambil_at), f.tahap && TAHAP_FOTO[f.tahap], labelPosisi(f)].filter(Boolean).join(' · ')

watch(open, async (buka) => {
  if (!buka || props.fotos.length < 2) return
  url.value = {}
  geser.value = 50
  loading.value = true
  try {
    url.value = await tautanFoto(props.fotos.map((f) => f.uuid))
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppModal v-model="open" title="Bandingkan Before-After" size="max-w-5xl">
    <div v-if="kiri && kanan" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="tabs w-fit">
          <button type="button" :class="{ 'tab-active': mode === 'slider' }" class="tab" @click="mode = 'slider'">Slider</button>
          <button type="button" :class="{ 'tab-active': mode === 'sisi' }" class="tab" @click="mode = 'sisi'">Berdampingan</button>
        </div>
        <AppSpinner v-if="loading" class="text-slate-400" />
      </div>

      <!-- Berdampingan -->
      <div v-if="mode === 'sisi'" class="grid gap-3 sm:grid-cols-2">
        <figure v-for="f in [kiri, kanan]" :key="f.uuid" class="space-y-1.5">
          <div class="overflow-hidden rounded-2xl bg-slate-950" :style="{ aspectRatio: rasio }">
            <img v-if="url[f.uuid]" :src="url[f.uuid]" :alt="keterangan(f)" class="size-full object-contain select-none" draggable="false" @contextmenu.prevent />
          </div>
          <figcaption class="text-center text-xs text-slate-600">{{ keterangan(f) }}</figcaption>
        </figure>
      </div>

      <!-- Slider: foto kanan penuh, foto kiri dipotong sampai posisi pembatas -->
      <div v-else class="space-y-2">
        <div class="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-slate-950 select-none" :style="{ aspectRatio: rasio }" @contextmenu.prevent>
          <img v-if="url[kanan.uuid]" :src="url[kanan.uuid]" :alt="keterangan(kanan)" class="absolute inset-0 size-full object-contain" draggable="false" />
          <img
            v-if="url[kiri.uuid]"
            :src="url[kiri.uuid]"
            :alt="keterangan(kiri)"
            class="absolute inset-0 size-full object-contain"
            :style="{ clipPath: `inset(0 ${100 - geser}% 0 0)` }"
            draggable="false"
          />
          <div class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" :style="{ left: `${geser}%` }">
            <span class="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-800 shadow">⇆</span>
          </div>
          <span class="absolute top-3 left-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white">{{ TAHAP_FOTO[kiri.tahap] ?? 'Sebelum' }}</span>
          <span class="absolute top-3 right-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white">{{ TAHAP_FOTO[kanan.tahap] ?? 'Sesudah' }}</span>
          <input v-model.number="geser" type="range" min="0" max="100" step="0.5" class="absolute inset-0 size-full cursor-ew-resize opacity-0" aria-label="Geser pembanding" />
        </div>
        <div class="mx-auto flex max-w-3xl justify-between text-xs text-slate-600">
          <span>{{ keterangan(kiri) }}</span>
          <span>{{ keterangan(kanan) }}</span>
        </div>
      </div>
      <p class="text-center text-xs text-slate-400">Pembukaan foto penuh tercatat di audit log. Foto tidak dapat diunduh dari tampilan ini.</p>
    </div>
  </AppModal>
</template>
