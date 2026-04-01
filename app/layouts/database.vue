<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { user } = useAuth()
const ADMIN_EMAIL = 'jacksonkyarger@gmail.com'
const isAdmin = computed(() => user.value?.email === ADMIN_EMAIL)

// Dark mode toggle
const isDark = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved) {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  updateTheme()
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

const baseNavItems = [
  { path: '/database', label: 'Browse', icon: '🔍' },
  { path: '/database/catalogs', label: 'Catalogs', icon: '📖' },
  { path: '/database/contribute', label: 'Contribute', icon: '➕' },
]

const navItems = computed(() => {
  if (isAdmin.value) {
    return [...baseNavItems, { path: '/database/admin', label: 'Admin', icon: '⚙️' }]
  }
  return baseNavItems
})

const route = useRoute()
const isActive = (path: string) => {
  if (path === '/database') return route.path === '/database'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="min-h-screen bg-light-bg dark:bg-dark-bg">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-light-card/95 dark:bg-dark-card/95 backdrop-blur-lg border-b border-light-border dark:border-dark-border">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/database" class="flex items-center gap-3">
          <span class="text-2xl">📚</span>
          <div>
            <h1 class="font-display text-xl text-ink dark:text-pearl leading-tight">Pandora Database</h1>
            <p class="text-xs text-muted dark:text-ash">Open Community Archive</p>
          </div>
        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
            :class="isActive(item.path)
              ? 'bg-rose-pale dark:bg-rose-glow text-rose-primary'
              : 'text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <!-- Right side -->
        <div class="flex items-center gap-3">
          <button
            @click="toggleDark"
            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-light-bg-alt dark:hover:bg-dark-elevated transition-colors"
          >
            {{ isDark ? '🌙' : '☀️' }}
          </button>
          <a
            href="https://app.charmventory.com"
            class="text-sm text-rose-primary hover:underline hidden sm:block"
          >
            Charmventory App →
          </a>
        </div>
      </div>

      <!-- Mobile Nav -->
      <nav class="md:hidden flex overflow-x-auto gap-1 px-4 pb-3">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          :class="isActive(item.path)
            ? 'bg-rose-pale dark:bg-rose-glow text-rose-primary'
            : 'text-muted dark:text-ash'"
        >
          <span class="mr-1">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="pb-8">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-light-card dark:bg-dark-card border-t border-light-border dark:border-dark-border px-4 py-8">
      <div class="max-w-7xl mx-auto">
        <div class="grid md:grid-cols-3 gap-8 mb-8">
          <!-- About -->
          <div>
            <h3 class="font-display text-lg text-ink dark:text-pearl mb-3">About</h3>
            <p class="text-sm text-muted dark:text-ash">
              A free, open-source database of Pandora jewelry. Crowdsourced by collectors, for collectors.
            </p>
          </div>

          <!-- Data -->
          <div>
            <h3 class="font-display text-lg text-ink dark:text-pearl mb-3">Get the Data</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="/api/database/export?format=csv" class="text-rose-primary hover:underline">Download CSV</a></li>
              <li><a href="/api/database/export?format=json" class="text-rose-primary hover:underline">Download JSON</a></li>
            </ul>
          </div>

          <!-- Contribute -->
          <div>
            <h3 class="font-display text-lg text-ink dark:text-pearl mb-3">Contribute</h3>
            <p class="text-sm text-muted dark:text-ash mb-3">
              Have catalogs or charm info to share? Help us build the most complete Pandora archive.
            </p>
            <NuxtLink to="/database/contribute" class="btn btn-primary text-sm">
              Start Contributing
            </NuxtLink>
          </div>
        </div>

        <div class="border-t border-light-border dark:border-dark-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted dark:text-ash">
          <p>&copy; {{ new Date().getFullYear() }} Pandora Database. Part of the Charmventory project.</p>
          <a href="https://app.charmventory.com" class="text-rose-primary hover:underline">
            Back to Charmventory App
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>
