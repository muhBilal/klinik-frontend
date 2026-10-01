<script setup>
import { onMounted, ref } from 'vue'
import AppSpinner from '@/components/AppSpinner.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageLoading from '@/components/PageLoading.vue'
import api, { errorMessage, validationErrors } from '@/lib/api'
import { cachedGet } from '@/lib/cache'
import { useKlinikStore } from '@/stores/klinik'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const klinik = useKlinikStore()

/** Bentuk sama dengan GET /pengaturan: { klinik: {...}, struk: {...}, cetak: {...}, penomoran: {...}, keamanan: {...} } */
const form = ref(null)
const perans = ref([])
const loadError = ref('')
const errors = ref({})
const saving = ref(false)

async function load() {
  loadError.value = ''
  try {
    ;[form.value, perans.value] = await Promise.all([api.get('/pengaturan').then((r) => r.data), cachedGet('/perans')])
    // PHP mengirim objek kosong sebagai [] → normalkan ke objek {kode_peran: persen}
    const batas = form.value.keuangan?.batas_diskon_persen
    if (form.value.keuangan) form.value.keuangan.batas_diskon_persen = Array.isArray(batas) ? {} : { ...batas }
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

async function simpan() {
  saving.value = true
  errors.value = {}
  try {
    form.value = (await api.put('/pengaturan', form.value)).data
    klinik.muat(true)
    toast.success('Pengaturan tersimpan.')
  } catch (e) {
    errors.value = validationErrors(e)
    toast.error(errorMessage(e))
  } finally {
    saving.value = false
  }
}

/** Batas diskon per peran (BL-02): kosong = tidak dibatasi (opt-in). Peran akses penuh tidak pernah dibatasi. */
function batasDiskon(kode) {
  return form.value.keuangan.batas_diskon_persen[kode] ?? ''
}
function setBatasDiskon(kode, nilai) {
  const batas = form.value.keuangan.batas_diskon_persen
  if (nilai === '' || nilai === null) delete batas[kode]
  else batas[kode] = Number(nilai)
}

const err = (key) => errors.value[key] ?? Object.entries(errors.value).find(([k]) => k.startsWith(`${key}.`))?.[1]

onMounted(load)
</script>

<template>
  <PageHeader title="Pengaturan Klinik" subtitle="Identitas klinik, kop struk, penomoran dokumen, dan keamanan sesi. Setiap perubahan tercatat di audit log.">
    <button v-if="form" type="submit" form="form-pengaturan" class="btn btn-primary" :disabled="saving"><AppSpinner v-if="saving" />{{ saving ? 'Menyimpan...' : 'Simpan' }}</button>
  </PageHeader>

  <form v-if="form" id="form-pengaturan" class="grid gap-5 lg:grid-cols-2" @submit.prevent="simpan">
    <div class="card">
      <div class="card-header"><h2 class="card-title">Identitas Klinik</h2></div>
      <div class="card-body grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="p-nama">Nama klinik *</label>
          <input id="p-nama" v-model="form.klinik.nama" class="input" :class="{ 'input-error': err('klinik.nama') }" required maxlength="100" />
          <p v-if="err('klinik.nama')" class="field-error">{{ err('klinik.nama') }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="p-alamat">Alamat</label>
          <input id="p-alamat" v-model="form.klinik.alamat" class="input" maxlength="255" />
        </div>
        <div>
          <label class="label" for="p-telp">Telepon</label>
          <input id="p-telp" v-model="form.klinik.telepon" class="input" maxlength="30" />
        </div>
        <div>
          <label class="label" for="p-email">Email</label>
          <input id="p-email" v-model="form.klinik.email" type="email" class="input" :class="{ 'input-error': err('klinik.email') }" />
          <p v-if="err('klinik.email')" class="field-error">{{ err('klinik.email') }}</p>
        </div>
        <div>
          <label class="label" for="p-npwp">NPWP</label>
          <input id="p-npwp" v-model="form.klinik.npwp" class="input" maxlength="30" />
        </div>
        <p class="text-xs text-slate-400 sm:col-span-2">Alamat & telepon per cabang diatur di Master Cabang; struk memakai data cabang bila terisi.</p>
      </div>
    </div>

    <div class="space-y-5">
      <div class="card">
        <div class="card-header"><h2 class="card-title">Struk & Cetak</h2></div>
        <div class="card-body grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label" for="p-kaki">Catatan kaki struk</label>
            <input id="p-kaki" v-model="form.struk.catatan_kaki" class="input" maxlength="255" />
          </div>
          <div>
            <label class="label" for="p-lebar">Lebar kertas struk</label>
            <select id="p-lebar" v-model="form.cetak.lebar_struk" class="input">
              <option value="58mm">58 mm (printer thermal kecil)</option>
              <option value="80mm">80 mm</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Penomoran Dokumen</h2></div>
        <div class="card-body grid gap-4 sm:grid-cols-3">
          <div v-for="[key, label] in [['prefix_registrasi', 'Registrasi'], ['prefix_resep', 'Resep'], ['prefix_tagihan', 'Tagihan'], ['prefix_paket', 'Paket']]" :key="key">
            <label class="label" :for="`p-${key}`">Prefix {{ label }}</label>
            <input
              :id="`p-${key}`"
              v-model="form.penomoran[key]"
              class="input font-mono uppercase"
              :class="{ 'input-error': err(`penomoran.${key}`) }"
              maxlength="5"
              @input="form.penomoran[key] = form.penomoran[key].toUpperCase()"
            />
            <p v-if="err(`penomoran.${key}`)" class="field-error">{{ err(`penomoran.${key}`) }}</p>
          </div>
          <p class="text-xs text-slate-400 sm:col-span-3">Format: PREFIX + tanggal + nomor urut, mis. {{ form.penomoran.prefix_registrasi }}202609300001. Mengganti prefix tidak mereset nomor urut hari ini.</p>
        </div>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Rekam Medis</h2></div>
      <div class="card-body">
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.rme.wajib_informed_consent" type="checkbox" class="mt-0.5 accent-brand-600" />
          <span>
            Wajib informed consent sebelum pemeriksaan ditutup
            <span class="block text-xs text-slate-400">Berlaku untuk treatment yang diberi template consent di Katalog Treatment. Matikan hanya bila consent masih diambil di kertas.</span>
          </span>
        </label>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Foto Klinis</h2></div>
      <div class="card-body space-y-4">
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.foto.wajib_consent" type="checkbox" class="mt-0.5 accent-brand-600" />
          <span>
            Wajib persetujuan foto pasien sebelum foto klinis diambil
            <span class="block text-xs text-slate-400">UU PDP: foto wajah termasuk data pribadi spesifik. Matikan hanya bila persetujuan masih diambil di kertas.</span>
          </span>
        </label>
        <div>
          <label class="label" for="p-naskah-foto">Naskah persetujuan foto</label>
          <textarea id="p-naskah-foto" v-model="form.foto.naskah_consent" rows="10" class="input" :class="{ 'input-error': err('foto.naskah_consent') }" maxlength="10000" />
          <p v-if="err('foto.naskah_consent')" class="field-error">{{ err('foto.naskah_consent') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">Placeholder: {nama_pasien} {no_rm} {klinik} {tanggal} {tingkat} {pilihan} (daftar tingkat dengan tanda [x]). Persetujuan yang sudah ditandatangani tidak ikut berubah.</p>
        </div>
      </div>
    </div>

    <!-- Persetujuan data pribadi (PS-04, UU No. 27/2022 PDP) -->
    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Data Pribadi (UU PDP)</h2></div>
      <div class="card-body space-y-4">
        <label class="flex items-start gap-2 text-sm">
          <input v-model="form.pdp.wajib_persetujuan" type="checkbox" class="mt-0.5 accent-brand-600" />
          <span>
            Wajib persetujuan pemrosesan data sebelum kunjungan didaftarkan / check-in booking
            <span class="block text-xs text-slate-400">Tanpa centang, pasien yang belum menyetujui tetap bisa didaftarkan tetapi ditandai di daftar pasien & pendaftaran.</span>
          </span>
        </label>
        <div>
          <label class="label" for="p-naskah-pdp">Naskah persetujuan pemrosesan data</label>
          <textarea id="p-naskah-pdp" v-model="form.pdp.naskah_pemrosesan" rows="10" class="input" :class="{ 'input-error': err('pdp.naskah_pemrosesan') }" maxlength="10000" />
          <p v-if="err('pdp.naskah_pemrosesan')" class="field-error">{{ err('pdp.naskah_pemrosesan') }}</p>
        </div>
        <div>
          <label class="label" for="p-naskah-marketing">Naskah opt-in promosi</label>
          <textarea id="p-naskah-marketing" v-model="form.pdp.naskah_marketing" rows="5" class="input" :class="{ 'input-error': err('pdp.naskah_marketing') }" maxlength="10000" />
          <p v-if="err('pdp.naskah_marketing')" class="field-error">{{ err('pdp.naskah_marketing') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">
            Placeholder: {nama_pasien} {no_rm} {klinik} {tanggal}; opt-in juga {kanal}. Tinjau bersama penasihat hukum klinik. Persetujuan yang sudah ditandatangani tidak ikut berubah.
          </p>
        </div>
      </div>
    </div>

    <!-- Keuangan & kasir: pajak (AD-04), batas diskon per peran (BL-02), wajib shift (BL-05) -->
    <div v-if="form.keuangan" class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Keuangan & Kasir</h2></div>
      <div class="card-body grid gap-5 sm:grid-cols-[16rem_1fr]">
        <div class="space-y-4">
          <div>
            <label class="label" for="p-pajak">Pajak layanan (%)</label>
            <input id="p-pajak" v-model.number="form.keuangan.pajak_persen" type="number" min="0" max="100" class="input" :class="{ 'input-error': err('keuangan.pajak_persen') }" />
            <p v-if="err('keuangan.pajak_persen')" class="field-error">{{ err('keuangan.pajak_persen') }}</p>
            <p v-else class="mt-1 text-xs text-slate-400">Berlaku untuk tagihan baru; tagihan lama tetap memakai tarif saat dibuat.</p>
          </div>
          <label class="flex items-start gap-2 text-sm">
            <input v-model="form.keuangan.wajib_shift" type="checkbox" class="mt-0.5 accent-brand-600" />
            <span>Kasir wajib membuka shift kas sebelum menerima pembayaran</span>
          </label>
          <label v-if="form.inventori" class="flex items-start gap-2 text-sm">
            <input v-model="form.inventori.blokir_bhp_stok_kurang" type="checkbox" class="mt-0.5 accent-brand-600" />
            <span>
              Tolak tutup pemeriksaan bila stok BHP kurang
              <span class="block text-xs text-slate-400">Tidak dicentang = tetap lanjut, selisih diselesaikan lewat stok opname.</span>
            </span>
          </label>
        </div>
        <div>
          <p class="label">Batas diskon manual per peran (% dari total tagihan)</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <label v-for="p in perans.filter((x) => !x.akses_penuh)" :key="p.kode" class="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3 py-1.5 text-sm">
              <span>{{ p.nama }}</span>
              <input
                :value="batasDiskon(p.kode)"
                type="number"
                min="0"
                max="100"
                class="input w-24 py-1 text-right"
                placeholder="bebas"
                :aria-label="`Batas diskon ${p.nama}`"
                @input="setBatasDiskon(p.kode, $event.target.value)"
              />
            </label>
          </div>
          <p v-if="err('keuangan.batas_diskon_persen')" class="field-error">{{ err('keuangan.batas_diskon_persen') }}</p>
          <p v-else class="mt-2 text-xs text-slate-400">
            Kosong = tidak dibatasi, 0 = tidak boleh memberi diskon. Di atas batas, kasir meminta persetujuan atasan yang memegang izin
            "Setujui diskon di atas batas" (tercatat di audit log). Potongan kode promo tidak terkena batas ini.
          </p>
        </div>
      </div>
    </div>

    <!-- Dasar perhitungan komisi (KM-01) -->
    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Komisi</h2></div>
      <div class="card-body space-y-2 text-sm">
        <p class="label">Dasar komisi persen</p>
        <label class="flex items-start gap-2">
          <input v-model="form.komisi.dasar" type="radio" value="neto" class="mt-0.5 accent-brand-600" />
          <span>Neto — harga tindakan setelah diskon & potongan promo tagihan (proporsional)</span>
        </label>
        <label class="flex items-start gap-2">
          <input v-model="form.komisi.dasar" type="radio" value="bruto" class="mt-0.5 accent-brand-600" />
          <span>Bruto — harga tindakan sebelum diskon</span>
        </label>
        <p class="text-xs text-slate-400">Sesi paket selalu memakai nilai per sesi paket. Berlaku untuk rekap yang dihitung (ulang) setelah disimpan; rekap yang sudah disetujui tidak berubah.</p>
      </div>
    </div>

    <!-- Kebijakan paket multi-sesi (TR-02): pertanyaan terbuka PRD, diatur tiap klinik -->
    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Paket Treatment</h2></div>
      <div class="card-body grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div class="space-y-3">
          <label class="flex items-start gap-2 text-sm">
            <input v-model="form.paket.boleh_transfer" type="checkbox" class="mt-0.5 accent-brand-600" />
            <span>
              Sisa paket boleh dialihkan ke pasien lain
              <span class="block text-xs text-slate-400">Diproses pemegang izin void/refund (manajer). Masa berlaku tetap mengikuti paket asal.</span>
            </span>
          </label>
          <label class="flex items-start gap-2 text-sm">
            <input v-model="form.paket.refund_sisa" type="checkbox" class="mt-0.5 accent-brand-600" />
            <span>
              Sisa paket yang sudah dipakai boleh diuangkan (refund prorata)
              <span class="block text-xs text-slate-400">Nominal = nilai sesi tersisa dikurangi potongan. Paket yang belum dipakai selalu bisa direfund penuh lewat refund tagihan.</span>
            </span>
          </label>
        </div>
        <div>
          <label class="label" for="p-potongan-refund">Potongan refund sisa (%)</label>
          <input id="p-potongan-refund" v-model.number="form.paket.potongan_refund_persen" type="number" min="0" max="100" class="input" :class="{ 'input-error': err('paket.potongan_refund_persen') }" :disabled="!form.paket.refund_sisa" />
          <p v-if="err('paket.potongan_refund_persen')" class="field-error">{{ err('paket.potongan_refund_persen') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">Mis. biaya administrasi.</p>
        </div>
      </div>
    </div>

    <!-- Dokumen cetak (AD-04), biaya racik (FR-01), peringatan izin praktik (AD-05) -->
    <div v-if="form.dokumen" class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Dokumen, Farmasi & Izin Praktik</h2></div>
      <div class="card-body grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="p-kop">Baris tambahan kop dokumen</label>
          <input id="p-kop" v-model="form.dokumen.kop_tambahan" class="input" maxlength="255" placeholder="mis. Izin Operasional Klinik No. 503/123/DPMPTSP/2026" />
        </div>
        <div>
          <label class="label" for="p-pj">Penanggung jawab klinik</label>
          <input id="p-pj" v-model="form.dokumen.penanggung_jawab" class="input" maxlength="150" placeholder="mis. dr. Andi Wijaya · SIP 503/SIP-DU/001/2026" />
        </div>
        <div>
          <label class="label" for="p-kaki">Kaki dokumen</label>
          <input id="p-kaki" v-model="form.dokumen.kaki" class="input" maxlength="255" placeholder="mis. Dokumen ini sah tanpa cap basah" />
        </div>
        <div v-if="form.farmasi">
          <label class="label" for="p-racik">Biaya racik per racikan (Rp)</label>
          <input id="p-racik" v-model.number="form.farmasi.biaya_racik" type="number" min="0" class="input" :class="{ 'input-error': err('farmasi.biaya_racik') }" />
          <p class="mt-1 text-xs text-slate-400">Ditambahkan ke harga komponen resep racikan.</p>
        </div>
        <div v-if="form.regulasi">
          <label class="label" for="p-izin">Peringatan SIP/STR (hari sebelum berakhir)</label>
          <input id="p-izin" v-model.number="form.regulasi.peringatan_izin_hari" type="number" min="7" max="365" class="input" :class="{ 'input-error': err('regulasi.peringatan_izin_hari') }" />
          <p class="mt-1 text-xs text-slate-400">Tampil di dashboard pengelola pengguna & dokter yang bersangkutan.</p>
        </div>
        <p class="text-xs text-slate-400 sm:col-span-2">Kop & kaki dipakai di cetakan informed consent, persetujuan foto & data, dan rencana perawatan.</p>
      </div>
    </div>

    <!-- WhatsApp otomatis (BK-06, CR-01) -->
    <div v-if="form.wa" class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">WhatsApp Otomatis</h2></div>
      <div class="card-body grid gap-4 sm:grid-cols-2">
        <div class="space-y-2 text-sm">
          <label class="flex items-center gap-2"><input v-model="form.wa.reminder_h1" type="checkbox" class="accent-brand-600" /> Reminder H-1 booking</label>
          <label class="flex items-center gap-2"><input v-model="form.wa.reminder_2jam" type="checkbox" class="accent-brand-600" /> Reminder ±2 jam sebelum jadwal</label>
          <label class="flex items-center gap-2"><input v-model="form.wa.followup_h1" type="checkbox" class="accent-brand-600" /> Follow-up H+1 setelah tindakan</label>
          <label class="flex items-center gap-2"><input v-model="form.wa.followup_h7" type="checkbox" class="accent-brand-600" /> Follow-up H+7 setelah tindakan</label>
        </div>
        <div class="space-y-3">
          <div>
            <label class="label" for="p-wa-jam">Kirim reminder H-1 mulai pukul</label>
            <input id="p-wa-jam" v-model="form.wa.jam_reminder_h1" type="time" class="input w-36" />
          </div>
          <div>
            <label class="label" for="p-wa-t1">Nama template pengingat</label>
            <input id="p-wa-t1" v-model="form.wa.template_reminder" class="input font-mono" :class="{ 'input-error': err('wa.template_reminder') }" />
          </div>
          <div>
            <label class="label" for="p-wa-t2">Nama template tindak lanjut</label>
            <input id="p-wa-t2" v-model="form.wa.template_followup" class="input font-mono" :class="{ 'input-error': err('wa.template_followup') }" />
          </div>
        </div>
        <p v-pre class="text-xs text-slate-400 sm:col-span-2">
          Template harus disetujui Meta. Pengingat: {{1}} nama, {{2}} hari &amp; jam, {{3}} treatment, {{4}} cabang + tombol cepat "Konfirmasi" &amp; "Ubah jadwal".
          Tindak lanjut: {{1}} nama, {{2}} treatment, {{3}} hari ke-, {{4}} klinik. Kredensial &amp; aktivasi diatur di .env server (lihat Administrasi → Integrasi).
        </p>
      </div>
    </div>

    <div class="card lg:col-span-2">
      <div class="card-header"><h2 class="card-title">Keamanan</h2></div>
      <div class="card-body grid gap-5 sm:grid-cols-[16rem_1fr]">
        <div>
          <label class="label" for="p-idle">Akhiri sesi bila tidak aktif (menit)</label>
          <input id="p-idle" v-model.number="form.keamanan.idle_timeout_menit" type="number" min="5" max="480" class="input" :class="{ 'input-error': err('keamanan.idle_timeout_menit') }" />
          <p v-if="err('keamanan.idle_timeout_menit')" class="field-error">{{ err('keamanan.idle_timeout_menit') }}</p>
          <p v-else class="mt-1 text-xs text-slate-400">PRD: 15 menit untuk perangkat bersama.</p>
        </div>
        <div>
          <p class="label">Peran yang wajib memakai 2FA</p>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <label v-for="p in perans" :key="p.kode" class="flex items-center gap-2 text-sm">
              <input v-model="form.keamanan.wajib_2fa" type="checkbox" :value="p.kode" class="accent-brand-600" /> {{ p.nama }}
            </label>
          </div>
          <p v-if="err('keamanan.wajib_2fa')" class="field-error">{{ err('keamanan.wajib_2fa') }}</p>
          <p v-else class="mt-2 text-xs text-slate-400">Pengguna dengan peran tercentang harus mengaktifkan 2FA di halaman Profil sebelum bisa memakai fitur lain.</p>
        </div>
      </div>
    </div>
  </form>
  <PageLoading v-else :error="loadError" text="Memuat pengaturan..." @retry="load" />
</template>
