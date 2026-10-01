# 05 — Kontrak API yang Dipakai UI

Referensi lengkap endpoint ada di repo backend: `AI-Context/05-api-reference.md`. File ini merangkum
bentuk data yang **diandalkan** komponen frontend — bila backend mengubahnya, UI harus ikut disesuaikan.

## Umum
- List paginated Laravel: `{ data: [], current_page, last_page, from, to, total }` → dinormalisasi `useList`.
- Array biasa: `GET /polis`, `GET /dokters`, `GET /pasiens/{id}/riwayat`, `GET /kategori-tindakans`.
- Error 422: `{ message, errors: { field: ['pesan'] } }`. Key array memakai dot notation (`resep.0.obat_id`).
- Uang = integer rupiah. Tanggal `YYYY-MM-DD`; timestamp ISO UTC (`created_at`, `dibayar_at`, ...).

## Login
`POST /login` → `{ token, user }` **atau** `{ two_factor: true, tantangan }` → `POST /login/2fa { tantangan, kode }` → `{ token, user }`.
Error 422 `tantangan` = sesi login kedaluwarsa (ulangi dari email/password); 422 `kode` = kode salah.

## User (`/login`, `/me`)
```js
{
  id, name, email, role: 'dokter', role_label: 'Dokter', poli_id, cabang_id, sip, is_active, two_factor_confirmed_at,
  poli: { id, kode, nama } | null, cabang: { id, kode, nama } | null,
  izin: ['pasien.lihat', ...],            // izin efektif; dipakai auth.can()
  tercatat_dokter: true,                  // punya pemeriksaan.dokter & bukan administrator
  sip_berlaku_sampai: '2027-12-31' | null,
  sip_aktif: true,                        // syarat menandatangani RME / addendum (F1-05)
  cabangs: [{ id, kode, nama }],          // pilihan cabang aktif (staf: hanya cabangnya)
  two_factor: { aktif: false, wajib: false },
  sesi: { idle_timeout_menit: 15 },
}
```

## Info publik (`GET /info`, tanpa login)
`{ klinik: { nama, alamat, telepon, email, npwp }, struk: { catatan_kaki }, cetak: { lebar_struk: '58mm' atau '80mm' } }`

## Kunjungan (detail, `GET /kunjungans/{id}` dan respons pemeriksaan)
```js
{
  id, no_registrasi, tanggal, no_antrian, penjamin, no_penjamin, keluhan, status, dipanggil_at, selesai_at, pasien_id, poli_id,
  dokter_id, cabang_id, akses_terbatas, rme_disembunyikan /* true = kunjungan berakses terbatas yang bukan hak user */,
  pasien: { id, no_rm, nama, jenis_kelamin, tanggal_lahir, umur, alergi, golongan_darah, no_bpjs, ... },
  poli: { id, kode, nama, tarif_konsultasi },
  dokter: { id, name, sip } | null,
  pemeriksaan: { tekanan_darah, nadi, suhu, respirasi, berat_badan, tinggi_badan, subjektif, objektif, asesmen, plan,
                 dokter_id, perawat_id, ditandatangani_at, ditandatangani_oleh, penandatangan: { id, name, sip } | null,
                 diagnosas: [{ id, icd10_id, jenis, icd10: { kode, nama, sensitif } }],
                 addendums: [{ id, bagian, isi, alasan, created_at, user: { id, name } }] } | null,
  tindakans: [{ id, tindakan_id, jumlah, tarif, petugas_id, icd9cm_id, keterangan,
                tindakan: { nama, jenis_catatan, template_consent_id }, petugas: { id, name } | null, icd9cm: { kode, nama } | null,
                catatan: { jenis, area, catatan, parameter: {...} | null, alat: { kode, nama } | null,
                           titiks: [{ x, y, area, obat_id, batch_id, jumlah, satuan, kedalaman, alat, obat, batch }] } | null }],
  informed_consents: [{ uuid, kunjungan_tindakan_id, template_consent_id, judul, tindakan_nama, status, penandatangan_nama,
                        hubungan, ditandatangani_at, dicabut_at, alasan_cabut }],   // tanpa naskah & tanda tangan
  resep: { id, no_resep, status, catatan, items: [{ obat_id, jumlah, aturan_pakai, harga, obat: { nama, satuan, stok } }] } | null,
  tagihan: { id, no_tagihan, total, grand_total, status } | null
}
```
Detail memuat `pasien` subset (no_rm, nama, jenis_kelamin, tanggal_lahir/umur, golongan_darah, alergi), `cabang` (id, kode, nama),
`tagihan` tanpa `items` (hanya id, no_tagihan, total, grand_total, status). **Tanpa izin `rme.lihat` — atau
`rme_disembunyikan: true` — key `pemeriksaan`, `tindakans`, `informed_consents`, `resep` tidak ada** — komponen harus tahan data
itu kosong. Riwayat pasien juga mengirim `rme_disembunyikan` per kunjungan. List kunjungan memuat `pasien` (id, no_rm, nama,
jenis_kelamin), `poli` (id, kode, nama), `dokter` (id, name), `cabang` (id, kode, nama); `umur` bernilai null di list.
Riwayat pasien (`/pasiens/{id}` dan `/pasiens/{id}/riwayat`) mencakup semua cabang dan menyertakan `cabang`.

Parameter ringan: `?simple=1` pada endpoint list (tanpa `total`), `GET /pasiens/{id}?ringkas=1` (tanpa kunjungans),
`GET /pasiens/{id}/riwayat?kecuali={kunjungan_id}`, `GET /polis?aktif=1` (hanya id, kode, nama).
Respons `POST /reseps/{id}/serahkan` dan `POST /tagihans/{id}/bayar` berbentuk sama dengan GET detail-nya.

## Resep list
`{ id, no_resep, status, created_at, items_count, dokter, kunjungan: { pasien, poli, tagihan: { status } | null } }`

## Tagihan detail
`{ no_tagihan, total, diskon, grand_total, status, metode_bayar, dibayar, kembalian, dibayar_at, kasir, cabang: { id, kode, nama, alamat, telepon }, items: [{ kategori, deskripsi, jumlah, harga, subtotal }], kunjungan: { tanggal, penjamin, pasien, poli, dokter } }`
Resep detail juga memuat `cabang` (kop etiket).

## Berkas (`GET /berkas` → array)
`{ uuid, kategori, keterangan, nama_file, mime, ukuran, pasien_id, kunjungan_id, cabang_id, pengunggah: { id, name }, created_at }`.
`GET /berkas/{uuid}/tautan` → `{ url, kedaluwarsa }` (URL absolut ke API, bisa langsung dipakai `<img src>` / tab baru).

## Peran, izin, cabang, pengaturan, audit
- `GET /perans` → `[{ id, kode, nama, deskripsi, is_sistem, akses_penuh, izin: [kode], users_count }]`
- `GET /izins` → `[{ grup, izin: [{ kode, label }] }]`
- `GET /cabangs` → array `{ id, kode, nama, alamat, telepon, email, jam_buka: 'HH:MM', jam_tutup, is_active, users_count? }`
- `GET /pengaturan` → `{ klinik: {...}, struk: {...}, cetak: {...}, penomoran: { prefix_registrasi, prefix_resep, prefix_tagihan }, keamanan: { idle_timeout_menit, wajib_2fa: [kode] } }`; `PUT` payload bentuk sama (parsial), error kunci bertitik (`penomoran.prefix_resep`).
- `GET /audit-logs` → paginated `{ id, aksi, tipe, subjek_id, pasien_id, label, ip_address, created_at, user: { id, name, email } | null, cabang }`; `GET /audit-logs/{id}` + `perubahan: { kolom: { lama, baru } }`, `user_agent`.

## Treatment (`/tindakans`, F1-01)
- List: `{ id, kode, nama, kategori_id, durasi_menit, buffer_menit, tarif /* harga dasar */, tarif_cabang, tersedia, is_active,
  hargas_count, bhps_count, kategori: { id, nama } | null }`. `tarif_cabang`/`tersedia` untuk `?cabang_id=` atau cabang aktif.
  `aktif=1` menyembunyikan treatment yang tidak dilayani di cabang itu. **Estimasi biaya pemeriksaan memakai `tarif_cabang`**
  (kirim `cabang_id` kunjungan), bukan `tarif`.
- Detail/simpan: + `hargas: [{ id, cabang_id, tarif, tersedia, cabang: { id, kode, nama, is_active } }]`,
  `bhps: [{ id, obat_id, jumlah /* float */, obat: { id, kode, nama, satuan, is_active } }]`.
- Payload: `{ kode, nama, kategori_id, durasi_menit, buffer_menit, tarif, is_active, hargas: [{ cabang_id, tarif, tersedia }], bhps: [{ obat_id, jumlah }] }`
  — `hargas`/`bhps` replace-all; error `hargas.N.tarif`, `bhps.N.jumlah` (N = indeks di payload).
- Kategori: `GET /kategori-tindakans` → `[{ id, nama, deskripsi, is_active, tindakans_count }]`; `?aktif=1` → `[{ id, nama }]`.

- F1-05: list + `icd9cm_id`, `icd9cm: { id, kode, nama } | null`, `template_consent_id` (terisi = consent wajib), `jenis_catatan`
  (`umum` / `injeksi` / `energi`); detail + `template_consent: { id, nama } | null`; payload + tiga field itu.

## RME estetika (F1-05)
- `GET /icd10s` & `/icd9cms` item + `favorit` (bool; favorit tampil paling atas), ICD-10 + `sensitif`. `?favorit=1` = favorit saja.
  `POST` / `DELETE /kode-favorits` body `{ jenis: 'icd10'|'icd9cm', kode_id }` (DELETE: `api.delete(url, { data })`).
- `GET /template-soaps?aktif=1&poli_id=` → **array** `{ id, nama, poli_id, tindakan_id, subjektif, objektif, asesmen, plan,
  icd10_ids, akses_terbatas, is_active, poli: { id, nama } | null, tindakan: { id, nama } | null, diagnosas: [{ id, kode, nama, sensitif }] }`.
- `GET /template-consents?aktif=1` → `[{ id, nama }]`; tanpa filter + `isi`, `is_active`, `tindakans_count`.
- `GET /petugas` → `[{ id, name, role, poli_id, cabang_id, peran }]` (pilihan petugas pelaksana).
- `GET /kunjungan-tindakans/{id}/catatan` → `{ kunjungan_tindakan: { id, tindakan_id, jumlah, petugas_id, tindakan, petugas },
  jenis, catatan: {...} | null, terkunci }`; `PUT` → catatan `{ jenis, area, catatan, parameter, sumber_daya_id, alat, pencatat,
  titiks: [{ ..., obat: { id, kode, nama, satuan }, batch: { id, no_batch, kedaluwarsa } }] }`. Error titik: `titiks.N.batch_id`.
- Consent: `GET /kunjungans/{id}/informed-consents/pratinjau?template_consent_id=&kunjungan_tindakan_id=` → `{ judul, tindakan_nama,
  isi, dokter }`; `POST /kunjungans/{id}/informed-consents` → consent (tanpa tanda tangan) + `dokter`, `pembuat`;
  `GET /informed-consents/{uuid}` → + `isi`, `ttd_penandatangan`, `ttd_saksi` (PNG data URL), `pasien`, `kunjungan.cabang`,
  `dokter`, `pembuat`, `pencabut`, `checksum_valid`; `POST /informed-consents/{uuid}/cabut { alasan }`.
- `POST /kunjungans/{id}/selesai` 422: `errors.informed_consent` = **array beberapa pesan** (tampilkan semua), `errors.sip`.
- `POST /kunjungans/{id}/addendum { bagian, isi, alasan }` → `{ id, bagian, isi, alasan, created_at, user }`;
  `GET /kunjungans/{id}/verifikasi` → `{ ditandatangani, valid, ditandatangani_at, penandatangan }`.
- `GET /pengaturan` + `rme: { wajib_informed_consent }`.

## Foto klinis (F1-06)
- `GET /berkas?pasien_id=&kategori=foto_klinis` item + `protokol_foto_id`, `posisi`, `tahap`, `kunjungan_tindakan_id`, `diambil_at`,
  `lebar`, `tinggi`, `ada_thumbnail`, `protokol: { id, nama, posisi: [{kode, label, petunjuk}] }`,
  `kunjungan: { id, tanggal, no_registrasi, poli: { nama } }`. **`id` berkas tersembunyi** — pakai `uuid`.
- `POST /berkas/tautan { uuids, pratinjau }` → `[{ uuid, url, kedaluwarsa }]` (berkas yang tidak boleh dibuka tidak dikembalikan).
- `POST /berkas` (FormData) + `thumbnail`, `protokol_foto_id`, `posisi`, `tahap`, `kunjungan_tindakan_id`, `lebar`, `tinggi`;
  422 `errors.consent_foto`.
- `GET /protokol-fotos?aktif=1` → `[{ id, nama, deskripsi, posisi: [{kode, label, petunjuk}], is_active }]`.
- Persetujuan foto: `GET /pasiens/{id}/persetujuan-foto` → `{ aktif: {uuid, tingkat, status, penandatangan_nama, ditandatangani_at, ...} | null,
  riwayat: [...], tingkat: [{ value, label, keterangan }] }`; `GET .../pratinjau?tingkat=` → `{ isi }`; `POST` body
  `{ tingkat, penandatangan_nama, hubungan, ttd, kunjungan_id? }`; `GET /persetujuan-fotos/{uuid}` + `isi`, `ttd`, `checksum_valid`;
  `POST /persetujuan-fotos/{uuid}/cabut { alasan }`.
- `GET /pengaturan` + `foto: { wajib_consent, naskah_consent }`. Enum: tahap `sebelum`/`sesudah`/`kontrol`, tingkat
  `klinis`/`edukasi`/`marketing`, status persetujuan `berlaku`/`diganti`/`dicabut`. Audit baru: `protokol_foto`, `persetujuan_foto`.

## Paket & voucher/promo (F1-08)
- `GET /pakets?aktif=1` → `[{ id, kode, nama, harga, masa_berlaku_hari, lintas_cabang, items: [{ tindakan_id, jumlah_sesi, tindakan: {nama, tarif} }], nilai_normal, terjual_count }]`.
- Paket pasien (`GET /pasiens/{id}/pakets[?aktif=1]`, `GET /paket-pasiens/{id}`): `{ id, no_paket, nama, harga, nilai, status, status_efektif
  (menunggu_bayar/aktif/habis/kedaluwarsa/dibatalkan/direfund/dialihkan), lintas_cabang, berlaku_sampai, total_sesi, sisa_sesi, nilai_terpakai,
  cabang, tagihan: {id, no_tagihan, status, grand_total}, dialihkan_dari, dialihkan_ke, refund_nominal, direfund_at, items: [{ id, tindakan_id,
  jumlah_sesi, nilai_per_sesi, terpakai, dipesan, sisa, tindakan }] }`; detail + `pemakaian[]` (tindakan kunjungan: kunjungan, petugas, cabang)
  & `refund_sisa: { diizinkan, sisa_nilai, potongan_persen, potongan, nominal }`.
- `POST /pasiens/{id}/pakets { paket_id, catatan }` → paket + `tagihan_id` (bayar di `/kasir/{tagihan_id}`).
- Tagihan detail + `promo: {kode, nama, jenis, nilai}`, `diskon_promo`, `paket_pasiens[]`, `items[].tindakan_id/paket_id`; `kunjungan` bisa
  **null** (tagihan mandiri, pakai `pasien` & `keterangan`). Grand total = (total − diskon − diskon_promo) + pajak_persen.
- Pemeriksaan: `tindakans[].paket_pasien_item_id` (+ `paket_item.paket_pasien.no_paket` di respons); 422 `tindakans.{i}.paket_pasien_item_id`.
- Promo: `{ id, kode, nama, jenis: persen|nominal, nilai, maks_potongan, min_transaksi, mulai, berakhir, kuota, kuota_per_pasien, cabang_ids,
  tindakan_ids, paket_ids, is_active, dipakai, tindakans[], pakets[], cabangs[] }`. `POST /tagihans/{id}/promo {kode}` 422 `kode`.
- Pengaturan + `paket: { boleh_transfer, refund_sisa, potongan_refund_persen }`, `penomoran.prefix_paket`. Izin `promo.kelola`. Audit baru:
  `paket`, `paket_item`, `paket_pasien`, `paket_pasien_item`, `promo`, `promo_pemakaian`, aksi `perpanjang_paket`.

## Kedokteran gigi (F1-07)
- `GET /odontogram/referensi` → `{ kondisi: [{ kode, label, cakupan: 'permukaan'|'gigi', kelompok, warna }], permukaan: ['M','O','D','B','L'] }`.
- `GET /pasiens/{id}/odontogram[?kunjungan_id=]` → `{ kondisis: [Kondisi], perubahan: { dicatat: [Kondisi], diakhiri: [Kondisi] } | null,
  kunjungan_id, bisa_diubah, kunjungans: [{ id, tanggal, no_registrasi, status, poli, dokter, cabang }] }`.
  Kondisi = `{ id, gigi, permukaan|null, kondisi, keterangan, kunjungan_id, kunjungan_tindakan_id, berakhir_kunjungan_id, berakhir_karena_id,
  kunjungan: {id, tanggal, no_registrasi}, pencatat: {id, name}, kunjungan_tindakan: { tindakan: {nama} } | null }`.
  Respons POST/DELETE/akhiri/pulihkan `/kunjungans/{id}/odontogram*` berbentuk sama (state kunjungan itu).
- Rencana: `{ id, judul, catatan, status: draf|disetujui|selesai|dibatalkan, cabang_id, dokter, cabang, penyetuju_nama, disetujui_at,
  alasan_batal, created_at, estimasi_total, estimasi_selesai, estimasi_per_fase: [{fase, total, jumlah_item}], items: [{ id, fase, gigi,
  permukaan, tindakan_id, jumlah, tarif, keterangan, status: rencana|selesai|batal, selesai_at, tindakan: {nama, per_gigi, ...},
  pelaksanaan: { kunjungan: {id, no_registrasi, status} } | null }] }`.
- Detail kunjungan: `poli.spesialisasi`, `tindakans[].gigi/permukaan/rencana_item_id`, `tindakans[].tindakan.per_gigi/kondisi_gigi_hasil`,
  `odontogram_dicatat[]`, `odontogram_diakhiri[]`. Detail pasien: `data_gigi`, `kunjungans[].poli.spesialisasi`.
- Enum: spesialisasi `umum`/`gigi`/`kulit`/`estetika`/`lainnya` (`SPESIALISASI` di `lib/format.js`). Audit baru: `odontogram`,
  `odontogram_kondisi`, `rencana_perawatan`, `rencana_perawatan_item`.

## Obat & inventori (F1-04)
- Obat: `{ id, kode, nama, satuan, fraksional, jam_pakai_setelah_buka, harga, stok /* float, total lintas cabang */,
  stok_minimum, is_active }`. `fraksional=true` → input jumlah boleh desimal (≤3 angka); selain itu wajib bulat.
- Mutasi (kartu stok): `{ jenis, jumlah (bertanda, float), stok_akhir (float), cabang_id, batch_id, referensi, keterangan, created_at, user }`.
- Batch `GET /stok-batches` (izin `inventori.kelola`): `{ id, obat_id, cabang_id, no_batch, kedaluwarsa, jumlah, jumlah_awal,
  dibuka_at, kedaluwarsa_dibuka_at, obat: { id, kode, nama, satuan, fraksional }, cabang: { id, kode, nama } }`. Urut FEFO.
- `GET /stok-batches/kedaluwarsa?hari=30` → array batch (bukan paginated) untuk panel peringatan.
- Penerimaan `POST /stok-batches`: `{ obat_id, jumlah, no_batch?, kedaluwarsa? }` — `kedaluwarsa` harus > hari ini.
- Stok opname `POST /stok-batches/{id}/sesuaikan`: `{ jumlah }` = hasil hitung fisik (bukan selisih).
- Pemakaian BHP `GET|PUT /kunjungan-tindakans/{id}/bhps`:
  `[{ id, obat_id, batch_id, jumlah_standar, jumlah, stok_dipotong, obat: { id, kode, nama, satuan, fraksional } }]`.
  PUT replace-all `{ bhps: [{ obat_id, jumlah, batch_id? }] }`; **ditolak (422) setelah `stok_dipotong=true`**,
  yaitu setelah pemeriksaan diselesaikan. Tampilkan `jumlah_standar` sebagai pembanding.

## Booking (F1-02)
- `GET /appointments?dari=&sampai=` (izin `booking.lihat`): `{ id, no_booking, pasien_id, poli_id, petugas_id, mulai_at,
  selesai_at, status, catatan, kunjungan_id, pasien: { id, no_rm, nama, no_hp }, poli, petugas: { id, name },
  tindakans: [{ id, tindakan_id, durasi_menit, buffer_menit, tindakan: { id, kode, nama } }],
  sumber_dayas: [{ id, kode, nama, tipe }] }`. Paginated (default 50, maks 500) — kalender kirim `per_page` sesuai rentang.
- `GET /appointments-slot?petugas_id=&tanggal=&tindakan_ids[]=` → `{ durasi_menit, jam_kerja: [{ mulai, selesai }],
  slot: [{ mulai, selesai }] }`. Slot tiap 15 menit, yang sudah lewat tidak dikirim. **UI tidak menghitung durasi sendiri.**
- `POST /appointments`: `{ pasien_id, poli_id?, petugas_id?, mulai_at, tindakan_ids: [], sumber_daya_ids?: [], catatan? }`.
  Jangan kirim `selesai_at` — server menghitungnya dari durasi + buffer treatment.
- Bentrok petugas/ruang dan booking di luar jam praktik → 422 pada field `mulai_at` (pesannya siap ditampilkan).
- `POST /appointments/{id}/checkin` → `201 { appointment, kunjungan }`; arahkan ke antrian setelah sukses.
- Jadwal `GET /jadwals?user_id=` → `{ praktiks: [{ id, user_id, hari /* 0=Minggu */, jam_mulai, jam_selesai, is_active, user }],
  pengecualians: [{ id, user_id, tanggal, tipe: 'cuti'|'tambahan', jam_mulai, jam_selesai, keterangan, user }] }`.
- Ruang & alat `GET /sumber-dayas`: `{ id, kode, nama, tipe: 'ruang'|'alat', is_active, cabang }`.

## Kasir (F1-03)
- Tagihan list: + `pasien_id`, `total`, `diskon`, `pajak`, `keterangan`, dan relasi `pasien` (tagihan tanpa kunjungan).
  **`kunjungan` bisa null** — jangan asumsikan ada; pakai `tagihan.pasien ?? tagihan.kunjungan?.pasien`.
- Detail: + `pembayarans: [{ id, metode, jumlah, referensi, dibayar_at, dikembalikan_at, alasan_refund }]`,
  `pajak_persen`. `metode_bayar` **null bila split payment** (>1 metode) — tampilkan dari `pembayarans`.
- Bayar `POST /tagihans/{id}/bayar`: bentuk baru `{ pembayarans: [{ metode, jumlah, referensi? }], diskon? }`.
  Bentuk lama `{ metode_bayar, dibayar, diskon }` masih diterima. Hanya tunai boleh berlebih (kembalian);
  total non-tunai melebihi tagihan → 422. Diskon melebihi batas peran → 422 pada `diskon`.
- Tagihan mandiri `POST /tagihans`: `{ pasien_id?, keterangan?, items: [{ kategori: 'produk'|'paket'|'deposit'|'lainnya',
  deskripsi, jumlah, harga }] }` — untuk penjualan produk OTC.
- Void `POST /tagihans/{id}/batal` `{ alasan_batal }` & refund `POST /tagihans/{id}/refund` `{ alasan_refund }`
  butuh izin **`kasir.void`** (kasir biasa tidak punya) — sembunyikan tombolnya bila `!auth.can('kasir.void')`.
- Shift kas (izin `kasir.shift`): `GET /shift-kas/aktif` → shift atau `null`; `{ id, kasir_id, dibuka_at, ditutup_at,
  modal_awal, kas_fisik, selisih, catatan, kasir, cabang, rekap: { per_metode: [{ metode, jumlah_transaksi, total }],
  total, total_refund, kas_seharusnya } }`. Tutup: `POST /shift-kas/{id}/tutup` `{ kas_fisik, catatan? }`.
- Batal resep `POST /reseps/{id}/batal` `{ alasan_batal }` (izin `farmasi.resep`), hanya yang belum diserahkan.

## Dashboard
```js
{ tanggal, kunjungan: { total, per_status: { menunggu, diperiksa, menunggu_pembayaran, selesai, batal },
  per_poli: [{ id, nama, kunjungans_count }] }, pasien_total, pasien_baru_hari_ini, resep_menunggu,
  tagihan_belum_bayar, pendapatan_hari_ini /* null bila bukan kasir/admin */, obat_stok_menipis: [{ id, nama, satuan, stok }] }
```

## Nilai enum yang dipakai UI
- Status kunjungan: `menunggu`, `diperiksa`, `menunggu_pembayaran`, `selesai`, `batal`
- Status resep: `menunggu`, `diserahkan`, `batal` · Status tagihan: `belum_bayar`, `lunas`, `batal`
- Status booking: `dijadwalkan`, `dikonfirmasi`, `hadir`, `batal`, `tidak_hadir`
- Tipe sumber daya: `ruang`, `alat` · Tipe pengecualian jadwal: `cuti`, `tambahan`
- Kategori item tagihan mandiri: `produk`, `paket`, `deposit`, `lainnya`
- Penjamin: `umum`, `bpjs`, `asuransi` · Metode bayar: `tunai`, `debit`, `qris`, `transfer`, `penjamin`
- Peran: kode bebas dari `GET /perans` (bawaan: `admin`, `pendaftaran`, `perawat`, `dokter`, `apoteker`, `kasir`, `terapis`, `manajer`, `marketing`)
- Kategori berkas: `foto_klinis`, `informed_consent`, `radiologi`, `hasil_penunjang`, `lainnya`
- Aksi audit: `buat`, `ubah`, `hapus`, `pulihkan`, `lihat`, `akses_berkas`, `unduh_berkas`, `login`, `login_gagal`, `logout`, `ubah_izin`, `ubah_password`, `2fa_*`
- Jenis data audit baru (F1-01): `kategori_tindakan`, `tindakan_harga`, `tindakan_bhp` (label di `AuditLogView` `TIPE`)
- Jenis data audit baru (F1-02/03/04): `appointment`, `appointment_tindakan`, `sumber_daya`, `jadwal_praktik`,
  `jadwal_pengecualian`, `pembayaran`, `shift_kas`, `stok_batch`, `kunjungan_tindakan_bhp`
- Izin baru: `booking.lihat`, `booking.kelola`, `jadwal.kelola`, `kasir.void`, `kasir.shift`, `inventori.kelola`, `rme.tindakan`, `rme.terbatas`
- F1-05: jenis catatan `umum`/`injeksi`/`energi` · status consent `disetujui`/`ditolak`/`dicabut` · hubungan penanda tangan
  `pasien`/`orang_tua`/`suami_istri`/`anak`/`saudara`/`wali` · bagian addendum `subjektif`/`objektif`/`asesmen`/`plan`/`diagnosa`/
  `tindakan`/`resep`/`lainnya` · reaksi kulit (lihat `REAKSI_KULIT` di `lib/format.js`). Jenis data audit baru: `icd9cm`,
  `template_soap`, `template_consent`, `informed_consent`, `catatan_tindakan`, `catatan_tindakan_titik`, `pemeriksaan_addendum`.
