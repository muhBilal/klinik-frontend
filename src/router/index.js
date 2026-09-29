import { createRouter, createWebHistory } from 'vue-router'
import { setNavigating } from '@/lib/progress'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import AppLayout from '@/layouts/AppLayout.vue'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },

      { path: 'pasien', name: 'pasien', component: () => import('@/views/pasien/PasienList.vue'), meta: { roles: ['pendaftaran', 'perawat', 'dokter'] } },
      { path: 'pasien/:id', name: 'pasien.detail', component: () => import('@/views/pasien/PasienDetail.vue'), meta: { roles: ['pendaftaran', 'perawat', 'dokter'] } },
      { path: 'pendaftaran', name: 'pendaftaran', component: () => import('@/views/pendaftaran/PendaftaranView.vue'), meta: { roles: ['pendaftaran'] } },
      { path: 'kunjungan/:id', name: 'kunjungan.detail', component: () => import('@/views/KunjunganDetail.vue') },

      { path: 'antrian', name: 'antrian', component: () => import('@/views/pemeriksaan/AntrianView.vue'), meta: { roles: ['perawat', 'dokter'] } },
      { path: 'pemeriksaan/:id', name: 'pemeriksaan', component: () => import('@/views/pemeriksaan/PemeriksaanView.vue'), meta: { roles: ['perawat', 'dokter'] } },

      { path: 'farmasi/resep', name: 'resep', component: () => import('@/views/farmasi/ResepList.vue'), meta: { roles: ['apoteker'] } },
      { path: 'farmasi/resep/:id', name: 'resep.detail', component: () => import('@/views/farmasi/ResepDetail.vue'), meta: { roles: ['apoteker'] } },
      { path: 'farmasi/obat', name: 'obat', component: () => import('@/views/farmasi/ObatList.vue'), meta: { roles: ['apoteker'] } },

      { path: 'kasir', name: 'kasir', component: () => import('@/views/kasir/TagihanList.vue'), meta: { roles: ['kasir'] } },
      { path: 'kasir/:id', name: 'kasir.detail', component: () => import('@/views/kasir/TagihanDetail.vue'), meta: { roles: ['kasir'] } },

      { path: 'master/poli', name: 'master.poli', component: () => import('@/views/master/PoliView.vue'), meta: { roles: ['admin'] } },
      { path: 'master/tindakan', name: 'master.tindakan', component: () => import('@/views/master/TindakanView.vue'), meta: { roles: ['admin'] } },
      { path: 'master/icd10', name: 'master.icd10', component: () => import('@/views/master/Icd10View.vue'), meta: { roles: ['admin'] } },
      { path: 'master/user', name: 'master.user', component: () => import('@/views/master/UserView.vue'), meta: { roles: ['admin'] } },

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

  const roles = to.matched.flatMap((r) => r.meta.roles ?? [])
  if (roles.length && !auth.hasRole(...roles)) {
    useToastStore().error('Anda tidak memiliki akses ke halaman tersebut.')
    return { name: 'dashboard' }
  }

  return true
})

export default router
