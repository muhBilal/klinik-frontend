<script setup>
/**
 * Rencana perawatan gigi pasien (PRD DG-02): daftar rencana per fase dengan estimasi biaya, persetujuan pasien, revisi,
 * pembatalan, cetak estimasi. Di pemeriksaan (`bisaKerjakan`) item rencana bisa "Kerjakan" → menjadi tindakan kunjungan
 * (event `kerjakan`); item selesai saat kunjungan ditutup & ditandatangani.
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import RencanaPerawatanModal from '@/components/gigi/RencanaPerawatanModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import api, { errorMessage } from '@/lib/api'
import { jenisKelamin, rupiah, tanggal, waktu } from '@/lib/format'
import { formatGigi, labelFase } from '@/lib/gigi'
import { printElement } from '@/lib/print'
import { useAuthStore } from '@/stores/auth'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  /** Kunjungan pemeriksaan (rencana baru disusun di sini; harga dari cabangnya) */
  kunjungan: { type: Object, default: null },
  /** Pemeriksaan terbuka & dokter: item bisa dikerjakan */
  bisaKerjakan: { type: Boolean, default: false },
  /** id item rencana yang sudah ada di daftar tindakan pemeriksaan (belum/ sudah disimpan) */
  itemDipakai: { type: Array, default: () => [] },
  /** Gigi terpilih di odontogram, untuk mengisi item baru */
  gigiAwal: { type: Object, default: null },
})
const emit = defineEmits(['kerjakan'])
const auth = useAuthStore()
const klinik = useKlinikStore()
const toast = useToastStore()

const rencanas = ref([])
const memuat = ref(false)
const bekerja = ref(false)
const tampilRiwayat = ref(false)
const formOpen = ref(false)
const diubah = ref(null)
const aksi = reactive({ open: false, mode: '', rencana: null, nama: '', alasan: '' })
const dicetak = ref(null)

const bolehKelola = computed(() => auth.can('pemeriksaan.dokter'))
const bolehSetujui = computed(() => auth.can('pemeriksaan.dokter', 'rme.tindakan'))
const aktif = computed(() => rencanas.value.filter((r) => ['draf', 'disetujui'].includes(r.status)))
const riwayat = computed(() => rencanas.value.filter((r) => !['draf', 'disetujui'].includes(r.status)))
// Rencana disusun di cabang lain hanya bisa dibaca dari sini (backend menolak perubahan).
const cabangLain = (r) => auth.cabang && r.cabang_id && r.cabang_id !== auth.cabang.id

async function muat() {
  memuat.value = true
  try {
    rencanas.value = (await api.get(`/pasiens/${props.pasien.id}/rencana-perawatans`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuat.value = false
  }
}

defineExpose({ muatUlang: muat })

function ganti(data) {
  const i = rencanas.value.findIndex((r) => r.id === data.id)
  if (i >= 0) rencanas.value.splice(i, 1, data)
  else rencanas.value.unshift(data)
}

function baru() {
  diubah.value = null
  formOpen.value = true
}

function ubah(r) {
  diubah.value = r
  formOpen.value = true
}

function bukaAksi(mode, r) {
  Object.assign(aksi, { open: true, mode, rencana: r, nama: props.pasien.nama, alasan: '' })
}

async function jalankan(promise, pesan) {
  bekerja.value = true
  try {
    ganti((await promise).data)
    toast.success(pesan)
    aksi.open = false
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    bekerja.value = false
  }
}

function kirimAksi() {
  const r = aksi.rencana
  if (aksi.mode === 'setujui') return jalankan(api.post(`/rencana-perawatans/${r.id}/setujui`, { penyetuju_nama: aksi.nama || null }), 'Persetujuan pasien dicatat.')
  return jalankan(api.post(`/rencana-perawatans/${r.id}/batal`, { alasan: aksi.alasan }), 'Rencana dibatalkan.')
}

const revisi = (r) =>
  confirm('Buka revisi? Status kembali ke draf dan persetujuan pasien harus dicatat ulang setelah diubah.') &&
  jalankan(api.post(`/rencana-perawatans/${r.id}/revisi`), 'Rencana kembali ke draf.')

/** Item per fase untuk tampilan tabel. */
const perFase = (r) => {
  const peta = new Map()
  for (const i of r.items) peta.set(i.fase, [...(peta.get(i.fase) ?? []), i])
  return [...peta].sort(([a], [b]) => a - b)
}

/** Sedang dikerjakan di kunjungan yang masih terbuka (bukan selesai). */
const sedangDikerjakan = (item) => item.status === 'rencana' && item.pelaksanaan && ['menunggu', 'diperiksa'].includes(item.pelaksanaan.kunjungan?.status)
const dipakaiDiSini = (item) => props.itemDipakai.includes(item.id)

function kerjakan(item, r) {
  emit('kerjakan', { ...item, rencana_judul: r.judul })
}

async function cetak(r) {
  dicetak.value = r
  await nextTick()
  printElement('#cetak-rencana', r.judul)
}

watch(() => props.pasien.id, muat)
onMounted(muat)
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">Rencana Perawatan Gigi</h2>
      <AppSpinner v-if="memuat" class="text-slate-400" />
      <button v-if="bolehKelola" type="button" class="btn btn-secondary btn-sm ml-auto" @click="baru">+ Rencana baru</button>
    </div>
    <div class="card-body space-y-4">
      <article v-for="r in [...aktif, ...(tampilRiwayat ? riwayat : [])]" :key="r.id" class="rounded-2xl border border-line bg-white/40 p-3 text-sm">
        <header class="flex flex-wrap items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ r.judul }}</p>
            <p class="text-xs text-slate-500">
              {{ tanggal(r.created_at) }} · {{ r.dokter?.name ?? '-' }}<template v-if="r.cabang"> · {{ r.cabang.nama }}</template>
              <template v-if="r.disetujui_at"> · disetujui {{ r.penyetuju_nama }} ({{ waktu(r.disetujui_at) }})</template>
            </p>
            <p v-if="r.catatan" class="text-xs text-slate-600">{{ r.catatan }}</p>
            <p v-if="r.status === 'dibatalkan'" class="text-xs text-rose-700">Dibatalkan: {{ r.alasan_batal }}</p>
          </div>
          <StatusBadge :status="r.status" />
        </header>

        <div class="mt-2 overflow-x-auto">
          <table class="table text-sm">
            <tbody>
              <template v-for="[fase, items] in perFase(r)" :key="fase">
                <tr><td colspan="4" class="bg-slate-900/5 py-1 text-xs font-semibold text-slate-600">{{ labelFase(fase) }}</td></tr>
                <tr v-for="item in items" :key="item.id" :class="{ 'text-slate-400 line-through': item.status === 'batal' }">
                  <td class="w-24 whitespace-nowrap tabular-nums">{{ item.gigi ? `${item.gigi}${item.permukaan ? ' ' + item.permukaan : ''}` : '—' }}</td>
                  <td>
                    {{ item.tindakan?.nama }}<span v-if="item.jumlah > 1"> × {{ item.jumlah }}</span>
                    <span v-if="item.keterangan" class="block text-xs text-slate-500">{{ item.keterangan }}</span>
                  </td>
                  <td class="w-28 text-right tabular-nums">{{ rupiah(item.tarif * item.jumlah) }}</td>
                  <td class="w-40 text-right text-xs">
                    <span v-if="item.status === 'selesai'" class="text-emerald-700">✓ {{ tanggal(item.selesai_at) }}</span>
                    <span v-else-if="dipakaiDiSini(item)" class="text-slate-500">ada di tindakan</span>
                    <span v-else-if="sedangDikerjakan(item)" class="text-amber-700">dikerjakan · {{ item.pelaksanaan.kunjungan.no_registrasi }}</span>
                    <button v-else-if="bisaKerjakan && item.status === 'rencana' && ['draf', 'disetujui'].includes(r.status)" type="button" class="btn btn-secondary btn-sm" @click="kerjakan(item, r)">Kerjakan</button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <footer class="mt-2 flex flex-wrap items-center gap-2">
          <p class="text-xs text-slate-500">
            Estimasi <b class="text-sm text-slate-900 tabular-nums">{{ rupiah(r.estimasi_total) }}</b>
            <template v-if="r.estimasi_selesai"> · sudah dikerjakan {{ rupiah(r.estimasi_selesai) }}</template>
          </p>
          <div class="ml-auto flex flex-wrap gap-1.5">
            <button type="button" class="btn btn-ghost btn-sm" @click="cetak(r)">Cetak</button>
            <template v-if="!cabangLain(r)">
              <button v-if="r.status === 'draf' && bolehKelola" type="button" class="btn btn-ghost btn-sm" @click="ubah(r)">Ubah</button>
              <button v-if="r.status === 'disetujui' && bolehKelola" type="button" class="btn btn-ghost btn-sm" :disabled="bekerja" @click="revisi(r)">Revisi</button>
              <button v-if="['draf', 'disetujui'].includes(r.status) && bolehKelola" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="bukaAksi('batal', r)">Batalkan</button>
              <button v-if="r.status === 'draf' && bolehSetujui" type="button" class="btn btn-primary btn-sm" @click="bukaAksi('setujui', r)">Pasien setuju</button>
            </template>
          </div>
        </footer>
      </article>

      <p v-if="!memuat && !aktif.length" class="text-sm text-slate-400">
        Belum ada rencana perawatan berjalan.<template v-if="bolehKelola"> Susun rencana per gigi lengkap dengan fase & estimasi biaya.</template>
      </p>
      <button v-if="riwayat.length" type="button" class="text-xs text-slate-500 hover:text-slate-900 hover:underline" @click="tampilRiwayat = !tampilRiwayat">
        {{ tampilRiwayat ? 'Sembunyikan' : 'Tampilkan' }} rencana selesai / dibatalkan ({{ riwayat.length }})
      </button>
    </div>

    <RencanaPerawatanModal v-model="formOpen" :pasien="pasien" :rencana="diubah" :kunjungan="kunjungan" :gigi-awal="gigiAwal" @saved="ganti" />

    <AppModal v-model="aksi.open" :title="aksi.mode === 'setujui' ? 'Persetujuan Rencana Perawatan' : 'Batalkan Rencana Perawatan'">
      <form id="form-aksi-rencana" class="space-y-3 text-sm" @submit.prevent="kirimAksi">
        <template v-if="aksi.mode === 'setujui'">
          <p>Pasien/wali menyetujui rencana <b>{{ aksi.rencana?.judul }}</b> dengan estimasi <b>{{ rupiah(aksi.rencana?.estimasi_total) }}</b>.</p>
          <div>
            <label class="label" for="rp-penyetuju">Nama yang menyetujui</label>
            <input id="rp-penyetuju" v-model="aksi.nama" class="input" maxlength="150" />
          </div>
          <p class="text-xs text-slate-500">Cetak estimasi untuk ditandatangani pasien bila klinik memerlukan bukti tertulis.</p>
        </template>
        <div v-else>
          <label class="label" for="rp-alasan">Alasan pembatalan *</label>
          <textarea id="rp-alasan" v-model="aksi.alasan" rows="2" class="input" maxlength="500" required />
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="aksi.open = false">Tutup</button>
        <button form="form-aksi-rencana" :class="aksi.mode === 'setujui' ? 'btn-primary' : 'btn-danger'" class="btn" :disabled="bekerja || (aksi.mode === 'batal' && !aksi.alasan.trim())">
          <AppSpinner v-if="bekerja" />{{ aksi.mode === 'setujui' ? 'Catat persetujuan' : 'Batalkan rencana' }}
        </button>
      </template>
    </AppModal>

    <!-- Lembar estimasi untuk dicetak (printElement menyalin elemen ini) -->
    <div class="hidden">
      <article v-if="dicetak" id="cetak-rencana" class="space-y-4 text-sm text-slate-800">
        <header class="border-b border-slate-300 pb-3 text-center">
          <p class="text-base font-bold">{{ klinik.nama }}</p>
          <p class="text-xs text-slate-600">
            {{ dicetak.cabang?.nama }}<template v-if="dicetak.cabang?.alamat"> · {{ dicetak.cabang.alamat }}</template><template v-if="dicetak.cabang?.telepon"> · {{ dicetak.cabang.telepon }}</template>
          </p>
        </header>
        <h3 class="text-center text-base font-semibold uppercase tracking-wide">Rencana Perawatan & Estimasi Biaya</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt class="text-slate-500">Pasien</dt><dd>{{ pasien.nama }} · RM {{ pasien.no_rm }} · {{ jenisKelamin(pasien.jenis_kelamin) }}</dd>
          <dt class="text-slate-500">Rencana</dt><dd>{{ dicetak.judul }} · {{ tanggal(dicetak.created_at) }}</dd>
          <dt class="text-slate-500">Dokter</dt><dd>{{ dicetak.dokter?.name ?? '-' }}<template v-if="dicetak.dokter?.sip"> · SIP {{ dicetak.dokter.sip }}</template></dd>
        </dl>
        <table class="w-full border-collapse text-xs">
          <thead><tr class="border-b border-slate-400 text-left"><th class="py-1">Gigi</th><th>Tindakan</th><th class="text-right">Jml</th><th class="text-right">Estimasi</th></tr></thead>
          <tbody>
            <template v-for="[fase, items] in perFase(dicetak)" :key="fase">
              <tr><td colspan="4" class="pt-2 font-semibold">{{ labelFase(fase) }}</td></tr>
              <tr v-for="item in items.filter((i) => i.status !== 'batal')" :key="item.id" class="border-b border-slate-200">
                <td class="py-1">{{ formatGigi(item.gigi, item.permukaan) || '—' }}</td>
                <td>{{ item.tindakan?.nama }}<template v-if="item.keterangan"> — {{ item.keterangan }}</template></td>
                <td class="text-right">{{ item.jumlah }}</td>
                <td class="text-right tabular-nums">{{ rupiah(item.tarif * item.jumlah) }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot><tr class="border-t border-slate-400 font-semibold"><td colspan="3" class="py-1">Estimasi total</td><td class="text-right tabular-nums">{{ rupiah(dicetak.estimasi_total) }}</td></tr></tfoot>
        </table>
        <p class="text-[11px] text-slate-500">
          Estimasi dapat berubah sesuai kondisi klinis saat tindakan dan harga yang berlaku saat tindakan dikerjakan.
        </p>
        <div class="grid grid-cols-2 gap-10 pt-6 text-center text-xs">
          <div><p class="h-16">Pasien / wali</p><p class="border-t border-slate-400 pt-1">{{ dicetak.penyetuju_nama ?? pasien.nama }}</p></div>
          <div><p class="h-16">Dokter gigi</p><p class="border-t border-slate-400 pt-1">{{ dicetak.dokter?.name ?? '' }}</p></div>
        </div>
      </article>
    </div>
  </div>
</template>
