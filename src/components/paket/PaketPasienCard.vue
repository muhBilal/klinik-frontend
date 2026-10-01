<script setup>
/**
 * Paket multi-sesi milik pasien (PRD TR-02): sisa sesi per treatment, masa berlaku, riwayat pemakaian, jual paket (kasir),
 * dan tindakan kebijakan (perpanjang, alihkan ke pasien lain, refund sisa) untuk pemegang `kasir.void`.
 * `ringkas` = tampilan samping pemeriksaan: hanya paket yang masih bisa dipakai (+ pesanan di kunjungan `kunjunganId`), tanpa aksi;
 * disembunyikan bila tidak ada.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import AsyncSelect from '@/components/AsyncSelect.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import JualPaketModal from '@/components/paket/JualPaketModal.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { rupiah, tanggal, waktu } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  pasien: { type: Object, required: true },
  ringkas: { type: Boolean, default: false },
  kunjunganId: { type: Number, default: null },
})
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const toast = useToastStore()

const pakets = ref([])
const memuat = ref(false)
const terbuka = ref(null)
const detail = ref(null)
const tampilSelesai = ref(false)

const BISA_DIPAKAI = ['aktif', 'menunggu_bayar']
const daftar = computed(() => {
  const utama = pakets.value.filter((p) => BISA_DIPAKAI.includes(p.status_efektif))
  return props.ringkas || !tampilSelesai.value ? utama : pakets.value
})
const jumlahLain = computed(() => pakets.value.filter((p) => !BISA_DIPAKAI.includes(p.status_efektif)).length)

async function muat() {
  memuat.value = true
  try {
    const params = props.ringkas ? { aktif: 1, ...(props.kunjunganId ? { kunjungan_id: props.kunjunganId } : {}) } : {}
    pakets.value = (await api.get(`/pasiens/${props.pasien.id}/pakets`, { params })).data
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    memuat.value = false
  }
}

defineExpose({ muatUlang: muat })

async function toggleRiwayat(p) {
  if (terbuka.value === p.id) return (terbuka.value = null)
  terbuka.value = p.id
  detail.value = null
  try {
    detail.value = (await api.get(`/paket-pasiens/${p.id}`)).data
  } catch (e) {
    toast.error(errorMessage(e))
  }
}

const persen = (item) => (item.jumlah_sesi ? Math.round((item.sisa / item.jumlah_sesi) * 100) : 0)

const jualOpen = ref(false)

// ---- Kebijakan: perpanjang, alihkan, refund sisa (kasir.void) ----
const aksi = reactive({ open: false, mode: '', paket: null, berlaku_sampai: '', pasien: null, metode: 'tunai', referensi: '', alasan: '', simulasi: null })
const errors = ref({})
const bekerja = ref(false)
const JUDUL = { perpanjang: 'Perpanjang Masa Berlaku', alihkan: 'Alihkan Sisa Paket', refund: 'Refund Sisa Paket' }

async function bukaAksi(mode, p) {
  errors.value = {}
  Object.assign(aksi, { open: true, mode, paket: p, berlaku_sampai: '', pasien: null, metode: 'tunai', referensi: '', alasan: '', simulasi: null })
  if (mode === 'refund') {
    try {
      aksi.simulasi = (await api.get(`/paket-pasiens/${p.id}`)).data.refund_sisa
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
}

async function kirimAksi() {
  const { mode, paket } = aksi
  const body =
    mode === 'perpanjang'
      ? { berlaku_sampai: aksi.berlaku_sampai, alasan: aksi.alasan }
      : mode === 'alihkan'
        ? { pasien_id: aksi.pasien?.id, alasan: aksi.alasan }
        : { metode: aksi.metode, referensi: aksi.referensi || null, alasan: aksi.alasan }
  bekerja.value = true
  errors.value = {}
  try {
    const { data } = await api.post(`/paket-pasiens/${paket.id}/${mode}`, body)
    toast.success(
      mode === 'perpanjang' ? 'Masa berlaku diperpanjang.' : mode === 'alihkan' ? `Sisa sesi dialihkan ke ${aksi.pasien.nama} (${data.no_paket}).` : `Refund ${rupiah(data.refund_nominal)} dicatat.`,
    )
    aksi.open = false
    terbuka.value = null
    await muat()
    emit('changed')
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    bekerja.value = false
  }
}

watch(() => props.pasien.id, muat)
onMounted(muat)
</script>

<template>
  <div v-if="!ringkas || pakets.length" class="card">
    <div class="card-header">
      <h2 class="card-title">Paket Treatment</h2>
      <AppSpinner v-if="memuat" class="text-slate-400" />
      <button v-if="!ringkas && auth.can('kasir.tagihan')" type="button" class="btn btn-secondary btn-sm ml-auto" @click="jualOpen = true">+ Jual paket</button>
    </div>
    <div class="card-body space-y-3">
      <article v-for="p in daftar" :key="p.id" class="rounded-2xl border border-line bg-white/40 p-3 text-sm">
        <header class="flex flex-wrap items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ p.nama }}</p>
            <p class="text-xs text-slate-500">
              <span class="tabular-nums">{{ p.no_paket }}</span>
              <template v-if="p.berlaku_sampai"> · berlaku s.d. {{ tanggal(p.berlaku_sampai) }}</template>
              <template v-else-if="p.status === 'aktif'"> · tanpa batas waktu</template>
              <template v-if="!p.lintas_cabang && p.cabang"> · hanya {{ p.cabang.nama }}</template>
            </p>
            <p v-if="p.kunjungan && p.status === 'menunggu_bayar'" class="text-xs text-slate-500">
              Dipesan {{ p.pembuat?.name ?? '' }} di kunjungan {{ p.kunjungan.no_registrasi }} — ditagihkan bersama tagihan kunjungan
            </p>
            <p v-if="p.dialihkan_dari" class="text-xs text-slate-500">Dialihkan dari {{ p.dialihkan_dari.no_paket }} ({{ p.dialihkan_dari.pasien?.nama }})</p>
            <p v-if="p.dialihkan_ke" class="text-xs text-slate-500">Sisa dialihkan ke {{ p.dialihkan_ke.no_paket }} ({{ p.dialihkan_ke.pasien?.nama }})</p>
            <p v-if="p.status === 'direfund'" class="text-xs text-slate-500">Refund {{ rupiah(p.refund_nominal) }} · {{ waktu(p.direfund_at) }}</p>
          </div>
          <StatusBadge :status="p.status_efektif" />
        </header>

        <ul class="mt-2 space-y-1.5">
          <li v-for="i in p.items" :key="i.id">
            <div class="flex justify-between gap-2 text-xs">
              <span>{{ i.tindakan?.nama }}</span>
              <span class="tabular-nums"><b>{{ i.sisa }}</b> / {{ i.jumlah_sesi }} sesi tersisa<template v-if="i.dipesan"> · {{ i.dipesan }} sedang dipakai</template></span>
            </div>
            <div class="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-900/10">
              <div class="h-full rounded-full bg-brand-900" :style="{ width: `${persen(i)}%` }" />
            </div>
          </li>
        </ul>

        <footer v-if="!ringkas" class="mt-2 flex flex-wrap items-center gap-1.5">
          <RouterLink v-if="p.status === 'menunggu_bayar' && p.tagihan && auth.can('kasir.tagihan')" :to="`/kasir/${p.tagihan.id}`" class="btn btn-primary btn-sm">
            Bayar {{ rupiah(p.tagihan.grand_total) }}
          </RouterLink>
          <span v-else-if="p.status === 'menunggu_bayar'" class="text-xs text-amber-700">
            {{ p.tagihan ? `Aktif setelah tagihan ${p.tagihan.no_tagihan} lunas` : 'Ditagihkan saat pemeriksaan ditutup' }}
          </span>
          <button type="button" class="btn btn-ghost btn-sm" @click="toggleRiwayat(p)">{{ terbuka === p.id ? 'Tutup riwayat' : 'Riwayat pemakaian' }}</button>
          <template v-if="auth.can('kasir.void') && p.status === 'aktif'">
            <button type="button" class="btn btn-ghost btn-sm" @click="bukaAksi('perpanjang', p)">Perpanjang</button>
            <button v-if="p.sisa_sesi" type="button" class="btn btn-ghost btn-sm" @click="bukaAksi('alihkan', p)">Alihkan</button>
            <button v-if="p.sisa_sesi" type="button" class="btn btn-ghost btn-sm text-rose-600" @click="bukaAksi('refund', p)">Refund sisa</button>
          </template>
        </footer>

        <div v-if="terbuka === p.id" class="mt-2 border-t border-line pt-2 text-xs">
          <AppSpinner v-if="!detail" class="text-slate-400" />
          <template v-else>
            <p v-if="detail.nilai !== null" class="text-slate-500">
              Nilai paket {{ rupiah(detail.nilai) }} · terpakai {{ rupiah(detail.nilai_terpakai) }}<template v-if="detail.tagihan"> · tagihan {{ detail.tagihan.no_tagihan }}</template>
            </p>
            <ul class="mt-1 space-y-0.5">
              <li v-for="u in detail.pemakaian" :key="u.id" class="flex flex-wrap justify-between gap-2">
                <span>{{ tanggal(u.kunjungan?.tanggal) }} · {{ u.tindakan?.nama }}<template v-if="u.jumlah > 1"> ×{{ u.jumlah }}</template></span>
                <span class="text-slate-500">
                  {{ u.petugas?.name ?? '-' }}<template v-if="u.kunjungan?.cabang"> · {{ u.kunjungan.cabang.nama }}</template>
                  <template v-if="['menunggu', 'diperiksa'].includes(u.kunjungan?.status)"> · berlangsung</template>
                </span>
              </li>
              <li v-if="!detail.pemakaian.length" class="text-slate-400">Belum ada sesi yang dipakai.</li>
            </ul>
          </template>
        </div>
      </article>

      <p v-if="!memuat && !daftar.length" class="text-sm text-slate-400">Pasien belum punya paket aktif.</p>
      <button v-if="!ringkas && jumlahLain" type="button" class="text-xs text-slate-500 hover:text-slate-900 hover:underline" @click="tampilSelesai = !tampilSelesai">
        {{ tampilSelesai ? 'Sembunyikan' : 'Tampilkan' }} paket habis / kedaluwarsa / dibatalkan ({{ jumlahLain }})
      </button>
    </div>

    <JualPaketModal v-if="!ringkas" v-model="jualOpen" :pasien="pasien" />

    <!-- Perpanjang / alihkan / refund sisa -->
    <AppModal v-model="aksi.open" :title="JUDUL[aksi.mode]">
      <form id="form-aksi-paket" class="space-y-3 text-sm" @submit.prevent="kirimAksi">
        <p>Paket <b>{{ aksi.paket?.no_paket }}</b> · {{ aksi.paket?.nama }} · sisa {{ aksi.paket?.sisa_sesi }} sesi</p>
        <div v-if="aksi.mode === 'perpanjang'">
          <label class="label" for="pp-sampai">Berlaku sampai *</label>
          <input id="pp-sampai" v-model="aksi.berlaku_sampai" type="date" class="input" :class="{ 'input-error': errors.berlaku_sampai }" required />
          <p v-if="errors.berlaku_sampai" class="field-error">{{ errors.berlaku_sampai }}</p>
        </div>
        <div v-else-if="aksi.mode === 'alihkan'">
          <p class="label">Pasien penerima *</p>
          <p v-if="aksi.pasien" class="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2">
            <span>{{ aksi.pasien.nama }} <span class="text-xs text-slate-500">RM {{ aksi.pasien.no_rm }}</span></span>
            <button type="button" class="text-xs text-slate-500 hover:text-slate-900" @click="aksi.pasien = null">ganti</button>
          </p>
          <AsyncSelect v-else endpoint="/pasiens" placeholder="Cari nama / No. RM..." @select="(p) => (aksi.pasien = p)">
            <template #default="{ item }">{{ item.nama }} <span class="text-xs text-slate-500">RM {{ item.no_rm }}</span></template>
          </AsyncSelect>
          <p v-if="errors.pasien_id" class="field-error">{{ errors.pasien_id }}</p>
          <p class="mt-1 text-xs text-slate-500">Hanya bila kebijakan klinik mengizinkan (Pengaturan → Paket). Masa berlaku tetap sama.</p>
        </div>
        <template v-else>
          <div v-if="aksi.simulasi" class="rounded-2xl bg-slate-900/5 px-3 py-2">
            <p>Nilai sesi tersisa {{ rupiah(aksi.simulasi.sisa_nilai) }}<template v-if="aksi.simulasi.potongan"> − potongan {{ aksi.simulasi.potongan_persen }}% ({{ rupiah(aksi.simulasi.potongan) }})</template></p>
            <p class="text-base font-semibold">Dikembalikan {{ rupiah(aksi.simulasi.nominal) }}</p>
            <p v-if="!aksi.simulasi.diizinkan" class="text-xs text-rose-700">Kebijakan klinik saat ini tidak mengizinkan refund sisa paket (Pengaturan → Paket).</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="pr-metode">Dikembalikan lewat</label>
              <select id="pr-metode" v-model="aksi.metode" class="input">
                <option value="tunai">Tunai (mengurangi kas shift)</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label class="label" for="pr-ref">Referensi</label>
              <input id="pr-ref" v-model="aksi.referensi" class="input" maxlength="100" placeholder="No. transfer (opsional)" />
            </div>
          </div>
        </template>
        <div>
          <label class="label" for="pa-alasan">Alasan *</label>
          <textarea id="pa-alasan" v-model="aksi.alasan" rows="2" class="input" maxlength="500" required />
        </div>
        <p v-if="errors.status" class="field-error">{{ errors.status }}</p>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="aksi.open = false">Batal</button>
        <button form="form-aksi-paket" :class="aksi.mode === 'refund' ? 'btn-danger' : 'btn-primary'" class="btn" :disabled="bekerja || !aksi.alasan.trim() || (aksi.mode === 'alihkan' && !aksi.pasien)">
          <AppSpinner v-if="bekerja" />{{ { perpanjang: 'Perpanjang', alihkan: 'Alihkan', refund: 'Proses refund' }[aksi.mode] }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
