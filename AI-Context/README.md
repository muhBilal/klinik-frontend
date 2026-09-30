# AI-Context — Frontend E-Klinik

Konteks untuk AI assistant (dan developer baru) yang akan bekerja di `frontend/`.

| File | Isi |
|------|-----|
| [01-overview.md](01-overview.md) | Stack, cara menjalankan, environment |
| [02-architecture.md](02-architecture.md) | Struktur folder, routing & guard role, state, HTTP client |
| [03-pages.md](03-pages.md) | Daftar halaman, role yang boleh, endpoint yang dipakai |
| [04-conventions.md](04-conventions.md) | Styling Tailwind, pola komponen, cara menambah halaman, jebakan |
| [05-api-contract.md](05-api-contract.md) | Bentuk data dari backend yang diandalkan UI |
| [06-fitur-fase-0.md](06-fitur-fase-0.md) | UI fitur Fase 0 per fitur: izin, cabang, audit, 2FA & sesi, berkas, pengaturan |
| [07-navigasi-modul.md](07-navigasi-modul.md) | Navigasi: rail modul (kiri) + tab halaman modul terpilih di header |

Kebutuhan produk (PRD) & progres ada di repo backend: `backend/AI-Context/PRD — ...md` dan `backend/AI-Context/07-roadmap-progress.md`.
Dokumen per fitur (backend + frontend): `backend/AI-Context/modul/`.

## Ringkasan 30 detik

- **Vue 3 SPA** (Composition API, `<script setup>`, JavaScript — bukan TypeScript) dengan Vite 8, Vue Router 5, Pinia 4, Tailwind CSS 4, Axios.
- Berkomunikasi dengan backend Laravel terpisah (repo `klinik-backend`) lewat REST API + token Bearer.
- Menu & halaman dibatasi per **izin** (`auth.can('pasien.kelola')`, `meta.izin`, `izin` di menu) — bukan kode peran. Administrator
  memegang semua izin. Backend tetap sumber kebenaran hak akses.
- User lintas cabang memilih **cabang aktif** di header (dikirim sebagai header `X-Cabang-Id`); staf cabang terkunci ke cabangnya.
- Nama klinik, kop struk, lebar kertas dari `GET /info` (`useKlinikStore`) — jangan menulis "E-Klinik" di template.
- Bahasa UI: **Bahasa Indonesia**.

## Aturan emas

1. Setiap aturan bisnis ditegakkan di backend; frontend hanya membantu UX (disable tombol, pesan). Jangan pindahkan validasi penting ke frontend saja.
1. Cek akses dengan `auth.can(...)`; jangan membandingkan `auth.user.role` (peran bisa dibuat admin).
2. Semua request HTTP lewat `src/lib/api.js` (bukan `fetch`/axios baru).
3. Tampilkan error dengan `useToastStore().error(errorMessage(e))` dan error field dengan `validationErrors(e)`.
4. Jalankan `npm run build` untuk memastikan tidak ada error kompilasi sebelum selesai.
