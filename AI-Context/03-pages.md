# 03 — Halaman

Kolom **Izin** = `meta.izin` di router (salah satu; administrator memegang semua izin). Kosong = semua user login.

| Path | View | Izin | Endpoint utama |
|------|------|------|----------------|
| `/login` | `LoginView` | publik | `GET /info`, `POST /login`, `POST /login/2fa` (langkah kode 2FA) |
| `/` | `DashboardView` | — | `GET /dashboard` (cabang aktif) |
| `/profil` | `ProfilView` | — | `GET /me`, `PUT /me/password`, `POST /me/2fa`, `POST /me/2fa/konfirmasi`, `POST /me/2fa/kode-pemulihan`, `DELETE /me/2fa` |
| `/pasien` | `pasien/PasienList` | pasien.lihat | `GET /pasiens`, form via `PasienFormModal` (`POST/PUT /pasiens`, tombol: pasien.kelola) |
| `/pasien/:id` | `pasien/PasienDetail` | pasien.lihat | `GET /pasiens/{id}` (riwayat semua cabang; kolom diagnosa & lampiran bila rme.lihat), tombol Jejak Akses (audit.lihat) |
| `/pendaftaran` | `pendaftaran/PendaftaranView` | kunjungan.daftar | `GET /polis?aktif=1`, `GET /dokters`, `GET /kunjungans`, `POST /kunjungans`, `POST /kunjungans/{id}/batal`. Query `?pasien_id=` memilih pasien otomatis. Cetak tiket antrian (nama klinik & cabang). |
| `/kunjungan/:id` | `KunjunganDetail` | — | `GET /kunjungans/{id}` (lintas cabang, read-only). Rekam medis & lampiran hanya bila rme.lihat |
| `/antrian` | `pemeriksaan/AntrianView` | pemeriksaan.panggil, .vital, .dokter | `GET /kunjungans` (tab status, filter poli default = poli user), `POST .../panggil`. Auto-refresh 30 dtk. |
| `/pemeriksaan/:id` | `pemeriksaan/PemeriksaanView` | pemeriksaan.vital, .dokter | `GET /kunjungans/{id}`, `GET /pasiens/{id}/riwayat`, `PUT .../pemeriksaan`, `POST .../panggil`, `POST .../selesai`; `AsyncSelect` ke `icd10s`, `tindakans` (`aktif=1&cabang_id=` cabang kunjungan, tampil `tarif_cabang`), `obats`; `LampiranBerkas` (`/berkas`) |
| `/farmasi/resep` | `farmasi/ResepList` | farmasi.resep | `GET /reseps` |
| `/farmasi/resep/:id` | `farmasi/ResepDetail` | farmasi.resep | `GET /reseps/{id}`, `POST .../serahkan`; cetak etiket (nama klinik & cabang) |
| `/farmasi/obat` | `farmasi/ObatList` | farmasi.obat | `GET/POST/PUT /obats`, `DELETE` (master.kelola), `GET/POST /obats/{id}/mutasi` |
| `/kasir` | `kasir/TagihanList` | kasir.tagihan | `GET /tagihans` |
| `/kasir/:id` | `kasir/TagihanDetail` | kasir.tagihan | `GET /tagihans/{id}`, `POST .../bayar`; cetak struk (kop klinik/cabang, catatan kaki & lebar kertas dari pengaturan) |
| `/master/poli` | `master/PoliView` | master.kelola | `/polis` via `MasterCrud` |
| `/master/tindakan` | `master/TindakanView` | master.kelola | Katalog treatment (halaman khusus, bukan MasterCrud): `GET /tindakans` (filter kategori/status), `GET /tindakans/{id}` saat Ubah, `POST/PUT/DELETE /tindakans`, `GET /kategori-tindakans`, `GET /cabangs` (grid harga), `AsyncSelect` `/obats` (BHP). `?baru=1` membuka form |
| `/master/kategori-treatment` | `master/KategoriTindakanView` | master.kelola | `/kategori-tindakans` via `MasterCrud` |
| `/master/icd10` | `master/Icd10View` | master.kelola | `/icd10s` via `MasterCrud` |
| `/master/cabang` | `master/CabangView` | cabang.kelola | `/cabangs` via `MasterCrud` (+ `GET /me` setelah berubah, agar pemilih cabang ikut) |
| `/master/user` | `master/UserView` | pengguna.kelola | `/users` via `MasterCrud` (+ `GET /polis`, `/perans`, `/cabangs` untuk pilihan) |
| `/admin/peran` | `admin/PeranView` | peran.kelola | `GET /perans`, `GET /izins`, `POST/PUT/DELETE /perans` |
| `/admin/pengaturan` | `admin/PengaturanView` | pengaturan.kelola | `GET/PUT /pengaturan`, `GET /perans` |
| `/admin/audit` | `admin/AuditLogView` | audit.lihat | `GET /audit-logs` (filter; `?pasien_id=` dari PasienDetail), `GET /audit-logs/{id}` (modal rincian) |
| `*` | `NotFound` | — | — |

Modul (rail kiri) → halaman (tab di header): Beranda (Dashboard) · Pendaftaran (Data Pasien, Pendaftaran Kunjungan) · Pelayanan
(Antrian Poli) · Farmasi (Resep, Obat & Stok) · Keuangan (Kasir) · Master Data (Poli, Treatment, Kategori Treatment, ICD-10, Cabang) · Administrasi
(Pengguna, Peran & Izin, Pengaturan, Audit Log). Modul tanpa halaman yang diizinkan tidak tampil. Profil tidak ada di menu —
klik nama/avatar di header. Lihat [07-navigasi-modul.md](07-navigasi-modul.md).

## Perilaku penting per halaman

- **PemeriksaanView**
  - Tanpa izin `pemeriksaan.dokter` (perawat, terapis): hanya tanda vital + S (subjektif) yang bisa diedit; bagian diagnosa/tindakan/resep disembunyikan; payload hanya berisi field vital+SOAP.
  - Dengan `pemeriksaan.dokter`: payload menyertakan `diagnosas`, `tindakans`, `resep`, `catatan_resep` (replace-all di backend).
  - "Selesai pemeriksaan" = simpan dulu (silent) → `POST /selesai` → kembali ke `/antrian`. Wajib ≥1 diagnosa.
  - Mode baca bila status bukan `menunggu`/`diperiksa`. Subjektif otomatis diisi dari `keluhan` saat kosong.
  - Menampilkan alergi pasien (merah), IMT, estimasi biaya, lampiran & foto klinis kunjungan, riwayat kunjungan (dengan nama cabang).
- **AntrianView**: "Pasien saya saja" hanya untuk `user.tercatat_dokter`; tombol "Isi TTV" untuk pemegang `pemeriksaan.vital` tanpa `pemeriksaan.dokter`.
- **ResepDetail**: tombol serahkan nonaktif bila tagihan belum lunas atau stok kurang.
- **TagihanDetail**: metode default `penjamin` bila penjamin kunjungan bukan umum; tombol pecahan uang cepat; kembalian dihitung di UI tetapi nilai final dari backend.
- **ProfilView**: bila `auth.perlu2fa`, tampil peringatan dan semua halaman lain dialihkan ke sini sampai 2FA aktif. Kode pemulihan hanya ditampilkan sekali setelah aktivasi / pembuatan ulang.
- **PeranView**: peran sistem tidak bisa dihapus & kodenya dikunci; administrator (akses penuh) tidak punya daftar izin yang bisa diubah.
