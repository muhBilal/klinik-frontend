<script setup>
/**
 * Ringkasan satu kunjungan: tanda vital, SOAP, diagnosa, tindakan (+ ICD-9-CM, petugas, catatan tindakan), informed consent,
 * resep, tanda tangan dokter & addendum. Kunjungan berakses terbatas yang bukan hak user (`rme_disembunyikan`) tidak berisi RME.
 */
import { ref } from 'vue'
import ConsentLihatModal from '@/components/rme/ConsentLihatModal.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { BAGIAN_ADDENDUM, PARAMETER_ALAT, REAKSI_KULIT, angka, waktu } from '@/lib/format'

defineProps({ kunjungan: { type: Object, required: true } })

const vital = [
  ['tekanan_darah', 'TD', 'mmHg'],
  ['nadi', 'Nadi', 'x/mnt'],
  ['suhu', 'Suhu', '°C'],
  ['respirasi', 'RR', 'x/mnt'],
  ['berat_badan', 'BB', 'kg'],
  ['tinggi_badan', 'TB', 'cm'],
]
const soap = [
  ['subjektif', 'S — Subjektif'],
  ['objektif', 'O — Objektif'],
  ['asesmen', 'A — Asesmen'],
  ['plan', 'P — Plan'],
]

/** Ringkasan parameter energy device, mis. "1064 nm · 2,5 J/cm² · 1500 shot · Eritema ringan". */
function ringkasParameter(p) {
  if (!p) return ''
  const angkaParam = PARAMETER_ALAT.filter(([key]) => p[key] !== undefined && p[key] !== null).map(([key, , unit]) => `${angka(p[key])} ${unit}`)
  return [...angkaParam, p.reaksi_kulit && REAKSI_KULIT[p.reaksi_kulit]].filter(Boolean).join(' · ')
}

/** Ringkasan face chart: jumlah titik + total per produk. */
function ringkasTitik(titiks = []) {
  if (!titiks.length) return ''
  const total = new Map()
  for (const t of titiks) {
    if (!t.obat || !t.jumlah) continue
    const key = `${t.obat.nama}|${t.satuan ?? ''}`
    total.set(key, (total.get(key) ?? 0) + Number(t.jumlah))
  }
  const produk = [...total].map(([key, jumlah]) => {
    const [nama, satuan] = key.split('|')
    return `${nama} ${angka(jumlah)} ${satuan}`
  })
  return [`${titiks.length} titik`, ...produk].join(' · ')
}

const consentUuid = ref('')
const consentOpen = ref(false)

function lihatConsent(uuid) {
  consentUuid.value = uuid
  consentOpen.value = true
}
</script>

<template>
  <p v-if="kunjungan.rme_disembunyikan" class="rounded-xl bg-slate-900/5 px-3 py-2 text-sm text-slate-500">
    🔒 Rekam medis kunjungan ini berakses terbatas — hanya tim yang menangani yang dapat membukanya.
  </p>
  <div v-else class="space-y-4 text-sm">
    <p v-if="kunjungan.akses_terbatas" class="text-xs font-semibold text-rose-700">🔒 Akses terbatas</p>

    <div v-if="kunjungan.pemeriksaan" class="flex flex-wrap gap-2">
      <span v-for="[key, label, unit] in vital" :key="key" class="chip">
        <span class="text-slate-500">{{ label }}</span> <b>{{ kunjungan.pemeriksaan[key] ?? '-' }}</b> {{ unit }}
      </span>
    </div>

    <dl v-if="kunjungan.pemeriksaan" class="grid gap-3 sm:grid-cols-2">
      <div v-for="[key, label] in soap" :key="key">
        <dt class="text-xs font-semibold text-slate-500">{{ label }}</dt>
        <dd class="whitespace-pre-line">{{ kunjungan.pemeriksaan[key] || '-' }}</dd>
      </div>
    </dl>
    <p v-else class="text-slate-400">Belum ada data pemeriksaan.</p>

    <div v-if="kunjungan.pemeriksaan?.diagnosas?.length">
      <p class="text-xs font-semibold text-slate-500">Diagnosa</p>
      <p v-for="d in kunjungan.pemeriksaan.diagnosas" :key="d.id">
        <span class="tabular-nums font-semibold">{{ d.icd10.kode }}</span> {{ d.icd10.nama }}
        <span class="text-xs text-slate-400">({{ d.jenis }})</span>
      </p>
    </div>

    <div v-if="kunjungan.tindakans?.length">
      <p class="text-xs font-semibold text-slate-500">Tindakan</p>
      <div v-for="t in kunjungan.tindakans" :key="t.id" class="py-0.5">
        <p>
          {{ t.tindakan.nama }} × {{ t.jumlah }}
          <span v-if="t.icd9cm" class="text-xs text-slate-500">· ICD-9-CM {{ t.icd9cm.kode }}</span>
          <span v-if="t.petugas" class="text-xs text-slate-500">· {{ t.petugas.name }}</span>
        </p>
        <p v-if="t.catatan" class="text-xs text-slate-500">
          <template v-if="t.catatan.area">{{ t.catatan.area }}. </template>
          <template v-if="t.catatan.alat">{{ t.catatan.alat.nama }} · </template>{{ ringkasParameter(t.catatan.parameter) }}{{ ringkasTitik(t.catatan.titiks) }}
          <span v-if="t.catatan.catatan" class="block whitespace-pre-line text-slate-600">{{ t.catatan.catatan }}</span>
        </p>
      </div>
    </div>

    <div v-if="kunjungan.informed_consents?.length">
      <p class="text-xs font-semibold text-slate-500">Informed consent</p>
      <button
        v-for="c in kunjungan.informed_consents"
        :key="c.uuid"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg py-0.5 text-left hover:bg-slate-900/5"
        @click="lihatConsent(c.uuid)"
      >
        <StatusBadge :status="c.status" />
        <span class="truncate">{{ c.tindakan_nama ?? c.judul }}</span>
        <span class="ml-auto shrink-0 text-xs text-slate-400">{{ c.penandatangan_nama }} · {{ waktu(c.ditandatangani_at) }}</span>
      </button>
    </div>

    <div v-if="kunjungan.resep?.items?.length">
      <p class="text-xs font-semibold text-slate-500">Resep</p>
      <p v-for="r in kunjungan.resep.items" :key="r.id">{{ r.obat.nama }} — {{ r.jumlah }} {{ r.obat.satuan }}, <i>{{ r.aturan_pakai }}</i></p>
    </div>

    <p v-if="kunjungan.pemeriksaan?.ditandatangani_at" class="rounded-xl bg-emerald-600/10 px-3 py-2 text-xs text-emerald-800">
      ✓ Ditandatangani secara elektronik oleh <b>{{ kunjungan.pemeriksaan.penandatangan?.name ?? '-' }}</b>
      <template v-if="kunjungan.pemeriksaan.penandatangan?.sip"> (SIP {{ kunjungan.pemeriksaan.penandatangan.sip }})</template>
      · {{ waktu(kunjungan.pemeriksaan.ditandatangani_at) }}
    </p>

    <div v-if="kunjungan.pemeriksaan?.addendums?.length" class="space-y-2">
      <p class="text-xs font-semibold text-slate-500">Addendum</p>
      <div v-for="a in kunjungan.pemeriksaan.addendums" :key="a.id" class="rounded-xl border-l-4 border-amber-400 bg-amber-50/70 px-3 py-2">
        <p class="text-xs text-slate-500">{{ BAGIAN_ADDENDUM[a.bagian] ?? a.bagian }} · {{ a.user?.name }} · {{ waktu(a.created_at) }}</p>
        <p class="whitespace-pre-line">{{ a.isi }}</p>
        <p class="text-xs text-slate-500">Alasan: {{ a.alasan }}</p>
      </div>
    </div>

    <ConsentLihatModal v-model="consentOpen" :uuid="consentUuid" />
  </div>
</template>
