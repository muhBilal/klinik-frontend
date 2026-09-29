<script setup>
/** Ringkasan satu kunjungan: tanda vital, SOAP, diagnosa, tindakan, resep. */
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
</script>

<template>
  <div class="space-y-4 text-sm">
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
      <p v-for="t in kunjungan.tindakans" :key="t.id">{{ t.tindakan.nama }} × {{ t.jumlah }}</p>
    </div>

    <div v-if="kunjungan.resep?.items?.length">
      <p class="text-xs font-semibold text-slate-500">Resep</p>
      <p v-for="r in kunjungan.resep.items" :key="r.id">{{ r.obat.nama }} — {{ r.jumlah }} {{ r.obat.satuan }}, <i>{{ r.aturan_pakai }}</i></p>
    </div>
  </div>
</template>
