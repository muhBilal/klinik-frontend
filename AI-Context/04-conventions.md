# 04 — Konvensi & Jebakan

## Styling

- Tailwind CSS 4, konfigurasi di `src/style.css`:
  - `@theme` mendefinisikan warna `brand-50 … brand-900` (teal). Tambah shade baru di sini sebelum dipakai (mis. `border-brand-200`).
  - Class komponen di `@layer components`: `.card`, `.card-header`, `.card-title`, `.card-body`, `.btn`, `.btn-sm`,
    `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.label`, `.input`, `.input-error`, `.field-error`,
    `.table`, `.tab`, `.tab-active`.
- Tombol **selalu** dua class: `class="btn btn-primary"` (varian tidak menyertakan `.btn`).
- Angka uang/kuantitas di tabel: `text-right tabular-nums`, format dengan `rupiah()` / `angka()`.
- Layout responsif: sidebar tersembunyi < `lg`, tabel dibungkus `overflow-x-auto`.
- Elemen yang tidak boleh ikut dicetak diberi `print:hidden`, namun cetak utama memakai `printElement()`.

## Komponen reusable (`src/components`)

| Komponen | Props / Event | Catatan |
|----------|---------------|---------|
| `AppModal` | `v-model`, `title`, `size` (`max-w-lg`), slot default + `#footer` | Teleport ke body, Esc & klik backdrop menutup. Tombol submit di footer pakai `form="id-form"`. |
| `AsyncSelect` | `endpoint`, `params`, `placeholder`, `@select`, slot `#default="{ item }"` | Autocomplete ke endpoint index (`q`, `per_page=10`), navigasi keyboard, input dikosongkan setelah pilih. |
| `AppPagination` | `meta`, `@change(page)` | Memakai meta dari `useList`. |
| `StatusBadge` | `status` | Map warna/label untuk semua status kunjungan/resep/tagihan + `aktif`/`nonaktif`. Tambah status baru di sini. |
| `PageHeader` | `title`, `subtitle`, slot aksi | |
| `MasterCrud` | `title`, `endpoint`, `columns`, `fields`, `defaults`, `searchable`, `itemLabel`, slot `#cell-{key}` | CRUD generik untuk master. `fields[].type`: text/number/email/password/select/checkbox; `options`, `required`, `full`, `show(form)`. Password kosong saat edit = tidak diubah. |
| `PasienFormModal` | `v-model`, `pasien` (null = baru), `@saved(pasien)` | Dipakai di list pasien, detail, dan pendaftaran. |
| `RekamMedisRingkas` | `kunjungan` | Ringkasan vital, SOAP, diagnosa, tindakan, resep. |
| `ToastHost`, `AppIcon` | — / `path`, `size` | Ikon = path SVG heroicons outline. |

## Menambah halaman baru

1. Buat view di `src/views/<modul>/`.
2. Daftarkan route (lazy import) di `router/index.js` dengan `meta.roles` sesuai `role:` backend.
3. Tambah item menu di `lib/menu.js` (roles sama, ikon path SVG).
4. Gunakan `useList` untuk list, `api` + `errorMessage/validationErrors` untuk form.
5. `npm run build`.

## Jebakan yang sudah diketahui

| Masalah | Solusi |
|---------|--------|
| `@apply btn` pada class kustom gagal di Tailwind 4 | Jangan `@apply` class buatan sendiri; kombinasikan class di template. |
| Global browser (`window`, `setTimeout`) tidak bisa dipanggil di template Vue | Buat fungsi di `<script setup>`. |
| Tanggal `YYYY-MM-DD` diparse sebagai UTC | Pakai `tanggal()` dari `lib/format.js` (sudah menangani) dan `hariIni()` untuk default filter. |
| Kolom `stok` obat | Hanya berubah lewat endpoint mutasi/serahkan; form edit obat tidak mengirim stok. |
| Role check di UI | `hasRole('x')` bernilai true untuk admin — pakai `auth.user.role === 'x'` bila perilaku khusus role itu saja. |
| CORS error | Pastikan origin (mis. `http://localhost:5173`) ada di `FRONTEND_URL` backend. |
| Token di `localStorage` | Trade-off kesederhanaan vs risiko XSS. Jangan pernah render HTML dari data user (`v-html`). |
