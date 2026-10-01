<script setup>
/**
 * Pilih template SOAP (PRD RM-01): template poli kunjungan + template umum; treatment yang sedang dicatat diurutkan
 * lebih dulu. Hanya mengisi form — dokter tetap memeriksa lalu menyimpan.
 */
import { computed, ref, watch } from 'vue'
import AppModal from '@/components/AppModal.vue'
import AppSpinner from '@/components/AppSpinner.vue'
import api, { errorMessage } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

const open = defineModel({ type: Boolean, default: false })
const props = defineProps({
  poliId: { type: Number, default: null },
  /** tindakan_id yang sudah dipilih di pemeriksaan (untuk urutan relevansi). */
  tindakanIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['terapkan'])
const toast = useToastStore()

const SOAP = [['subjektif', 'S'], ['objektif', 'O'], ['asesmen', 'A'], ['plan', 'P']]
const MODE = [
  ['kosong', 'Isi bagian yang masih kosong'],
  ['tambah', 'Tambahkan di bawah isi yang ada'],
  ['timpa', 'Timpa semua bagian'],
]

const templates = ref([])
const loading = ref(false)
const semuaPoli = ref(false)
const q = ref('')
const dipilih = ref(null)
const mode = ref('kosong')

const daftar = computed(() => {
  const cari = q.value.trim().toLowerCase()
  return templates.value
    .filter((t) => !cari || t.nama.toLowerCase().includes(cari))
    .map((t) => ({ ...t, cocok: t.tindakan_id && props.tindakanIds.includes(t.tindakan_id) }))
    .sort((a, b) => Number(b.cocok) - Number(a.cocok))
})

async function muat() {
  loading.value = true
  try {
    templates.value = (await api.get('/template-soaps', { params: { aktif: 1, poli_id: semuaPoli.value ? undefined : props.poliId } })).data
    dipilih.value = daftar.value[0] ?? null
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    loading.value = false
  }
}

watch(open, (buka) => {
  if (!buka) return
  q.value = ''
  mode.value = 'kosong'
  muat()
})
watch(semuaPoli, muat)

function terapkan() {
  emit('terapkan', { template: dipilih.value, mode: mode.value })
  open.value = false
}

async function salinTeks() {
  if (!dipilih.value) return
  const t = dipilih.value
  const teks = [
    `S: ${t.subjektif || '-'}`,
    `O: ${t.objektif || '-'}`,
    `A: ${t.asesmen || '-'}`,
    `P: ${t.plan || '-'}`,
  ].join('\n\n')
  try {
    await navigator.clipboard.writeText(teks)
    toast.success('Teks SOAP disalin ke clipboard.')
  } catch {
    toast.error('Gagal menyalin teks.')
  }
}
</script>

<template>
  <AppModal v-model="open" title="Template SOAP" size="max-w-4xl">
    <div class="grid gap-5 md:grid-cols-[16rem_1fr]">
      <div class="space-y-3">
        <input v-model="q" type="search" class="input" placeholder="Cari template..." />
        <label class="flex items-center gap-2 text-xs text-slate-500"><input v-model="semuaPoli" type="checkbox" class="accent-brand-600" /> Tampilkan template semua poli</label>
        <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500"><AppSpinner />Memuat...</div>
        <ul v-else class="max-h-96 space-y-1 overflow-y-auto">
          <li v-for="t in daftar" :key="t.id">
            <button
              type="button"
              :class="dipilih?.id === t.id ? 'bg-brand-900 text-white' : 'hover:bg-slate-900/5'"
              class="w-full rounded-xl px-3 py-2 text-left text-sm transition"
              @click="dipilih = t"
            >
              <span class="font-medium">{{ t.nama }}</span>
              <span class="block text-xs opacity-70">
                {{ t.poli?.nama ?? 'Semua poli' }}<template v-if="t.tindakan"> · {{ t.tindakan.nama }}</template><template v-if="t.akses_terbatas"> · 🔒 akses terbatas</template>
              </span>
            </button>
          </li>
          <li v-if="!daftar.length" class="px-3 py-4 text-sm text-slate-400">Belum ada template untuk poli ini.</li>
        </ul>
      </div>

      <div v-if="dipilih" class="min-w-0 space-y-3 text-sm">
        <dl class="space-y-3">
          <div v-for="[key, huruf] in SOAP" :key="key">
            <dt class="text-xs font-semibold text-slate-500">{{ huruf }}</dt>
            <dd class="whitespace-pre-line rounded-xl bg-white/50 px-3 py-2">{{ dipilih[key] || '—' }}</dd>
          </div>
        </dl>
        <p v-if="dipilih.diagnosas?.length" class="text-xs text-slate-500">
          Saran diagnosa: <b v-for="d in dipilih.diagnosas" :key="d.id" class="mr-2 text-slate-700">{{ d.kode }} {{ d.nama }}</b>
        </p>
        <p v-if="dipilih.akses_terbatas" class="alert alert-warning">Kunjungan akan ditandai berakses terbatas (hanya tim yang menangani yang dapat membuka rekam medisnya).</p>
        <fieldset class="space-y-1">
          <legend class="label">Cara menerapkan</legend>
          <label v-for="[val, label] in MODE" :key="val" class="flex items-center gap-2"><input v-model="mode" type="radio" :value="val" class="accent-brand-600" /> {{ label }}</label>
        </fieldset>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn btn-secondary mr-auto" :disabled="!dipilih" @click="salinTeks">Salin Teks</button>
      <button class="btn btn-secondary" @click="open = false">Batal</button>
      <button class="btn btn-primary" :disabled="!dipilih" @click="terapkan">Terapkan template</button>
    </template>
  </AppModal>
</template>
