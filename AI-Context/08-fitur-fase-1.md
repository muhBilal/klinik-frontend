# 08 — Fitur Fase 1 (MVP Estetika) di Frontend

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

## Verifikasi

`npm run build` lulus. Belum ada test otomatis frontend; uji manual dengan akun admin (Master Data → Treatment: buat treatment,
atur harga khusus / tidak dilayani per cabang, tambah BHP) lalu dokter (pemeriksaan di cabang tersebut: harga & daftar treatment
mengikuti cabang).
