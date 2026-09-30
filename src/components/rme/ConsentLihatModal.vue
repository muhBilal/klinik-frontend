<script setup>
/**
 * Lihat & cetak informed consent yang sudah ditandatangani (naskah + tanda tangan). Setiap pembukaan tercatat audit,
 * jadi data diminta saat modal dibuka, tidak di-prefetch. Pencabutan hanya selama pemeriksaan masih terbuka.
 */
import { ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage } from '@/lib/api'
import { HUBUNGAN_PENANDATANGAN, tanggal, waktu } from '@/lib/format'
import { printElement } from '@/lib/print'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  uuid: { type: String, default: '' },
  /** Tampilkan tombol cabut (pemeriksaan masih terbuka & user berizin rme.tindakan). */
  bisaCabut: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])
const toast = useToastStore()
const klinik = useKlinikStore()

const consent = ref(null)
const loading = ref(false)
const cabutOpen = ref(false)
const alasan = ref('')
const mencabut = ref(false)

watch(open, async (buka) => {
  if (!buka || !props.uuid) return
  consent.value = null
  cabutOpen.value = false
  alasan.value = ''
  loading.value = true
  try {
    consent.value = (await api.get(`/informed-consents/${props.uuid}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
    open.value = false
  } finally {
    loading.value = false
  }
})

async function cabut() {
  mencabut.value = true
  try {
    const { data } = await api.post(`/informed-consents/${props.uuid}/cabut`, { alasan: alasan.value })
    consent.value = { ...consent.value, ...data }
    cabutOpen.value = false
    toast.success('Persetujuan dicabut.')
    emit('changed', data)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    mencabut.value = false
  }
}

const cetak = () => printElement('#cetak-consent', consent.value?.judul ?? 'Informed consent')
</script>

<template>
  <AppModal v-model="open" title="Informed Consent" size="max-w-3xl">
    <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Memuat dokumen...</div>
    <template v-else-if="consent">
      <p v-if="!consent.checksum_valid" class="alert alert-danger mb-4">
        Sidik dokumen tidak cocok: isi atau tanda tangan berubah di luar aplikasi. Laporkan ke penanggung jawab rekam medis.
      </p>
      <div v-if="consent.status === 'dicabut'" class="alert alert-warning mb-4">
        Dicabut {{ waktu(consent.dicabut_at) }} oleh {{ consent.pencabut?.name ?? '-' }} — {{ consent.alasan_cabut }}
      </div>

      <article id="cetak-consent" class="space-y-4 rounded-2xl border border-line bg-white px-6 py-5 text-sm leading-relaxed text-slate-800">
        <header class="border-b border-slate-300 pb-3 text-center">
          <p class="text-base font-bold">{{ klinik.nama }}</p>
          <p class="text-xs text-slate-600">{{ consent.kunjungan?.cabang?.nama }}<template v-if="consent.kunjungan?.cabang?.alamat"> · {{ consent.kunjungan.cabang.alamat }}</template></p>
        </header>
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold uppercase tracking-wide">{{ consent.judul }}</h3>
            <p v-if="consent.tindakan_nama" class="text-xs text-slate-500">Tindakan: {{ consent.tindakan_nama }}</p>
          </div>
          <StatusBadge :status="consent.status" />
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt class="text-slate-500">Pasien</dt><dd>{{ consent.pasien?.nama }} · RM {{ consent.pasien?.no_rm }} · lahir {{ tanggal(consent.pasien?.tanggal_lahir) }}</dd>
          <dt class="text-slate-500">Kunjungan</dt><dd>{{ consent.kunjungan?.no_registrasi }} · {{ tanggal(consent.kunjungan?.tanggal) }}</dd>
          <dt class="text-slate-500">Pemberi penjelasan</dt><dd>{{ consent.dokter?.name ?? '-' }}<template v-if="consent.dokter?.sip"> · SIP {{ consent.dokter.sip }}</template></dd>
        </dl>
        <p class="whitespace-pre-line">{{ consent.isi }}</p>
        <p class="font-semibold">
          Keputusan: {{ consent.status === 'ditolak' ? 'MENOLAK tindakan' : 'MENYETUJUI tindakan' }}
        </p>
        <div class="grid gap-6 sm:grid-cols-2">
          <figure>
            <figcaption class="text-xs text-slate-500">{{ HUBUNGAN_PENANDATANGAN[consent.hubungan] }}</figcaption>
            <img :src="consent.ttd_penandatangan" alt="Tanda tangan" class="h-28 w-full object-contain" draggable="false" @contextmenu.prevent />
            <p class="border-t border-slate-400 pt-1 text-center font-medium">{{ consent.penandatangan_nama }}</p>
          </figure>
          <figure v-if="consent.ttd_saksi">
            <figcaption class="text-xs text-slate-500">Saksi</figcaption>
            <img :src="consent.ttd_saksi" alt="Tanda tangan saksi" class="h-28 w-full object-contain" draggable="false" @contextmenu.prevent />
            <p class="border-t border-slate-400 pt-1 text-center font-medium">{{ consent.saksi_nama }}</p>
          </figure>
        </div>
        <p class="text-[11px] text-slate-500">
          Ditandatangani secara elektronik {{ waktu(consent.ditandatangani_at) }} · dicatat oleh {{ consent.pembuat?.name ?? '-' }} · ID {{ consent.uuid }}
        </p>
      </article>

      <div v-if="cabutOpen" class="mt-4 space-y-2">
        <label class="label" for="alasan-cabut">Alasan pencabutan *</label>
        <textarea id="alasan-cabut" v-model="alasan" rows="2" class="input" maxlength="500" placeholder="Mis. pasien berubah pikiran sebelum tindakan" />
      </div>
    </template>
    <template #footer>
      <template v-if="cabutOpen">
        <button class="btn btn-secondary" @click="cabutOpen = false">Batal</button>
        <button class="btn btn-danger" :disabled="!alasan.trim() || mencabut" @click="cabut"><AppSpinner v-if="mencabut" />Cabut persetujuan</button>
      </template>
      <template v-else>
        <button v-if="bisaCabut && consent?.status === 'disetujui'" class="btn btn-ghost text-rose-600" @click="cabutOpen = true">Cabut</button>
        <button class="btn btn-secondary" @click="open = false">Tutup</button>
        <button class="btn btn-primary" :disabled="!consent" @click="cetak">Cetak</button>
      </template>
    </template>
  </AppModal>
</template>
