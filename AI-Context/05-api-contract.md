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
  id, no_registrasi, tanggal, no_antrian, penjamin, no_penjamin, keluhan, status, dipanggil_at, selesai_at, pasien_id,
  pasien: { id, no_rm, nama, jenis_kelamin, tanggal_lahir, umur, alergi, golongan_darah, no_bpjs, ... },
  poli: { id, kode, nama, tarif_konsultasi },
  dokter: { id, name, sip } | null,
  pemeriksaan: { tekanan_darah, nadi, suhu, respirasi, berat_badan, tinggi_badan, subjektif, objektif, asesmen, plan,
                 diagnosas: [{ id, icd10_id, jenis, icd10: { kode, nama } }] } | null,
  tindakans: [{ id, tindakan_id, jumlah, tarif, tindakan: { nama } }],
  resep: { id, no_resep, status, catatan, items: [{ obat_id, jumlah, aturan_pakai, harga, obat: { nama, satuan, stok } }] } | null,
  tagihan: { id, no_tagihan, total, grand_total, status } | null
}
```
Detail memuat `pasien` subset (no_rm, nama, jenis_kelamin, tanggal_lahir/umur, golongan_darah, alergi), `cabang` (id, kode, nama),
`tagihan` tanpa `items` (hanya id, no_tagihan, total, grand_total, status). **Tanpa izin `rme.lihat` key `pemeriksaan`,
`tindakans`, `resep` tidak ada** — komponen harus tahan data itu kosong. List kunjungan memuat `pasien` (id, no_rm, nama,
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
- Izin baru: `booking.lihat`, `booking.kelola`, `jadwal.kelola`, `kasir.void`, `kasir.shift`, `inventori.kelola`
