# 03 — Halaman

Role pada tabel = `meta.roles` di router (admin selalu boleh).

| Path | View | Role | Endpoint utama |
|------|------|------|----------------|
| `/login` | `LoginView` | publik | `POST /login` |
| `/` | `DashboardView` | semua | `GET /dashboard` |
| `/pasien` | `pasien/PasienList` | pendaftaran, perawat, dokter | `GET /pasiens`, form via `PasienFormModal` (`POST/PUT /pasiens`) |
| `/pasien/:id` | `pasien/PasienDetail` | pendaftaran, perawat, dokter | `GET /pasiens/{id}` |
| `/pendaftaran` | `pendaftaran/PendaftaranView` | pendaftaran | `GET /polis?aktif=1`, `GET /dokters`, `GET /kunjungans`, `POST /kunjungans`, `POST /kunjungans/{id}/batal`. Query `?pasien_id=` memilih pasien otomatis. Cetak tiket antrian. |
| `/kunjungan/:id` | `KunjunganDetail` | semua | `GET /kunjungans/{id}` (resume medis read-only) |
| `/antrian` | `pemeriksaan/AntrianView` | perawat, dokter | `GET /kunjungans` (tab status, filter poli default = poli user), `POST .../panggil`. Auto-refresh 30 dtk. |
| `/pemeriksaan/:id` | `pemeriksaan/PemeriksaanView` | perawat, dokter | `GET /kunjungans/{id}`, `GET /pasiens/{id}/riwayat`, `PUT .../pemeriksaan`, `POST .../panggil`, `POST .../selesai`; pencarian `icd10s`, `tindakans`, `obats` via `AsyncSelect` |
| `/farmasi/resep` | `farmasi/ResepList` | apoteker | `GET /reseps` |
| `/farmasi/resep/:id` | `farmasi/ResepDetail` | apoteker | `GET /reseps/{id}`, `POST .../serahkan`; cetak etiket |
| `/farmasi/obat` | `farmasi/ObatList` | apoteker | `GET/POST/PUT/DELETE /obats`, `GET/POST /obats/{id}/mutasi` (modal mutasi & kartu stok) |
| `/kasir` | `kasir/TagihanList` | kasir | `GET /tagihans` |
| `/kasir/:id` | `kasir/TagihanDetail` | kasir | `GET /tagihans/{id}`, `POST .../bayar`; cetak struk |
| `/master/poli` | `master/PoliView` | admin | `/polis` via `MasterCrud` |
| `/master/tindakan` | `master/TindakanView` | admin | `/tindakans` via `MasterCrud` |
| `/master/icd10` | `master/Icd10View` | admin | `/icd10s` via `MasterCrud` |
| `/master/user` | `master/UserView` | admin | `/users` via `MasterCrud` (+ `GET /polis` untuk pilihan) |
| `*` | `NotFound` | — | — |

## Perilaku penting per halaman

- **PemeriksaanView**
  - Perawat: hanya tanda vital + S (subjektif) yang bisa diedit; bagian diagnosa/tindakan/resep disembunyikan; payload hanya berisi field vital+SOAP.
  - Dokter: payload menyertakan `diagnosas`, `tindakans`, `resep`, `catatan_resep` (replace-all di backend).
  - "Selesai pemeriksaan" = simpan dulu (silent) → `POST /selesai` → kembali ke `/antrian`. Wajib ≥1 diagnosa.
  - Mode baca bila status bukan `menunggu`/`diperiksa`. Subjektif otomatis diisi dari `keluhan` saat kosong.
  - Menampilkan alergi pasien (merah), IMT, estimasi biaya, riwayat kunjungan.
- **ResepDetail**: tombol serahkan nonaktif bila tagihan belum lunas atau stok kurang.
- **TagihanDetail**: metode default `penjamin` bila penjamin kunjungan bukan umum; tombol pecahan uang cepat; kembalian dihitung di UI tetapi nilai final dari backend.
