# 08 — Fitur Fase 1 (MVP Estetika) di Frontend

Isi: F1-01 Katalog treatment · F1-02/03/04 (backend saja, kecuali editor BHP) · **F1-05 RME estetika** · **F1-06 Foto klinis** ·
**F1-07 Kedokteran gigi** · **F1-08 Paket & promo** · **F1-09 Komisi** · **F1-10 Data klinis & UU PDP** · **F1-11 Laporan**.

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
| F1-03 Kasir | Form bayar multi-metode, layar buka/tutup shift + rekap (+ `refund_paket`), tombol void & refund, form penjualan produk | Tagihan tanpa kunjungan, kode promo & pajak di layar bayar **sudah** ada (F1-08). `metode_bayar` null saat split payment. Tombol void/refund hanya untuk `auth.can('kasir.void')` |
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
| Ringkasan RME: ICD-9-CM, petugas, catatan tindakan, consent (klik = lihat), tanda tangan, addendum, akses terbatas | `components/RekamMedisRingkas.vue` |
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
- Kartu Tindakan untuk tenaga ber-izin `rme.tindakan` tanpa `pemeriksaan.dokter` (perawat, terapis): menambah tindakan & memakai sesi paket,
  mengubah/menghapus baris sendiri; baris petugas lain terkunci kecuali pilihan paket ("· dicatat …"); catatan tindakan & consent.
- Label tombol catatan mengikuti `jenis_catatan` treatment: **Face chart** (injeksi), **Parameter alat** (energi), **Catatan tindakan**.
  Modal langsung membuka tab yang sesuai.
- Consent wajib (treatment ber-`template_consent_id`) → tombol primer "Ambil informed consent (wajib)" dan hitungan "N tindakan
  menunggu informed consent" di kepala kartu. Consent yang ada tampil sebagai badge status (klik = lihat/cetak/cabut).
- Diagnosa sensitif (IMS/HIV) otomatis mencentang & mengunci "Akses terbatas"; template ber-`akses_terbatas` juga mencentangnya.
- Favorit: bintang di tiap diagnosa (toggle `/kode-favorits`), chip "Favorit" di bawah pencarian untuk tambah cepat, ikon bintang (AppIcon + teks `sr-only`) di hasil pencarian.
- Mode baca (ditutup): tombol & kartu "Tanda Tangan RME" berisi penanda tangan, SIP, waktu, daftar addendum, "+ Addendum".

Face chart & batch: memilih produk untuk satu titik mengisi titik lain yang belum berproduk; batch default = batch FEFO pertama
(`GET /stok-batches?obat_id=&tersedia=1`, butuh `inventori.kelola` — tanpa izin itu batch tidak bisa dipilih). Titik baru mewarisi
produk/batch/dosis titik sebelumnya.

`SignaturePad`: kanvas pointer events (jari/stylus/mouse), resolusi `devicePixelRatio`, latar putih ikut diekspor, v-model = PNG
data URL (kosong bila belum ada goresan). Ukuran memakai `offsetWidth` (bukan `getBoundingClientRect`) agar tidak terpengaruh animasi
transform `AppModal`; border di pembungkus agar koordinat tidak bergeser. Ukuran berubah (rotasi tablet) = kanvas dikosongkan.

Verifikasi F1-05: `npm run build` lulus + E2E Chrome headless (playwright-core, stack dev terisolasi port 8010 + Vite): template →
botox → face chart 4 titik → consent + tanda tangan → selesai & tanda tangani → cek keutuhan → addendum → cetak consent; kunjungan
IMS dibuka dokter lain (akses terbatas); halaman master & pengaturan. Tanpa error konsol.

## F1-06 Foto klinis before-after (PRD FT-01..04, RM-04)

Backend & aturan: `backend/AI-Context/modul/F1-06-foto-klinis.md`.

| Bagian | File |
|--------|------|
| Proses gambar di browser (maks. 2048 px, thumbnail 360 px, EXIF terbuang), unggah foto, tautan massal, label posisi | `lib/foto.js` |
| Kartu gabungan: persetujuan foto + tombol Ambil foto + galeri; `ambil(tindakan)` di-expose | `components/foto/FotoKlinisCard.vue` |
| Status/tanda tangan/ganti/cabut/riwayat/cetak persetujuan foto bertingkat | `components/foto/PersetujuanFotoPanel.vue` |
| Kamera terpandu: protokol, tindakan terkait, tahap, langkah posisi (ikon centang + teks `sr-only` per tahap), bingkai panduan, pratinjau → Simpan & lanjut; fallback unggah berkas | `components/foto/KameraFoto.vue` |
| Galeri: per kunjungan, lingkup kunjungan ini/semua, filter protokol/posisi/tahap, pilih 2, "⇆ awal", viewer + hapus | `components/foto/GaleriFoto.vue` |
| Bandingkan: slider (clip-path + range) & berdampingan | `components/foto/BandingFoto.vue` |
| Pemeriksaan: kartu Foto Klinis + tombol **Foto** per tindakan (protokol dari treatment); lampiran lain tanpa foto | `views/pemeriksaan/PemeriksaanView.vue`, `components/LampiranBerkas.vue` (`tanpa-foto`) |
| Detail kunjungan (baca) & detail pasien (semua kunjungan; tanpa `rme.lihat` hanya panel persetujuan) | `views/KunjunganDetail.vue`, `views/pasien/PasienDetail.vue` |
| Master Protokol Foto (posisi berurutan, kode otomatis) — modul Rekam Medis | `views/master/ProtokolFotoView.vue`, `lib/menu.js`, `router/index.js` |
| Treatment: pilihan protokol foto · Pengaturan: Foto Klinis (wajib persetujuan, naskah) | `views/master/TindakanView.vue`, `views/admin/PengaturanView.vue` |

Perilaku penting:
- Kamera memakai `getUserMedia` (butuh HTTPS atau localhost). `<video>` selalu terpasang (`v-show`) agar stream tidak lepas saat pratinjau.
  Kamera dimatikan saat modal ditutup.
- `simpan()` mengunci konteks (pratinjau, posisi, tahap, langkah) **sebelum** upload; selama upload pilihan protokol/tindakan/tahap/posisi
  dinonaktifkan. Tanpa ini hasil upload yang terlambat bisa menandai posisi lain dan menghapus pratinjau baru (ditemukan di E2E).
- Galeri meminta tautan pratinjau hanya untuk foto yang sedang tampil (`POST /berkas/tautan`, setiap tautan tercatat audit); foto penuh
  diminta saat dibuka / dibandingkan. Jumlah kolom memakai container query (`@container`, `@sm:`, `@2xl:`) sehingga pas di kolom samping
  pemeriksaan maupun halaman lebar.
- Tombol "Ambil foto" tetap aktif walau belum ada persetujuan (kewajiban bisa dimatikan di pengaturan); backend menolak dengan
  `consent_foto` dan kamera menampilkan pesannya.

Verifikasi F1-06: `npm run build` + E2E Chrome headless dengan kamera palsu (lihat modul backend F1-06). Tanpa error konsol.

## F1-07 Kedokteran gigi: odontogram, rencana perawatan, tindakan per gigi (PRD DG-01, DG-02, DG-07)

Backend & aturan: `backend/AI-Context/modul/F1-07-odontogram.md`.

| Bagian | File |
|--------|------|
| Notasi FDI, label permukaan, format gigi, saran fase, `referensiGigi()` (cache) | `lib/gigi.js` |
| Gambar odontogram SVG: 4 baris (tetap atas, sulung atas, sulung bawah, tetap bawah), 5 permukaan per gigi, warna kondisi, bingkai kondisi seluruh gigi, silang gigi hilang, kode di bawah/atas nomor | `components/gigi/OdontogramChart.vue` |
| Kartu Odontogram: pilih gigi/permukaan → kondisi berlaku (hapus koreksi / akhiri), form catat (kondisi per permukaan / seluruh gigi, permukaan, keterangan), "+ Tindakan untuk gigi ini", perubahan kunjungan (pulihkan), ringkasan & legenda, pilihan status pada kunjungan sebelumnya (detail pasien), toggle gigi sulung | `components/gigi/OdontogramCard.vue` |
| Input nomor gigi + permukaan | `components/gigi/PilihGigi.vue` |
| Rencana perawatan: per fase, estimasi, status item (selesai / ada di tindakan / sedang dikerjakan / Kerjakan), Pasien setuju, Revisi, Batalkan, Cetak estimasi (kop klinik + tanda tangan pasien & dokter) | `components/gigi/RencanaPerawatanCard.vue` |
| Form susun/ubah rencana (treatment per cabang, fase 1–9, gigi, jumlah, subtotal per fase) | `components/gigi/RencanaPerawatanModal.vue` |
| Pemeriksaan: kartu Odontogram + Rencana (poli gigi), input gigi per tindakan, chip "Untuk gigi N", Kerjakan item rencana | `views/pemeriksaan/PemeriksaanView.vue` |
| Detail kunjungan (odontogram pada kunjungan itu) · detail pasien (odontogram terkini + riwayat, rencana) | `views/KunjunganDetail.vue`, `views/pasien/PasienDetail.vue` |
| Ringkasan RME: gigi per tindakan, kondisi dicatat/diakhiri | `components/RekamMedisRingkas.vue` |
| Master Poli: kolom & pilihan spesialisasi · Treatment: "Tindakan per gigi", "Kondisi gigi setelah tindakan", keterangan "per gigi → cof" di daftar | `views/master/PoliView.vue`, `views/master/TindakanView.vue` |
| Badge `draf`/`dibatalkan`/`rencana`, label audit, konstanta `SPESIALISASI` | `components/StatusBadge.vue`, `views/admin/AuditLogView.vue`, `lib/format.js` |

Perilaku penting:
- Kartu gigi tampil bila `kunjungan.poli.spesialisasi === 'gigi'`, ada tindakan per gigi, atau kunjungan mencatat kondisi gigi; di detail
  pasien bila `data_gigi` atau pernah ke poli gigi. Butuh `rme.lihat`.
- Odontogram bisa diisi hanya saat backend mengirim `bisa_diubah` (pasien `diperiksa`) dan user punya `pemeriksaan.dokter` / `rme.tindakan`.
  Klik permukaan memilih permukaan itu & menyarankan "car"; klik nomor gigi = seluruh gigi.
- Kondisi hasil tindakan dibuat backend saat pemeriksaan disimpan → setelah `simpan()` sukses, PemeriksaanView memanggil
  `odontogramCard.muatUlang()` & `rencanaCard.muatUlang()`. Kondisi turunan tidak punya tombol Hapus/Akhiri (ubah tindakannya).
- "+ Tindakan untuk gigi ini" menyimpan `gigiTarget` (chip di kartu Tindakan) dan menggulir ke pencarian tindakan; tindakan per gigi
  berikutnya memakai gigi & permukaan itu. "Kerjakan" dari rencana menambah baris dengan `rencana_item_id`, gigi, permukaan & jumlah item.
- `PilihGigi` menyembunyikan permukaan bila kondisi hasil tindakan berlaku untuk seluruh gigi (mis. cabut → hilang), memakai referensi.
- Cetak estimasi lewat `printElement('#cetak-rencana')`; elemen dirender di dalam pembungkus `hidden` (yang disalin hanya `article`-nya).

Verifikasi F1-07: `npm run build` + E2E Chrome headless (alur lengkap drg., lihat modul backend F1-07), mobile 390 px tanpa scroll
horizontal. Tanpa error konsol.

## F1-08 Paket multi-sesi, voucher & promo (PRD TR-02, TR-06, BL-01)

Backend & aturan: `backend/AI-Context/modul/F1-08-paket-promo.md`.

| Bagian | File |
|--------|------|
| Master Paket Treatment: isi treatment × sesi, harga (hemat % vs harga normal), masa berlaku, lintas cabang, jumlah terjual | `views/master/PaketView.vue` |
| Voucher & Promo: daftar (potongan, cakupan, periode, dipakai/kuota, status berlaku/belum mulai/berakhir/kuota habis) & form | `views/kasir/PromoView.vue` |
| Kartu paket pasien: sisa per treatment, status efektif, bayar (menunggu bayar), riwayat pemakaian, perpanjang/alihkan/refund sisa (simulasi nominal) | `components/paket/PaketPasienCard.vue` |
| Jual paket (pilih pasien bila belum ada → paket → tagihan) | `components/paket/JualPaketModal.vue` |
| Pemeriksaan: "Pakai paket … tersedia N sesi" per tindakan (otomatis), Rp 0 di estimasi, kartu paket ringkas | `views/pemeriksaan/PemeriksaanView.vue` |
| Pemeriksaan (revisi): **Pesan paket** (`JualPaketModal` mode `kunjungan`), daftar pesanan + Batalkan, estimasi + harga pesanan, kartu paket samping memuat pesanan kunjungan (`kunjunganId`) | `views/pemeriksaan/PemeriksaanView.vue`, `components/paket/JualPaketModal.vue`, `components/paket/PaketPasienCard.vue` |
| Kasir (revisi): **Batalkan paket** pesanan pemeriksaan pada tagihan kunjungan belum bayar (tagihan disusun ulang; toast bila promo dilepas) | `views/kasir/TagihanDetail.vue` |
| Kasir: "+ Jual paket", tagihan tanpa kunjungan di daftar & detail, kode voucher (pakai/lepas), pajak & promo di total, info paket aktif | `views/kasir/TagihanList.vue`, `views/kasir/TagihanDetail.vue` |
| Detail pasien: kartu Paket Treatment · Pengaturan: Paket Treatment (transfer, refund sisa, potongan) + prefix nomor paket | `views/pasien/PasienDetail.vue`, `views/admin/PengaturanView.vue` |
| Menu (Paket Treatment di Master Data, Voucher & Promo di Keuangan), route, badge status paket/promo, label audit | `lib/menu.js`, `router/index.js`, `components/StatusBadge.vue`, `views/admin/AuditLogView.vue` |

Perilaku penting:
- **Sisa "tersedia" di pemeriksaan** = sisa dari backend + sesi yang sudah dipesan baris tersimpan itu sendiri − baris lain di form yang
  belum tersimpan (`opsiPaket`). Setelah simpan, daftar paket dimuat ulang **sebelum** form diisi ulang (`await muatPaket()` lalu `isiForm`)
  — urutan terbalik membuat angka sempat salah (ditemukan di E2E).
- Tindakan yang ditambahkan otomatis memakai paket bila ada sisa (toast); dokter bisa memilih "Bayar normal". Pilihan baru tidak bisa
  melebihi sisa (opsi dinonaktifkan); backend tetap menolak 422.
- Tersedia per opsi = sisa backend + sesi yang dipesan baris tersimpan kunjungan ini − pemakaian baris lain di form. Pemakaian otomatis
  memilih paket aktif dulu (masa berlaku terdekat, lalu terlama), pesanan baru paling akhir; opsi pesanan bertanda "pesanan baru"; select
  dibatasi `max-w-full` (tidak melebar di 390 px). Baris tersimpan yang pemakaian paketnya berubah ditandai "belum disimpan".
- Paket aktif setelah tagihan lunas; kartu menampilkan tombol "Bayar Rp …" ke halaman kasir selama `menunggu_bayar`.
- Kasir tidak lagi berasumsi `tagihan.kunjungan` ada (sebelumnya daftar kasir error untuk tagihan mandiri).
- Peran kasir kini memegang `pasien.lihat` (cari pasien untuk jual paket, buka detail pasien tanpa RME).

## F1-09 Komisi & jasa medis (PRD KM-01, KM-03)

Backend & aturan: `backend/AI-Context/modul/F1-09-komisi.md`.

| Bagian | File |
|--------|------|
| **Komisi di master treatment** (revisi): bagian "Komisi & jasa medis" di form treatment — Dokter / Terapis / Asisten × Persen/Rupiah + contoh "≈ Rp … dari harga dasar"; kolom Komisi di daftar (`?komisi=1`); hanya untuk komisi.kelola | `views/master/TindakanView.vue` |
| **Jasa konsultasi = treatment**: Master Poli kolom & pilihan "Jasa konsultasi dokter" (treatment kategori/nama "konsultasi"); estimasi pemeriksaan memakai `kunjungan.konsultasi` ("Tanpa jasa konsultasi" bila dicatat sebagai tindakan) | `views/master/PoliView.vue`, `views/pemeriksaan/PemeriksaanView.vue` |
| Daftar periode (cabang aktif) & buat periode (default bulan berjalan); tombol "Komisi per treatment" | `views/komisi/KomisiPeriodeView.vue` |
| Detail rekap: total/status/dasar, per petugas (rincian per peran, slip), rincian (filter petugas), hitung ulang, penyesuaian (+ hapus), setujui & kunci, hapus draf | `views/komisi/KomisiPeriodeDetail.vue` |
| Komisi Saya: daftar periode disetujui + slip & cetak | `views/komisi/KomisiSayaView.vue` |
| Slip (kop klinik, baris, subtotal per peran, total, tanda tangan; "DRAF" bila belum disetujui) | `components/komisi/SlipKomisi.vue` |
| Pemeriksaan: select **Pelaksana** + **Asisten (opsional)** per tindakan · Ringkasan RME: asisten · Pengaturan: Komisi (neto/bruto) · Kasir: "Tandai lunas (Rp 0)" | `views/pemeriksaan/PemeriksaanView.vue`, `components/RekamMedisRingkas.vue`, `views/admin/PengaturanView.vue`, `views/kasir/TagihanDetail.vue` |
| Menu, route, label audit, konstanta `PERAN_KOMISI`/`SUMBER_KOMISI` | `lib/menu.js`, `router/index.js`, `views/admin/AuditLogView.vue`, `lib/format.js` |

Perilaku penting:
- Tombol "Setujui & kunci" hanya untuk `komisi.setujui` (bawaan: administrator); manajer (`komisi.kelola`) menghitung & memberi penyesuaian.
  Setelah disetujui semua tombol ubah hilang (backend juga menolak).
- Slip di detail rekap memakai baris yang sudah dimuat (filter per petugas); "Komisi Saya" meminta slip per periode.
- Path sengaja tidak saling berawalan agar penanda menu aktif benar.

## F1-11 Laporan & dashboard harian (PRD LP-01..03)

Backend & aturan hitung: `backend/AI-Context/modul/F1-11-laporan.md`.

| Bagian | File |
|--------|------|
| Laporan penjualan: kartu ringkasan (penjualan bersih, transaksi, diskon & promo, refund), baris pajak/total/setelah refund, bar per hari, tabel per treatment (jumlah, bruto, neto, sesi & nilai paket), per dokter (+ porsi), per metode (diterima/dikembalikan/bersih), per cabang, per kategori; Cetak | `views/laporan/LaporanPenjualanView.vue` |
| Laporan paket: kartu terjual, pendapatan diakui, refund & hangus, sisa kewajiban (hari ini); per paket; segera kedaluwarsa ≤ 30 hari (link pasien, sisa hari merah ≤ 7) | `views/laporan/LaporanPaketView.vue` |
| Filter periode + pintasan | `components/laporan/PeriodeFilter.vue` |
| Dashboard: kartu Booking hari ini (no-show), Top treatment hari ini, Per cabang hari ini (semua cabang), pintasan Laporan penjualan; grid `grid-cols-1` untuk mobile | `views/DashboardView.vue` |
| Menu Keuangan, route, `KATEGORI_TAGIHAN`, `isoTanggal()` | `lib/menu.js`, `router/index.js`, `lib/format.js` |

Perilaku penting: hanya respons permintaan terakhir yang ditampilkan (ganti periode cepat); data lama tetap tampil redup saat memuat.
Verifikasi F1-11: `npm run build` + E2E Chrome headless dengan data demo (dashboard admin & kasir, laporan bulan lalu, laporan paket,
akses dokter ditolak, mobile 390 px, race periode dengan permintaan pertama diperlambat). Tanpa error konsol.

## F1-10 Data klinis pasien & persetujuan UU PDP (PRD PS-03, PS-04)

Backend & aturan: `backend/AI-Context/modul/F1-10-data-klinis-pdp.md`.

| Bagian | File |
|--------|------|
| Chip peringatan klinis (alergi + keparahan/reaksi, hamil/menyusui + tanggal, "belum ditanyakan" hanya perempuan 12–55 th, Fitzpatrick, riwayat obat & penyakit) | `components/klinis/PeringatanKlinis.vue` |
| Modal ubah data klinis: alergi per baris (kategori, zat, keparahan, reaksi, tautkan obat lewat `AsyncSelect /obats`), Fitzpatrick, hamil/menyusui (+ konfirmasi ulang), riwayat obat & penyakit | `components/klinis/DataKlinisModal.vue` |
| Kartu Data Klinis di detail pasien (rme.lihat) | `components/klinis/DataKlinisCard.vue`, `views/pasien/PasienDetail.vue` |
| Panel persetujuan UU PDP: status, formulir (naskah pemrosesan + centang wajib; opt-in promosi bawaan "Tidak bersedia", kanal, naskah ikut kanal; penanda tangan; `SignaturePad`), cabut opt-in / cabut persetujuan (ikut mencabut opt-in), riwayat, lihat & cetak | `components/pdp/PersetujuanDataPanel.vue` |
| Pemeriksaan: kartu peringatan klinis di bawah identitas + tombol "Data klinis"; toast & baris resep "Pasien alergi …" | `views/pemeriksaan/PemeriksaanView.vue`, `lib/klinis.js` |
| Farmasi: alergi (+ keparahan/reaksi), status hamil/menyusui, peringatan per item resep | `views/farmasi/ResepDetail.vue` |
| Pendaftaran: panel persetujuan ringkas di kartu pasien + pesan 422 `persetujuan_data`; grid `grid-cols-1` (sebelumnya melebar di mobile) | `views/pendaftaran/PendaftaranView.vue` |
| Daftar pasien: filter persetujuan, chip status; alergi dihapus dari daftar & form pasien | `views/pasien/PasienList.vue`, `components/PasienFormModal.vue` |
| Pengaturan → Data Pribadi (UU PDP); label audit; konstanta `KATEGORI_ALERGI`, `KEPARAHAN_ALERGI`, `FITZPATRICK`, `STATUS_KEHAMILAN`, `JENIS_PERSETUJUAN_DATA`, `KANAL_MARKETING` | `views/admin/PengaturanView.vue`, `views/admin/AuditLogView.vue`, `lib/format.js` |

Perilaku penting:
- Data klinis hanya untuk rme.lihat; kasir/marketing/pendaftaran melihat status persetujuan saja. Tombol ubah data klinis untuk
  pemeriksaan.vital / pemeriksaan.dokter / rme.tindakan; tanda tangan & cabut persetujuan untuk pasien.kelola.
- Peringatan alergi tidak memblokir resep (keputusan dokter). Simpan data klinis di pemeriksaan memperbarui `kunjungan.pasien` di tempat.

Verifikasi F1-10: `npm run build` + E2E Chrome headless (pendaftaran tanda tangan persetujuan + opt-in → daftar; wajib aktif → ditolak;
daftar pasien; kasir tanpa data klinis; dokter peringatan → ubah data klinis → peringatan resep; dokumen persetujuan; farmasi; mobile 390 px).
Tanpa error konsol selain 422 yang diuji.

Verifikasi F1-09: `npm run build` + E2E Chrome headless (dokter pilih asisten → kasir bayar → manajer periode, hitung, slip,
penyesuaian → admin setujui → terapis/dokter Komisi Saya; mobile 390 px). Revisi: admin ubah komisi di form treatment, Master Poli ganti
jasa konsultasi, hapus treatment konsultasi ditolak, estimasi pemeriksaan, item tagihan konsultasi, rekap, `/aturan-komisi` → 404, form
treatment mobile 390 px. Tanpa error konsol.

Verifikasi F1-08: `npm run build` + E2E Chrome headless (kasir jual → promo → bayar; dokter pakai sesi; manajer riwayat/perpanjang/kebijakan
refund; promo baru; master; mobile 390 px tanpa scroll horizontal di detail pasien, tagihan, daftar kasir). Tanpa error konsol selain 422
kode promo salah yang disengaja. Revisi (1 Okt 2026): E2E `pesan-paket` (pesan/batal pesanan, sesi 1 otomatis, terapis
terkunci di baris dokter, Selesai dari form lama diminta memeriksa dulu, kasir satu tagihan → paket aktif, kasir Batalkan paket → tagihan
disusun ulang, mobile 390 px, tanpa emoji).

## Verifikasi

`npm run build` lulus. Belum ada test otomatis frontend; uji manual dengan akun admin (Master Data → Treatment: buat treatment,
atur harga khusus / tidak dilayani per cabang, tambah BHP) lalu dokter (pemeriksaan di cabang tersebut: harga & daftar treatment
mengikuti cabang).
