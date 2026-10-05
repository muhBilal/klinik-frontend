# Vertiqo — Frontend

Antarmuka sistem informasi klinik: Vue 3 SPA dengan Vite, Vue Router, Pinia, Tailwind CSS 4, dan Axios.
Membutuhkan backend REST API dari repo [klinik-backend](https://github.com/muhBilal/klinik-backend).

## Menjalankan dengan Docker (backend + frontend, 1 perintah)

File Docker ada di repo backend. Clone kedua repo sejajar:

```bash
git clone https://github.com/muhBilal/klinik-backend.git backend
git clone https://github.com/muhBilal/klinik-frontend.git frontend
cd backend && cp .env.example .env   # isi APP_KEY, lihat README backend
docker compose up -d --build         # http://localhost:8000
```

## Menjalankan untuk development (hot reload)

Prasyarat: Node.js 20.19+ / 22.12+, backend berjalan di `http://localhost:8000`
(`docker compose -f docker-compose.dev.yml up -d` di repo backend).

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev               # http://localhost:5173
```

Build produksi: `npm run build` → folder `dist/` (static; web server perlu fallback ke `index.html`).

### Akun demo (password `password`)

`admin@`, `pendaftaran@`, `perawat@`, `dokter@`, `apoteker@`, `kasir@`, `terapis@`, `manajer@` + `eklinik.test` — tersedia tombol pengisi otomatis di halaman login.

## Halaman

Dashboard · Data pasien · Pendaftaran kunjungan & tiket antrian · Antrian poli · Pemeriksaan (SOAP, ICD-10, tindakan, resep)
· Lampiran klinis terenkripsi · Farmasi (resep, obat & kartu stok) · Kasir (tagihan & struk) · Master (poli, tindakan, ICD-10, cabang, pengguna)
· Administrasi (peran & izin, pengaturan klinik, audit log) · Profil (ganti password, 2FA).
Menu otomatis menyesuaikan izin pengguna; user lintas cabang memilih cabang aktif di header.

## Dokumentasi

Struktur kode, routing & izin, komponen, dan kontrak API ada di [`AI-Context/`](AI-Context/README.md).
