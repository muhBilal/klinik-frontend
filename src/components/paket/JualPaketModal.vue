<script setup>
/**
 * Paket multi-sesi (PRD TR-02), dua mode:
 * - jual langsung (kasir): pilih pasien (bila belum ditentukan) & paket → paket menunggu bayar + tagihan mandiri → halaman tagihan;
 * - `kunjungan` diisi (dokter/terapis di pemeriksaan): paket dipesan untuk kunjungan itu → ditagihkan bersama tagihan kunjungan saat
 *   pemeriksaan ditutup; sesi pertama boleh langsung dipakai di kunjungan yang sama. Emit `dipesan(paket)`.
 */
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import api, { errorMessage } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { rupiah } from '@/lib/format'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  pasien: { type: Object, default: null },
  kunjungan: { type: Object, default: null },
})
const emit = defineEmits(['dipesan'])
const toast = useToastStore()
const router = useRouter()

const katalog = ref([])
const dipilihPasien = ref(null)
const paketId = ref(null)
const catatan = ref('')
const menjual = ref(false)

watch(open, async (v) => {
  if (!v) return
  dipilihPasien.value = props.pasien
  paketId.value = null
  catatan.value = ''
  try {
    katalog.value = await cachedGet('/pakets', { aktif: 1 })
  } catch (e) {
    toast.error(errorMessage(e))
  }
})

async function proses() {
  if (!dipilihPasien.value || !paketId.value) return
  menjual.value = true
  try {
    const body = { paket_id: paketId.value, catatan: catatan.value || null }
    if (props.kunjungan) {
      const { data } = await api.post(`/kunjungans/${props.kunjungan.id}/pakets`, body)
      toast.success(`Paket ${data.nama} dipesan — ditagihkan bersama tagihan kunjungan ini.`)
      open.value = false
      emit('dipesan', data)
      return
    }
    const { data } = await api.post(`/pasiens/${dipilihPasien.value.id}/pakets`, body)
    toast.success(`Paket ${data.no_paket} dibuat. Selesaikan pembayaran untuk mengaktifkannya.`)
    open.value = false
    router.push(`/kasir/${data.tagihan_id}`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    menjual.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="kunjungan ? 'Pesan Paket untuk Pasien' : 'Jual Paket'" size="max-w-2xl">
    <form id="form-jual-paket" class="space-y-3" @submit.prevent="proses">
      <div v-if="!pasien">
        <p class="label">Pasien *</p>
        <p v-if="dipilihPasien" class="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2 text-sm">
          <span>{{ dipilihPasien.nama }} <span class="text-xs text-slate-500">RM {{ dipilihPasien.no_rm }}</span></span>
          <button type="button" class="text-xs text-slate-500 hover:text-slate-900" @click="dipilihPasien = null">ganti</button>
        </p>
        <AsyncSelect v-else endpoint="/pasiens" placeholder="Cari nama / No. RM / NIK..." @select="(p) => (dipilihPasien = p)">
          <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">RM {{ item.no_rm }}</span></template>
        </AsyncSelect>
      </div>
      <p v-else class="text-sm text-slate-600">Untuk <b>{{ pasien.nama }}</b>.</p>
      <p v-if="kunjungan" class="text-xs text-slate-500">
        Harga paket ditagihkan bersama tagihan kunjungan ini; pasien cukup membayar sekali di kasir. Sesi pertama boleh langsung dipakai
        hari ini. Paket aktif setelah tagihan lunas; masa berlaku dihitung sejak lunas.
      </p>
      <p v-else class="text-xs text-slate-500">Paket aktif setelah tagihan lunas; masa berlaku dihitung sejak lunas.</p>

      <label v-for="k in katalog" :key="k.id" class="choice flex cursor-pointer items-start gap-3 text-sm" :class="{ 'choice-active': paketId === k.id }">
        <input v-model="paketId" type="radio" :value="k.id" class="mt-1 accent-brand-900" />
        <span class="flex-1">
          <b>{{ k.nama }}</b> <span class="text-xs text-slate-500">{{ k.kode }}</span>
          <span class="block text-xs text-slate-600">{{ k.items.map((i) => `${i.tindakan?.nama} ×${i.jumlah_sesi}`).join(' · ') }}</span>
          <span class="block text-xs text-slate-500">{{ k.masa_berlaku_hari ? `Berlaku ${k.masa_berlaku_hari} hari` : 'Tanpa batas waktu' }}<template v-if="!k.lintas_cabang"> · hanya cabang pembelian</template></span>
        </span>
        <span class="text-right tabular-nums">
          <b>{{ rupiah(k.harga) }}</b>
          <s v-if="k.nilai_normal > k.harga" class="block text-xs text-slate-400">{{ rupiah(k.nilai_normal) }}</s>
        </span>
      </label>
      <p v-if="!katalog.length" class="text-sm text-slate-400">Belum ada paket aktif di katalog (Master Data → Paket Treatment).</p>
      <input v-model="catatan" class="input" maxlength="255" placeholder="Catatan (opsional)" />
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="open = false">Batal</button>
      <button form="form-jual-paket" class="btn btn-primary" :disabled="menjual || !paketId || !dipilihPasien"><AppSpinner v-if="menjual" />{{ kunjungan ? 'Pesan paket' : 'Buat tagihan' }}</button>
    </template>
  </AppModal>
</template>
