import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  // ─── Auth ──────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { layout: 'auth', guest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/RegisterPage.vue'),
    meta: { layout: 'auth', guest: true },
  },

  // ─── Onboarding ────────────────────────────────────
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/onboarding/OnboardingPage.vue'),
    meta: { layout: 'auth', requiresAuth: true },
  },
  {
    path: '/onboarding/create-household',
    name: 'onboarding-create',
    component: () => import('@/views/onboarding/CreateHouseholdPage.vue'),
    meta: { layout: 'auth', requiresAuth: true },
  },
  {
    path: '/onboarding/join-household',
    name: 'onboarding-join',
    component: () => import('@/views/onboarding/JoinHouseholdPage.vue'),
    meta: { layout: 'auth', requiresAuth: true },
  },

  // ─── App (authenticated + household) ───────────────
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: () => import('@/views/recipes/RecipesListPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/recipes/new',
    name: 'recipes-new',
    component: () => import('@/views/recipes/AddRecipePage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/recipes/import',
    name: 'recipes-import',
    component: () => import('@/views/recipes/ImportRecipePage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/recipes/:recipeId',
    name: 'recipe-detail',
    component: () => import('@/views/recipes/RecipeDetailPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
    props: true,
  },
  {
    path: '/recipes/:recipeId/edit',
    name: 'recipe-edit',
    component: () => import('@/views/recipes/EditRecipePage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
    props: true,
  },
  {
    path: '/recipes/:recipeId/cook',
    name: 'recipe-cook',
    component: () => import('@/views/recipes/CookModePage.vue'),
    meta: { layout: 'fullscreen', requiresAuth: true, requiresHousehold: true },
    props: true,
  },
  {
    path: '/planner',
    name: 'planner',
    component: () => import('@/views/PlannerPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/weekly-report',
    name: 'weekly-report',
    component: () => import('@/views/WeeklyReportPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/shopping-list',
    name: 'shopping-list',
    component: () => import('@/views/ShoppingListPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/pantry',
    name: 'pantry',
    component: () => import('@/views/PantryPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/household',
    name: 'household',
    component: () => import('@/views/HouseholdPage.vue'),
    meta: { layout: 'app', requiresAuth: true, requiresHousehold: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsPage.vue'),
    meta: { layout: 'app', requiresAuth: true },
  },

  // ─── Catch-all ─────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundPage.vue'),
    meta: { layout: 'auth' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('session_token')
  const hasHousehold = localStorage.getItem('household_id')

  if (to.meta.requiresAuth && !token) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (to.meta.guest && token) {
    return next({ name: 'dashboard' })
  }

  if (to.meta.requiresHousehold && !hasHousehold) {
    return next({ name: 'onboarding' })
  }

  next()
})

export default router
