import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layout/AppShell.vue'),
      redirect: '/reimbursements',
      children: [
        {
          path: 'reimbursements',
          name: 'reimbursement-list',
          component: () => import('@/views/reimbursement/ReimbursementListView.vue'),
        },
        {
          path: 'reimbursements/new',
          name: 'reimbursement-create',
          component: () => import('@/views/reimbursement/ReimbursementFormView.vue'),
        },
        {
          path: 'reimbursements/:id',
          name: 'reimbursement-edit',
          component: () => import('@/views/reimbursement/ReimbursementFormView.vue'),
          props: true,
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && authStore.token) {
    return { name: 'reimbursement-list' }
  }
})

export default router
