# 03 — Halaman

Kolom **Izin** = `meta.izin` di router (salah satu; administrator memegang semua izin). Kosong = semua user login.

| Path | View | Izin | Endpoint utama |
|------|------|------|----------------|
| `/login` | `LoginView` | publik | `GET /info`, `POST /login`, `POST /login/2fa` (langkah kode 2FA) |
| `/` | `DashboardView` | — | `GET /dashboard` (cabang aktif) |
| `/profil` | `ProfilView` | — | `GET /me`, `PUT /me/password`, `POST /me/2fa`, `POST /me/2fa/konfirmasi`, `POST /me/2fa/kode-pemulihan`, `DELETE /me/2fa` |
| `/pasien` | `pasien/PasienList` | pasien.lihat | `GET /pasiens` (+ filter `persetujuan`, chip "Belum persetujuan data"/"Opt-in promosi"), form via `PasienFormModal` (`POST/PUT /pasiens`, tombol: pasien.kelola; tanpa alergi) |
| `/pasien/:id` | `pasien/PasienDetail` | pasien.lihat | `GET /pasiens/{id}` (riwayat semua cabang; kolom diagnosa & lampiran bila rme.lihat), tombol Jejak Akses (audit.lihat). Kartu Paket Treatment (`/pasiens/{id}/pakets`, jual: kasir.tagihan, perpanjang/alihkan/refund sisa: kasir.void). Odontogram (+ status per kunjungan) & rencana perawatan gigi bila rme.lihat dan `data_gigi` / pernah ke poli gigi. Kartu Data Klinis (`/pasiens/{id}/klinis`, rme.lihat) & Persetujuan Data Pribadi (`/pasiens/{id}/persetujuan-data*`, `/persetujuan-datas/*`) |
| `/pendaftaran` | `pendaftaran/PendaftaranView` | kunjungan.daftar | `GET /polis?aktif=1`, `GET /dokters`, `GET /kunjungans`, `POST /kunjungans`, `POST /kunjungans/{id}/batal`. Query `?pasien_id=` memilih pasien otomatis. Status & tanda tangan persetujuan UU PDP di kartu pasien (`PersetujuanDataPanel ringkas`); 422 `persetujuan_data` bila diwajibkan. Cetak tiket antrian (nama klinik & cabang). |
| `/kunjungan/:id` | `KunjunganDetail` | — | `GET /kunjungans/{id}` (lintas cabang, read-only). Rekam medis & lampiran hanya bila rme.lihat (dan bukan `rme_disembunyikan`); `GET .../verifikasi` (tombol Cek keutuhan), `POST .../addendum` (pemeriksaan.dokter, cabang aktif). Odontogram pada kunjungan itu (baca) untuk poli gigi / kunjungan berdata gigi |
| `/antrian` | `pemeriksaan/AntrianView` | pemeriksaan.panggil, .vital, .dokter | `GET /kunjungans` (tab status, filter poli default = poli user), `POST .../panggil`. Auto-refresh 30 dtk. |
| `/pemeriksaan/:id` | `pemeriksaan/PemeriksaanView` | pemeriksaan.vital, .dokter | `GET /kunjungans/{id}` (+ `pasien.klinis`/`alergis` → peringatan klinis; `PUT /pasiens/{id}/klinis` lewat tombol "Data klinis"), `GET /pasiens/{id}/riwayat`, `PUT .../pemeriksaan`, `POST .../panggil`, `POST .../selesai`, `POST .../addendum`; `AsyncSelect` ke `icd10s`, `icd9cms`, `tindakans` (`aktif=1&cabang_id=` cabang kunjungan, tampil `tarif_cabang`), `obats`; `GET /icd10s?favorit=1`, `/kode-favorits`, `/petugas`, `/template-soaps`; modal catatan tindakan (`/kunjungan-tindakans/{id}/catatan`, `/bhps`, `/stok-batches`, `/sumber-dayas`), consent (`/informed-consents*`, `/template-consents`); `LampiranBerkas` (`/berkas`); poli gigi: odontogram (`/pasiens/{id}/odontogram`, `/kunjungans/{id}/odontogram*`, `/odontogram/referensi`) & rencana perawatan (`/pasiens/{id}/rencana-perawatans`, `/rencana-perawatans/*`) |
| `/farmasi/resep` | `farmasi/ResepList` | farmasi.resep | `GET /reseps` |
| `/farmasi/resep/:id` | `farmasi/ResepDetail` | farmasi.resep | `GET /reseps/{id}`, `POST .../serahkan`; cetak etiket (nama klinik & cabang) |
| `/farmasi/obat` | `farmasi/ObatList` | farmasi.obat | `GET/POST/PUT /obats`, `DELETE` (master.kelola), `GET/POST /obats/{id}/mutasi` |
| `/kasir` | `kasir/TagihanList` | kasir.tagihan | `GET /tagihans` (tagihan dengan/tanpa kunjungan); "+ Jual paket" (`JualPaketModal`: `/pasiens`, `/pakets?aktif=1`, `POST /pasiens/{id}/pakets`) |
| `/kasir/:id` | `kasir/TagihanDetail` | kasir.tagihan | `GET /tagihans/{id}`, `POST/DELETE .../promo` (kode voucher), `POST .../bayar`; tagihan mandiri (paket/produk) tanpa kunjungan; pajak & potongan promo di layar; cetak struk (kop klinik/cabang, catatan kaki & lebar kertas dari pengaturan) |
| `/laporan/penjualan` | `laporan/LaporanPenjualanView` | laporan.keuangan | `GET /laporan/penjualan?mulai&selesai` (ringkasan, per hari, treatment, dokter, metode, cabang, kategori); Cetak |
| `/laporan/paket` | `laporan/LaporanPaketView` | laporan.keuangan | `GET /laporan/paket?mulai&selesai` (ringkasan, per paket, segera kedaluwarsa → `/pasien/:id`); Cetak |
| `/komisi` | `komisi/KomisiPeriodeView` | komisi.kelola, komisi.setujui | `GET/POST /komisi-periodes` (cabang aktif); tombol "Komisi per treatment" → `/master/tindakan` (komisi.kelola + master.kelola) |
| `/komisi/:id` | `komisi/KomisiPeriodeDetail` | komisi.kelola, komisi.setujui | `GET /komisi-periodes/{id}`, `POST .../hitung`, `.../setujui` (komisi.setujui), `.../penyesuaian`, `DELETE` (draf), `/petugas`; slip cetak |
| `/slip-komisi` | `komisi/KomisiSayaView` | — (menu: pemeriksaan.*, rme.tindakan) | `GET /komisi-saya`, `?periode_id=` |
| `/promo` | `kasir/PromoView` | promo.kelola | `GET/POST/PUT/DELETE /promos`, `/cabangs`, `/pakets?aktif=1`, `AsyncSelect` `/tindakans` |
| `/master/poli` | `master/PoliView` | master.kelola | `/polis` via `MasterCrud` (+ spesialisasi: `gigi` menampilkan odontogram; jasa konsultasi = pilihan treatment dari `GET /tindakans?q=konsultasi` + kategori "…konsultasi…") |
| `/master/tindakan` | `master/TindakanView` | master.kelola | Katalog treatment (halaman khusus, bukan MasterCrud): `GET /tindakans` (filter kategori/status), `GET /tindakans/{id}` saat Ubah, `POST/PUT/DELETE /tindakans`, `GET /kategori-tindakans`, `GET /cabangs` (grid harga), `AsyncSelect` `/obats` (BHP). `?baru=1` membuka form. Pemegang komisi.kelola: `?komisi=1` (kolom Komisi) & bagian "Komisi & jasa medis" (`komisis`) |
| `/master/paket` | `master/PaketView` | master.kelola | `GET/POST/PUT/DELETE /pakets` (isi treatment × sesi, harga, masa berlaku, lintas cabang; hemat % dari `nilai_normal`) |
| `/master/kategori-treatment` | `master/KategoriTindakanView` | master.kelola | `/kategori-tindakans` via `MasterCrud` |
| `/master/icd10` | `master/Icd10View` | master.kelola | `/icd10s` via `MasterCrud` (+ penanda sensitif) |
| `/master/icd9cm` | `master/Icd9cmView` | master.kelola | `/icd9cms` via `MasterCrud` |
| `/master/template-soap` | `master/TemplateSoapView` | master.kelola | `GET/POST/PUT/DELETE /template-soaps` (halaman khusus: S/O/A/P, saran diagnosa, poli, treatment, akses terbatas) |
| `/master/protokol-foto` | `master/ProtokolFotoView` | master.kelola | `GET/POST/PUT/DELETE /protokol-fotos` (posisi berurutan) |
| `/master/template-consent` | `master/TemplateConsentView` | master.kelola | `/template-consents` via `MasterCrud` (field `textarea`) |
| `/master/cabang` | `master/CabangView` | cabang.kelola | `/cabangs` via `MasterCrud` (+ `GET /me` setelah berubah, agar pemilih cabang ikut) |
| `/master/user` | `master/UserView` | pengguna.kelola | `/users` via `MasterCrud` (+ `GET /polis`, `/perans`, `/cabangs` untuk pilihan) |
| `/admin/peran` | `admin/PeranView` | peran.kelola | `GET /perans`, `GET /izins`, `POST/PUT/DELETE /perans` |
| `/admin/pengaturan` | `admin/PengaturanView` | pengaturan.kelola | `GET/PUT /pengaturan`, `GET /perans` |
| `/admin/audit` | `admin/AuditLogView` | audit.lihat | `GET /audit-logs` (filter; `?pasien_id=` dari PasienDetail), `GET /audit-logs/{id}` (modal rincian) |
| `*` | `NotFound` | — | — |

Modul (rail kiri) → halaman (tab di header): Beranda (Dashboard) · Pendaftaran (Data Pasien, Pendaftaran Kunjungan) · Pelayanan
(Antrian Poli) · Farmasi (Resep, Obat & Stok) · Keuangan (Kasir) · Master Data (Poli, Treatment, Kategori Treatment, Cabang) · Rekam Medis
(ICD-10, ICD-9-CM, Template SOAP, Protokol Foto, Template Consent) · Administrasi
(Pengguna, Peran & Izin, Pengaturan, Audit Log). Modul tanpa halaman yang diizinkan tidak tampil. Profil tidak ada di menu —
klik nama/avatar di header. Lihat [07-navigasi-modul.md](07-navigasi-modul.md).

## Perilaku penting per halaman

- **PemeriksaanView**
  - Tanpa izin `pemeriksaan.dokter` (perawat, terapis): tanda vital + S (bila `pemeriksaan.vital`); diagnosa/resep disembunyikan. Pemegang `rme.tindakan` menambah tindakan & memakai sesi paket serta memesan paket; baris yang dicatat petugas lain terkunci (kecuali pilihan paket); ICD-9-CM & tutup tetap dokter. Isi RME tidak dimuat (`rme_disembunyikan` / tanpa `rme.lihat`) → hanya tanda vital & anamnesis.
  - Payload hanya berisi yang **berubah** sejak form dimuat (tanda vital/SOAP per kolom; `tindakans` + `tindakan_ids_awal` bila daftar berubah). "Selesai & tanda tangani" berhenti bila petugas lain mengubah daftar tindakan sejak form dimuat.
  - Paket (F1-08 revisi): tombol **Pesan paket** + daftar pesanan (Batalkan — pemakaian sesinya dilepas & disimpan dulu), estimasi memuat harga pesanan, sesi pertama otomatis dipakai (baris tersimpan langsung disimpan).
  - RME estetika (F1-05): template SOAP, favorit, akses terbatas, ICD-9-CM & petugas per tindakan, face chart / parameter alat, informed consent + tanda tangan, "Selesai & tanda tangani", addendum — lihat [08-fitur-fase-1.md](08-fitur-fase-1.md) bagian F1-05.
  - Dengan `pemeriksaan.dokter`: payload menyertakan `diagnosas`, `resep`, `catatan_resep` (replace-all di backend) dan `tindakans` bila berubah.
  - "Selesai & tanda tangani" = simpan dulu (silent) → `POST /selesai` → kembali ke `/antrian`. Wajib ≥1 diagnosa, SIP aktif, consent wajib lengkap.
  - Mode baca bila status bukan `menunggu`/`diperiksa`. Subjektif otomatis diisi dari `keluhan` saat kosong.
  - Menampilkan peringatan klinis pasien (alergi, hamil/menyusui, Fitzpatrick, riwayat — F1-10), IMT, estimasi biaya, lampiran & foto klinis kunjungan, riwayat kunjungan (dengan nama cabang).
  - Poli gigi (F1-07): kartu Odontogram & Rencana Perawatan Gigi di bawah SOAP, input gigi + permukaan per tindakan — lihat
    [08-fitur-fase-1.md](08-fitur-fase-1.md) bagian F1-07.
  - Paket (F1-08): pilihan "Pakai paket" per tindakan (otomatis bila pasien punya sisa sesi treatment itu) → Rp 0; kartu Paket
    Treatment ringkas di kolom kanan.
- **AntrianView**: "Pasien saya saja" hanya untuk `user.tercatat_dokter`; tombol "Isi TTV" untuk pemegang `pemeriksaan.vital` tanpa `pemeriksaan.dokter`.
- **ResepDetail**: tombol serahkan nonaktif bila tagihan belum lunas atau stok kurang.
- **TagihanDetail**: metode default `penjamin` bila penjamin kunjungan bukan umum; tombol pecahan uang cepat; kembalian dihitung di UI tetapi nilai final dari backend.
- **ProfilView**: bila `auth.perlu2fa`, tampil peringatan dan semua halaman lain dialihkan ke sini sampai 2FA aktif. Kode pemulihan hanya ditampilkan sekali setelah aktivasi / pembuatan ulang.
- **PeranView**: peran sistem tidak bisa dihapus & kodenya dikunci; administrator (akses penuh) tidak punya daftar izin yang bisa diubah.
