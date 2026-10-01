<script setup>
/**
 * Kartu Foto Klinis (PRD FT-01..04): persetujuan foto pasien, tombol ambil foto terpandu, galeri & perbandingan before-after.
 * Dipakai di pemeriksaan (bisa ambil foto), detail kunjungan (baca) dan detail pasien (semua kunjungan).
 */
import { computed, ref } from 'vue'
import GaleriFoto from '@/components/foto/GaleriFoto.vue'
import KameraFoto from '@/components/foto/KameraFoto.vue'
import PersetujuanFotoPanel from '@/components/foto/PersetujuanFotoPanel.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  pasien: { type: Object, required: true },
  kunjunganId: { type: Number, default: null },
  /** Tindakan kunjungan yang bisa dikaitkan ke foto: [{ id, nama, protokol_foto_id }] */
  tindakans: { type: Array, default: () => [] },
  /** Boleh mengambil foto baru (pemeriksaan masih terbuka). */
  bisaAmbil: { type: Boolean, default: false },
})
const auth = useAuthStore()

const kameraOpen = ref(false)
const tindakanId = ref(null)
const muatUlang = ref(0)
const persetujuan = ref(null)

const bolehAmbil = computed(() => props.bisaAmbil && auth.can('berkas.kelola'))

/** Buka kamera; `tindakan` (opsional) = baris tindakan kunjungan yang difoto. */
function ambil(tindakan = null) {
  tindakanId.value = tindakan?.id ?? null
  kameraOpen.value = true
}

defineExpose({ ambil })
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Foto Klinis</h2>
      <button v-if="bolehAmbil" type="button" class="btn btn-primary btn-sm" :title="persetujuan ? '' : 'Pasien belum menandatangani persetujuan foto'" @click="ambil()">
        Ambil foto
      </button>
    </div>
    <div class="card-body space-y-4">
      <PersetujuanFotoPanel :pasien="pasien" :kunjungan-id="kunjunganId" @changed="(aktif) => (persetujuan = aktif)" />
      <GaleriFoto :pasien-id="pasien.id" :kunjungan-id="kunjunganId" :muat-ulang="muatUlang" :readonly="!bisaAmbil" />
      <p class="text-xs text-slate-400">Foto terenkripsi, tidak tersimpan di perangkat; setiap pembukaan tercatat di audit log.</p>
    </div>
    <KameraFoto
      v-if="bolehAmbil"
      v-model="kameraOpen"
      :pasien-id="pasien.id"
      :kunjungan-id="kunjunganId"
      :tindakans="tindakans"
      :tindakan-id="tindakanId"
      @uploaded="muatUlang++"
    />
  </div>
</template>
