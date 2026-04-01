<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const route = useRoute()
const { user, isAuthenticated, logout, checkSession } = useAuth()

const navItems = [
  { path: '/home', label: 'Home', icon: '🏠' },
  { path: '/catalog', label: 'Catalog', icon: '💎' },
  { path: '/wishlist', label: 'Wishlist', icon: '⭐' },
  { path: '/sellers', label: 'Sources', icon: '🏪' },
  { path: '/feed', label: 'Feed', icon: '📸' },
]

const ADMIN_EMAIL = 'jacksonkyarger@gmail.com'
const isAdmin = computed(() => user.value?.email === ADMIN_EMAIL)

const utilityItems = computed(() => {
  const items = [
    { path: 'https://database.charmventory.com', label: 'Database', icon: '📚' },
  ]
  if (isAdmin.value) {
    items.push({ path: '/admin', label: 'Admin', icon: '⚙️' })
  }
  return items
})

const isActive = (path: string) => {
  if (path === '/home') return route.path === '/home'
  return route.path.startsWith(path)
}

// Generate URL-friendly slug from name
const userSlug = computed(() => {
  if (!user.value?.name) return user.value?.id || ''
  return user.value.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || user.value.id
})

// Dark mode toggle
const isDark = ref(false)

onMounted(async () => {
  // Check for saved preference or system preference
  const saved = localStorage.getItem('theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  updateTheme()

  // Check auth session
  await checkSession()
})

const toggleDark = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  updateTheme()
}

const updateTheme = () => {
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const handleLogout = async () => {
  await logout()
}
</script>

<template>
  <div class="min-h-screen pb-24 lg:pb-0 lg:pl-64">
    <!-- Desktop Sidebar -->
    <aside class="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:flex-col bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border">
      <!-- Logo -->
      <div class="p-6 border-b border-light-border dark:border-dark-border">
        <img src="/logo.png" alt="Charmventory" class="h-12 w-auto dark:bg-white/90 dark:rounded dark:p-1" />
      </div>

      <!-- Nav Items -->
      <nav class="flex-1 p-4 space-y-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200"
          :class="isActive(item.path)
            ? 'bg-rose-pale dark:bg-rose-glow text-rose-primary'
            : 'text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated'"
        >
          <span class="text-xl">{{ item.icon }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </NuxtLink>

        <!-- Divider -->
        <div class="border-t border-light-border dark:border-dark-border my-4"></div>

        <!-- Utility Items -->
        <template v-for="item in utilityItems" :key="item.path">
          <a
            v-if="item.path.startsWith('http')"
            :href="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated"
          >
            <span class="text-xl">{{ item.icon }}</span>
            <span class="font-medium">{{ item.label }}</span>
          </a>
          <NuxtLink
            v-else
            :to="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200"
            :class="isActive(item.path)
              ? 'bg-rose-pale dark:bg-rose-glow text-rose-primary'
              : 'text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated'"
          >
            <span class="text-xl">{{ item.icon }}</span>
            <span class="font-medium">{{ item.label }}</span>
          </NuxtLink>
        </template>
      </nav>

      <!-- User Section -->
      <div class="p-4 border-t border-light-border dark:border-dark-border space-y-2">
        <!-- Theme Toggle -->
        <button
          @click="toggleDark"
          class="w-full flex items-center justify-between px-4 py-3 rounded-lg text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
        >
          <span class="font-medium">{{ isDark ? 'Dark Mode' : 'Light Mode' }}</span>
          <span class="text-xl">{{ isDark ? '🌙' : '☀️' }}</span>
        </button>

        <!-- Auth Section -->
        <ClientOnly>
          <template v-if="isAuthenticated">
            <NuxtLink
              :to="`/profile/${userSlug}`"
              class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-rose-pale dark:bg-rose-glow flex items-center justify-center text-rose-primary font-medium">
                {{ user?.name?.charAt(0) || user?.email?.charAt(0) || '?' }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-ink dark:text-pearl truncate">
                  {{ user?.name || 'User' }}
                </p>
                <p class="text-xs text-muted dark:text-ash">View Profile</p>
              </div>
            </NuxtLink>
            <NuxtLink
              to="/settings/profile"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
            >
              <span class="text-xl">⚙️</span>
              <span class="font-medium">Settings</span>
            </NuxtLink>
            <button
              @click="handleLogout"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
            >
              <span class="text-xl">🚪</span>
              <span class="font-medium">Sign Out</span>
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/auth/login"
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted dark:text-ash hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
            >
              <span class="text-xl">→</span>
              <span class="font-medium">Sign In</span>
            </NuxtLink>
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- Mobile Header -->
    <header class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-lg border-b border-light-border dark:border-dark-border">
      <div class="flex items-center justify-between px-4 py-3">
        <img src="/logo.png" alt="Charmventory" class="h-8 w-auto dark:bg-white/90 dark:rounded dark:p-1" />
        <div class="flex items-center gap-2">
          <button
            @click="toggleDark"
            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
          >
            {{ isDark ? '🌙' : '☀️' }}
          </button>
          <ClientOnly>
            <template v-if="isAuthenticated">
              <NuxtLink :to="`/profile/${userSlug}`" class="w-8 h-8 rounded-full bg-rose-pale dark:bg-rose-glow flex items-center justify-center text-rose-primary font-medium text-sm">
                {{ user?.name?.charAt(0) || user?.email?.charAt(0) || '?' }}
              </NuxtLink>
            </template>
            <template v-else>
              <NuxtLink
                to="/auth/login"
                class="text-sm text-rose-primary font-medium"
              >
                Sign In
              </NuxtLink>
            </template>
          </ClientOnly>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="pt-16 lg:pt-0">
      <slot />
    </main>

    <!-- Mobile Bottom Navigation -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-light-card/95 dark:bg-dark-card/95 backdrop-blur-lg border-t border-light-border dark:border-dark-border safe-area-pb">
      <div class="nav-bar border-0 shadow-none rounded-none bg-transparent">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
