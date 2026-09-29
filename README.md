# E-Klinik — Frontend

Antarmuka sistem informasi klinik: Vue 3 SPA dengan Vite, Vue Router, Pinia, Tailwind CSS 4, dan Axios.
Membutuhkan backend REST API dari repo [klinik-backend](https://github.com/muhBilal/klinik-backend).

## Menjalankan

Prasyarat: Node.js 20.19+ / 22.12+, backend berjalan di `http://localhost:8000`.

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev               # http://localhost:5173
```

Build produksi: `npm run build` → folder `dist/` (static; web server perlu fallback ke `index.html`).

### Akun demo (password `password`)

`admin@`, `pendaftaran@`, `perawat@`, `dokter@`, `apoteker@`, `kasir@` + `eklinik.test` — tersedia tombol pengisi otomatis di halaman login.

## Halaman

Dashboard · Data pasien · Pendaftaran kunjungan & tiket antrian · Antrian poli · Pemeriksaan (SOAP, ICD-10, tindakan, resep)
· Farmasi (resep, obat & kartu stok) · Kasir (tagihan & struk) · Master (poli, tindakan, ICD-10, pengguna).
Menu otomatis menyesuaikan role pengguna.

## Dokumentasi

Struktur kode, routing & role, komponen, dan kontrak API ada di [`AI-Context/`](AI-Context/README.md).
