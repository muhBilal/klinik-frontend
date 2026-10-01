import { createRouter, createWebHistory } from 'vue-router'
import { setNavigating } from '@/lib/progress'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import AppLayout from '@/layouts/AppLayout.vue'

/**
 * `meta.izin` = halaman boleh dibuka bila user punya SALAH SATU izin (samakan dengan middleware `izin:` backend
 * dan `izin` item di lib/menu.js). Tanpa `meta.izin` = semua user login.
 */
const PEMERIKSAAN = ['pemeriksaan.panggil', 'pemeriksaan.vital', 'pemeriksaan.dokter']

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'komisi-saya', name: 'komisi-saya', component: () => import('@/views/KomisiSayaView.vue'), meta: { izin: ['pemeriksaan.dokter', 'pemeriksaan.vital', 'rme.tindakan'] } },
      { path: 'profil', name: 'profil', component: () => import('@/views/ProfilView.vue') },

      { path: 'pasien', name: 'pasien', component: () => import('@/views/pasien/PasienList.vue'), meta: { izin: ['pasien.lihat'] } },
      { path: 'pasien/:id', name: 'pasien.detail', component: () => import('@/views/pasien/PasienDetail.vue'), meta: { izin: ['pasien.lihat'] } },
      { path: 'pendaftaran', name: 'pendaftaran', component: () => import('@/views/pendaftaran/PendaftaranView.vue'), meta: { izin: ['kunjungan.daftar'] } },
      { path: 'kunjungan/:id', name: 'kunjungan.detail', component: () => import('@/views/KunjunganDetail.vue') },

      { path: 'booking', redirect: '/booking/kalender' },
      { path: 'booking/kalender', name: 'booking', component: () => import('@/views/booking/BookingView.vue'), meta: { izin: ['booking.lihat'] } },
      { path: 'booking/jadwal', name: 'booking.jadwal', component: () => import('@/views/booking/JadwalView.vue'), meta: { izin: ['booking.lihat', 'jadwal.kelola'] } },
      { path: 'antrian', name: 'antrian', component: () => import('@/views/pemeriksaan/AntrianView.vue'), meta: { izin: PEMERIKSAAN } },
      { path: 'pemeriksaan/:id', name: 'pemeriksaan', component: () => import('@/views/pemeriksaan/PemeriksaanView.vue'), meta: { izin: ['pemeriksaan.vital', 'pemeriksaan.dokter'] } },

      { path: 'farmasi/resep', name: 'resep', component: () => import('@/views/farmasi/ResepList.vue'), meta: { izin: ['farmasi.resep'] } },
      { path: 'farmasi/resep/:id', name: 'resep.detail', component: () => import('@/views/farmasi/ResepDetail.vue'), meta: { izin: ['farmasi.resep'] } },
      { path: 'farmasi/stok', name: 'stok-batch', component: () => import('@/views/farmasi/StokBatchView.vue'), meta: { izin: ['inventori.kelola'] } },
      { path: 'farmasi/obat', name: 'obat', component: () => import('@/views/farmasi/ObatList.vue'), meta: { izin: ['farmasi.obat'] } },

      { path: 'kasir', name: 'kasir', component: () => import('@/views/kasir/TagihanList.vue'), meta: { izin: ['kasir.tagihan'] } },
      { path: 'kasir/:id', name: 'kasir.detail', component: () => import('@/views/kasir/TagihanDetail.vue'), meta: { izin: ['kasir.tagihan'] } },
      { path: 'shift-kas', name: 'shift-kas', component: () => import('@/views/kasir/ShiftKasView.vue'), meta: { izin: ['kasir.shift'] } },
      { path: 'laporan', name: 'laporan', component: () => import('@/views/kasir/LaporanView.vue'), meta: { izin: ['laporan.keuangan'] } },
      { path: 'keuangan/komisi', name: 'komisi', component: () => import('@/views/kasir/KomisiView.vue'), meta: { izin: ['komisi.kelola', 'laporan.keuangan'] } },
      { path: 'promo', name: 'promo', component: () => import('@/views/kasir/PromoView.vue'), meta: { izin: ['promo.kelola'] } },

      { path: 'master/poli', name: 'master.poli', component: () => import('@/views/master/PoliView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/tindakan', name: 'master.tindakan', component: () => import('@/views/master/TindakanView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/paket', name: 'master.paket', component: () => import('@/views/master/PaketView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/kategori-treatment', name: 'master.kategori-treatment', component: () => import('@/views/master/KategoriTindakanView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/icd10', name: 'master.icd10', component: () => import('@/views/master/Icd10View.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/icd9cm', name: 'master.icd9cm', component: () => import('@/views/master/Icd9cmView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/template-soap', name: 'master.template-soap', component: () => import('@/views/master/TemplateSoapView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/protokol-foto', name: 'master.protokol-foto', component: () => import('@/views/master/ProtokolFotoView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/template-consent', name: 'master.template-consent', component: () => import('@/views/master/TemplateConsentView.vue'), meta: { izin: ['master.kelola'] } },
      { path: 'master/ruang-alat', name: 'master.ruang-alat', component: () => import('@/views/booking/SumberDayaView.vue'), meta: { izin: ['jadwal.kelola'] } },
      { path: 'master/cabang', name: 'master.cabang', component: () => import('@/views/master/CabangView.vue'), meta: { izin: ['cabang.kelola'] } },
      { path: 'master/user', name: 'master.user', component: () => import('@/views/master/UserView.vue'), meta: { izin: ['pengguna.kelola'] } },

      { path: 'admin/peran', name: 'admin.peran', component: () => import('@/views/admin/PeranView.vue'), meta: { izin: ['peran.kelola'] } },
      { path: 'admin/pengaturan', name: 'admin.pengaturan', component: () => import('@/views/admin/PengaturanView.vue'), meta: { izin: ['pengaturan.kelola'] } },
      { path: 'admin/integrasi', name: 'admin.integrasi', component: () => import('@/views/admin/IntegrasiView.vue'), meta: { izin: ['integrasi.kelola'] } },
      { path: 'admin/audit', name: 'admin.audit', component: () => import('@/views/admin/AuditLogView.vue'), meta: { izin: ['audit.lihat'] } },

      { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFound.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// Progress bar selama navigasi (guard + download chunk halaman lazy)
router.beforeEach(() => setNavigating(true))
router.afterEach(() => setNavigating(false))
router.onError(() => setNavigating(false))

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.guest) {
    return auth.isLoggedIn ? { name: 'dashboard' } : true
  }

  if (!auth.isLoggedIn) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }

  if (!auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      auth.clear()
      return { name: 'login' }
    }
  }

  // Peran wajib 2FA: aktifkan dulu di profil sebelum membuka halaman lain
  if (auth.perlu2fa && to.name !== 'profil') {
    return { name: 'profil' }
  }

  const izin = to.matched.flatMap((r) => r.meta.izin ?? [])
  if (izin.length && !auth.can(...izin)) {
    useToastStore().error('Anda tidak memiliki akses ke halaman tersebut.')
    return { name: 'dashboard' }
  }

  return true
})

export default router
