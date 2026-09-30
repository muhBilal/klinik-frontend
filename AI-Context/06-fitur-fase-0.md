# 06 — Fitur Fase 0 (Fondasi) di Frontend

Ringkasan UI per fitur Fase 0 PRD. Aturan bisnis & API lengkap per fitur ada di repo backend
`backend/AI-Context/modul/F0-0x-*.md`; progres keseluruhan di `backend/AI-Context/07-roadmap-progress.md`.

## F0-01 Peran & izin (PRD AD-02)

| Bagian | File |
|--------|------|
| `can(...izin)` menggantikan `hasRole()`; izin dari `user.izin` | `stores/auth.js` |
| Route `meta.izin`, menu `izin`, aksi cepat Ctrl+K `izin` | `router/index.js`, `lib/menu.js`, `components/CommandPalette.vue` |
| Halaman Peran & Izin (list, form izin per grup) | `views/admin/PeranView.vue` |
| Form pengguna: peran dari `/perans`, cabang, Poli/SIP bila peran berizin `pemeriksaan.dokter` | `views/master/UserView.vue` |
| Pemeriksaan: tanpa `pemeriksaan.dokter` = mode tanda vital + S | `views/pemeriksaan/PemeriksaanView.vue` |
| Rekam medis & lampiran disembunyikan tanpa `rme.lihat` | `KunjunganDetail.vue`, `pasien/PasienDetail.vue` |

Pemetaan pengecekan lama → baru: `hasRole('pendaftaran')` → `can('pasien.kelola')` / `can('kunjungan.daftar')`;
`hasRole('kasir')` (pendapatan) → `can('laporan.keuangan')`; `role === 'admin'` (hapus obat) → `can('master.kelola')`;
`role === 'perawat'` → `!can('pemeriksaan.dokter')`; `role === 'dokter'` (filter pasien saya) → `user.tercatat_dokter`.

## F0-02 Multi-cabang (PRD AD-01)

- Store auth: `cabangAktif`, `cabangs`, `cabang`, `lintasCabang`, `setCabang()`; header `X-Cabang-Id` di `lib/api.js`.
- `AppLayout`: pemilih cabang (select, desktop ≥ md & di drawer mobile) untuk user lintas cabang; chip nama cabang untuk staf.
- `views/master/CabangView.vue` (MasterCrud, jam operasional `type="time"`); setelah berubah memanggil `auth.fetchMe()`.
- Dashboard: subjudul menyebut cabang aktif / "semua cabang". Riwayat pasien & pemeriksaan menampilkan nama cabang kunjungan.

## F0-03 Audit log (PRD AD-03)

- `views/admin/AuditLogView.vue`: filter aksi, jenis data, rentang tanggal, cari label; badge warna (merah hapus/gagal, biru akses
  data pasien, hijau buat); modal detail dengan tabel kolom sebelum/sesudah.
- `PasienDetail` → tombol **Jejak Akses** (`/admin/audit?pasien_id=`) bila `can('audit.lihat')`.

## F0-04 Keamanan sesi & 2FA (PRD 7.2)

- `LoginView`: langkah kode 2FA / kode pemulihan; pesan sesi berakhir (`?sesi=habis`).
- `views/ProfilView.vue` (`/profil`, klik nama/avatar di header): akun, ganti password, aktivasi 2FA (QR `qrcode` + kunci manual),
  kode pemulihan sekali tampil (salin), buat kode baru, nonaktifkan.
- Router: `auth.perlu2fa` → paksa ke `/profil`. Interceptor 403 `wajib_2fa` → `/profil`. Interceptor 401 → `/login?sesi=habis`.
- `AppLayout`: `useIdle(user.sesi.idle_timeout_menit)` → logout + toast "Sesi diakhiri karena tidak ada aktivitas."

## F0-05 Berkas terenkripsi (PRD FT-03)

- `components/LampiranBerkas.vue` di `PemeriksaanView` (unggah untuk kunjungan), `KunjunganDetail` (read-only), `PasienDetail`
  (semua lampiran pasien). Kategori: `KATEGORI_BERKAS` (`lib/format.js`), ukuran: `ukuranBerkas()`.
- "Lihat" → `GET /berkas/{uuid}/tautan` → gambar di modal (tanpa drag/klik kanan), PDF di tab baru.

## F0-06 Pengaturan klinik (PRD AD-04)

- `stores/klinik.js` (`GET /info`) → nama klinik di login, header (aria-label/title), kop struk, etiket, tiket antrian.
- `views/admin/PengaturanView.vue`: identitas, catatan kaki & lebar struk, prefix nomor (huruf kapital otomatis), idle timeout,
  peran wajib 2FA. Setelah simpan → `klinik.muat(true)`.
- `lib/print.js`: `printElement(selector, judul, { lebar })` menambahkan `@page { size: <lebar> auto }`.

## Verifikasi

`npm run build` lulus. Belum ada test otomatis frontend (tidak ada test runner); uji manual di browser dengan akun demo:
admin (lintas cabang, semua menu), dokter (pemeriksaan + lampiran), terapis (mode tanda vital), pendaftaran (tanpa rekam medis),
manajer (audit log & pendapatan).
