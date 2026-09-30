# 08 — Fitur Fase 1 (MVP Estetika) di Frontend

Isi: F1-01 Katalog treatment · F1-02/03/04 (backend saja, kecuali editor BHP) · **F1-05 RME estetika**.

Ringkasan UI per fitur Fase 1 PRD. Aturan bisnis & API lengkap per fitur ada di repo backend
`backend/AI-Context/modul/F1-0x-*.md`; progres keseluruhan di `backend/AI-Context/07-roadmap-progress.md`.

## F1-01 Katalog treatment (PRD TR-01)

| Bagian | File |
|--------|------|
| Halaman katalog (list + form treatment) — menu Master Data → **Treatment** (`/master/tindakan`) | `views/master/TindakanView.vue` |
| Kategori treatment (MasterCrud) — `/master/kategori-treatment`, tombol "Kategori" di halaman katalog | `views/master/KategoriTindakanView.vue` |
| Route & menu | `router/index.js`, `lib/menu.js` (item "Treatment" & "Kategori Treatment") |
| Aksi cepat Ctrl+K "Tambah Treatment / Tindakan" → `/master/tindakan?baru=1` (`useQueryAction`) | `components/CommandPalette.vue` |
| Pilihan tindakan di pemeriksaan memakai harga cabang kunjungan | `views/pemeriksaan/PemeriksaanView.vue` |
| Label jenis data audit `kategori_tindakan`, `tindakan_harga`, `tindakan_bhp` | `views/admin/AuditLogView.vue` |

Perilaku `TindakanView`:
- List: filter cari/kategori/status; kolom durasi `30 mnt + 10` (tindakan + buffer), harga dasar, kolom harga **cabang aktif**
  (hanya bila `auth.cabang` terpilih; tebal bila berbeda dari harga dasar, "tidak dilayani" bila `tersedia=false`), jumlah cabang
  berharga khusus, jumlah bahan BHP.
- "Ubah" memuat `GET /tindakans/{id}` dulu (list tidak memuat `hargas`/`bhps`).
- Grid harga per cabang = semua cabang dari `cachedGet('/cabangs')` + cabang yang sudah punya harga khusus. Mode per baris:
  **Harga dasar** (tidak dikirim), **Harga khusus** (`tersedia: true`, tarif diisi), **Tidak dilayani** (`tersedia: false`,
  tarif = harga dasar). Error `hargas.N.*` dipetakan ke baris lewat indeks di daftar yang dikirim (`hargaDikirim`).
- BHP: `AsyncSelect` `/obats?aktif=1`, jumlah desimal (`step=0.001`) dalam satuan stok; bahan duplikat ditolak di UI.
- Info "Slot booking: N menit" = durasi + buffer (dipakai modul Booking nanti).

`PemeriksaanView`: `AsyncSelect` `/tindakans` dengan `{ aktif: 1, cabang_id: kunjungan.cabang_id }` sehingga treatment yang tidak
dilayani di cabang kunjungan tidak muncul; estimasi biaya memakai `tarif_cabang`; nilai final tetap snapshot backend.

## F1-02 Booking · F1-03 Kasir · F1-04 Inventori — **backend saja, UI belum dibuat**

Backend ketiga modul ini sudah selesai & teruji (lihat `backend/AI-Context/modul/F1-02..04`), tetapi **belum ada halaman
frontend-nya**. Kontrak API-nya sudah didokumentasikan di [05-api-contract.md](05-api-contract.md) supaya UI bisa menyusul.

Yang perlu dibuat nanti, beserta hal yang mudah salah:

| Modul | Halaman yang dibutuhkan | Catatan penting |
|-------|------------------------|-----------------|
| F1-02 Booking | Kalender booking, form booking (pilih treatment → slot), halaman jadwal praktik & cuti, master ruang/alat | Jangan hitung durasi/`selesai_at` di UI — ambil dari `GET /appointments-slot`. Bentrok & luar jam praktik datang sebagai 422 di field `mulai_at` |
| F1-03 Kasir | Form bayar multi-metode, layar buka/tutup shift + rekap, tombol void & refund, form penjualan produk | `tagihan.kunjungan` bisa **null**; `metode_bayar` null saat split payment. Tombol void/refund hanya untuk `auth.can('kasir.void')` |
| F1-04 Inventori | Daftar batch per obat, form penerimaan, stok opname, panel batch akan kedaluwarsa. **Editor pemakaian BHP sudah ada** (tab "Pemakaian BHP" di `CatatanTindakanModal`, F1-05) | Input jumlah desimal hanya bila `obat.fraksional`; editor BHP terkunci bila `stok_dipotong=true` |

Menu & izin yang perlu ditambahkan di `lib/menu.js` + `router/index.js`: `booking.lihat`, `booking.kelola`,
`jadwal.kelola`, `kasir.shift`, `kasir.void`, `inventori.kelola`.

## F1-05 RME estetika (PRD RM-01/02/03/05/07, DR-03, ES-01/02)

Backend & aturan: `backend/AI-Context/modul/F1-05-rme-estetika.md`.

| Bagian | File |
|--------|------|
| Pemeriksaan: template, favorit diagnosa, akses terbatas, ICD-9-CM & petugas per tindakan, tombol catatan/consent, tutup & tanda tangani, addendum | `views/pemeriksaan/PemeriksaanView.vue` |
| Diagram wajah & titik suntik (koordinat 0..1, tebakan nama area, kanan/kiri = sisi pasien) | `components/rme/FaceChart.vue` |
| Catatan tindakan: tab Catatan · Face chart · Parameter alat · Pemakaian BHP | `components/rme/CatatanTindakanModal.vue` |
| Ambil consent: naskah dari backend, setuju/menolak, penanda tangan & hubungan, tanda tangan (+ saksi) | `components/rme/ConsentFormModal.vue`, `components/SignaturePad.vue` |
| Lihat / cetak / cabut consent (tercatat audit tiap dibuka) | `components/rme/ConsentLihatModal.vue` |
| Addendum | `components/rme/AddendumModal.vue` |
| Pilih template SOAP (poli kunjungan + umum; opsi semua poli; mode isi kosong / tambahkan / timpa) | `components/rme/TemplateSoapModal.vue` |
| Ringkasan RME: ICD-9-CM, petugas, catatan tindakan, consent (klik = lihat), tanda tangan, addendum, 🔒 | `components/RekamMedisRingkas.vue` |
| Detail kunjungan: cek keutuhan (verifikasi hash), tambah addendum (cabang aktif) | `views/KunjunganDetail.vue` |
| Master: Template SOAP (halaman khusus), Template Consent & ICD-9-CM (MasterCrud), ICD-10 + penanda sensitif | `views/master/TemplateSoapView.vue`, `TemplateConsentView.vue`, `Icd9cmView.vue`, `Icd10View.vue` |
| Katalog treatment: bagian "Rekam medis" (ICD-9-CM default, bentuk catatan, consent wajib) | `views/master/TindakanView.vue` |
| Pengguna: SIP berlaku sampai · Pengaturan: Rekam Medis → wajib informed consent | `views/master/UserView.vue`, `views/admin/PengaturanView.vue` |
| Modul rail baru **Rekam Medis** (ICD-10, ICD-9-CM, Template SOAP, Template Consent) + route | `lib/menu.js`, `router/index.js` |
| Label audit & badge status consent | `views/admin/AuditLogView.vue`, `components/StatusBadge.vue` |

Perilaku penting `PemeriksaanView`:
- Tombol **Selesai & tanda tangani**: simpan (silent) → `POST /selesai`. 422 `informed_consent` (array) ditampilkan sebagai daftar di
  alert merah; 422 `sip` sebagai toast. Dokter tercatat tanpa `user.sip_aktif` melihat peringatan sebelum menutup.
- Tindakan dikirim dengan `id` (upsert). Tombol catatan/consent pada tindakan yang belum disimpan menyimpan pemeriksaan dulu.
- Kartu Tindakan juga tampil untuk tenaga ber-izin `rme.tindakan` tanpa `pemeriksaan.dokter` (perawat, terapis): mereka tidak bisa
  mengubah daftar/jumlah/petugas, tetapi bisa mengisi catatan tindakan & mengambil consent.
- Label tombol catatan mengikuti `jenis_catatan` treatment: **Face chart** (injeksi), **Parameter alat** (energi), **Catatan tindakan**.
  Modal langsung membuka tab yang sesuai.
- Consent wajib (treatment ber-`template_consent_id`) → tombol primer "Ambil informed consent (wajib)" dan hitungan "N tindakan
  menunggu informed consent" di kepala kartu. Consent yang ada tampil sebagai badge status (klik = lihat/cetak/cabut).
- Diagnosa sensitif (IMS/HIV) otomatis mencentang & mengunci "🔒 Akses terbatas"; template ber-`akses_terbatas` juga mencentangnya.
- Favorit: bintang di tiap diagnosa (toggle `/kode-favorits`), chip "Favorit" di bawah pencarian untuk tambah cepat, ★ di hasil pencarian.
- Mode baca (ditutup): tombol & kartu "Tanda Tangan RME" berisi penanda tangan, SIP, waktu, daftar addendum, "+ Addendum".

Face chart & batch: memilih produk untuk satu titik mengisi titik lain yang belum berproduk; batch default = batch FEFO pertama
(`GET /stok-batches?obat_id=&tersedia=1`, butuh `inventori.kelola` — tanpa izin itu batch tidak bisa dipilih). Titik baru mewarisi
produk/batch/dosis titik sebelumnya.

`SignaturePad`: kanvas pointer events (jari/stylus/mouse), resolusi `devicePixelRatio`, latar putih ikut diekspor, v-model = PNG
data URL (kosong bila belum ada goresan). Ukuran memakai `offsetWidth` (bukan `getBoundingClientRect`) agar tidak terpengaruh animasi
transform `AppModal`; border di pembungkus agar koordinat tidak bergeser. Ukuran berubah (rotasi tablet) = kanvas dikosongkan.

Verifikasi F1-05: `npm run build` lulus + E2E Chrome headless (playwright-core, stack dev terisolasi port 8010 + Vite): template →
botox → face chart 4 titik → consent + tanda tangan → selesai & tanda tangani → cek keutuhan → addendum → cetak consent; kunjungan
IMS dibuka dokter lain (🔒); halaman master & pengaturan. Tanpa error konsol.

## Verifikasi

`npm run build` lulus. Belum ada test otomatis frontend; uji manual dengan akun admin (Master Data → Treatment: buat treatment,
atur harga khusus / tidak dilayani per cabang, tambah BHP) lalu dokter (pemeriksaan di cabang tersebut: harga & daftar treatment
mengikuti cabang).
