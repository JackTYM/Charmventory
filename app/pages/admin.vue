<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useAdminData, type AdminUserWithStats, type UserSortField } from '~/composables/useAdminData'

const { user, checkSession } = useAuth()
const { fetchUsers } = useAdminData()
const ADMIN_EMAIL = 'jacksonkyarger@gmail.com'

const isAdmin = computed(() => user.value?.email === ADMIN_EMAIL)

interface ScraperInfo {
  name: string
  description: string
  config: {
    enabled: boolean
    cronSchedule?: string
    rateLimit?: number
    lastRun?: string
    lastResult?: {
      success: boolean
      charmsFound: number
      charmsAdded: number
      charmsUpdated: number
      catalogsFound: number
      sightingsAdded: number
      errors: string[]
    }
  }
  isRunning: boolean
}

interface PendingRevision {
  id: string
  catalogId: string
  pdfUrl: string
  pageCount: number
  hasOcr: boolean
  revisionNote: string | null
  status: string
  createdAt: string
  catalog: {
    id: string
    year: number
    season: string
    region: string
  }
}

interface CharmContribution {
  id: string
  styleId: string
  contributionType: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  imageUrl: string | null
  notes: string | null
  contributedBy: string
  status: string
  createdAt: string
  contributorName: string | null
  contributorEmail: string | null
}

const pendingRevisions = ref<PendingRevision[]>([])
const charmContributions = ref<CharmContribution[]>([])
const adminUsers = ref<AdminUserWithStats[]>([])
const totalUserCount = ref(0)
const loading = ref(true)
const error = ref('')

const selectedRevision = ref<PendingRevision | null>(null)
const selectedContribution = ref<CharmContribution | null>(null)
const reviewNote = ref('')
const processing = ref(false)

const scrapers = ref<ScraperInfo[]>([])
const activeTab = ref<'revisions' | 'contributions' | 'users'>('contributions')
const runningScraperName = ref<string | null>(null)

const userSortBy = ref<UserSortField>('created_at')
const userSortOrder = ref<'asc' | 'desc'>('desc')

onMounted(async () => {
  await checkSession()
  if (isAdmin.value) {
    await Promise.all([
      loadPendingRevisions(),
      loadCharmContributions(),
      loadUsers(),
    ])
  }
  loading.value = false
})

async function loadPendingRevisions() {
  try {
    pendingRevisions.value = await $fetch('/api/catalogs/revisions/pending')
  } catch (e: any) {
    console.error('Failed to load pending revisions:', e)
  }
}

async function loadCharmContributions() {
  try {
    charmContributions.value = await $fetch('/api/admin/charm-contributions')
  } catch (e: any) {
    console.error('Failed to load charm contributions:', e)
  }
}

async function loadUsers() {
  try {
    const response = await fetchUsers(userSortBy.value, userSortOrder.value)
    adminUsers.value = response.users
    totalUserCount.value = response.total
  } catch (e: any) {
    console.error('Failed to load users:', e)
  }
}

function changeUserSort(field: UserSortField) {
  if (userSortBy.value === field) {
    userSortOrder.value = userSortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    userSortBy.value = field
    userSortOrder.value = 'desc'
  }
  loadUsers()
}

async function loadScrapers() {
  try {
    scrapers.value = await $fetch('/api/admin/scrapers')
  } catch (e: any) {
    console.error('Failed to load scrapers:', e)
  }
}

async function runScraper(name: string) {
  if (runningScraperName.value) return

  runningScraperName.value = name
  error.value = ''

  try {
    const result = await $fetch(`/api/admin/scrapers/${name}/run`, {
      method: 'POST',
    })

    // Reload scrapers to get updated results
    await loadScrapers()
    // Also reload pending revisions in case catalogs were added
    await loadPendingRevisions()
  } catch (e: any) {
    error.value = e.message || `Failed to run scraper ${name}`
  } finally {
    runningScraperName.value = null
  }
}

async function toggleScraper(name: string, enabled: boolean) {
  try {
    await $fetch(`/api/admin/scrapers/${name}/config`, {
      method: 'PATCH',
      body: { enabled },
    })
    await loadScrapers()
  } catch (e: any) {
    error.value = e.message || 'Failed to update scraper config'
  }
}

async function reviewRevision(action: 'approve' | 'reject') {
  if (!selectedRevision.value) return

  processing.value = true
  try {
    await $fetch(`/api/catalogs/revisions/${selectedRevision.value.id}/review`, {
      method: 'POST',
      body: {
        action,
        reviewNote: reviewNote.value || null,
        reviewedBy: user.value?.email,
      },
    })

    // Remove from list and close modal
    pendingRevisions.value = pendingRevisions.value.filter(
      (r) => r.id !== selectedRevision.value?.id
    )
    selectedRevision.value = null
    reviewNote.value = ''
  } catch (e: any) {
    error.value = e.message || 'Failed to review revision'
  } finally {
    processing.value = false
  }
}

function selectRevision(revision: PendingRevision) {
  selectedRevision.value = revision
  reviewNote.value = ''
}

function closeModal() {
  selectedRevision.value = null
  selectedContribution.value = null
  reviewNote.value = ''
}

function selectContribution(contribution: CharmContribution) {
  selectedContribution.value = contribution
  reviewNote.value = ''
}

async function reviewContribution(action: 'approve' | 'reject') {
  if (!selectedContribution.value) return

  processing.value = true
  try {
    await $fetch(`/api/admin/charm-contributions/${selectedContribution.value.id}/review`, {
      method: 'POST',
      body: {
        action,
        reviewNotes: reviewNote.value || null,
      },
    })

    charmContributions.value = charmContributions.value.filter(
      (c) => c.id !== selectedContribution.value?.id
    )
    selectedContribution.value = null
    reviewNote.value = ''
  } catch (e: any) {
    error.value = e.message || 'Failed to review contribution'
  } finally {
    processing.value = false
  }
}

function parseCharmData(newValue: string | null) {
  if (!newValue) return {}
  try {
    return JSON.parse(newValue)
  } catch {
    return {}
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="px-4 py-8 max-w-6xl mx-auto">
    <!-- Header -->
    <section class="mb-8">
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Admin Panel
      </h1>
      <p class="text-muted dark:text-ash">
        Review and moderate catalog submissions.
      </p>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-rose-primary">Loading...</div>
    </div>

    <!-- Not Admin -->
    <div v-else-if="!isAdmin" class="text-center py-16 bg-light-card dark:bg-dark-card rounded-lg">
      <div class="text-6xl mb-4">🔒</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">Access Denied</h2>
      <p class="text-muted dark:text-ash">
        You don't have permission to access this page.
      </p>
    </div>

    <!-- Admin Content -->
    <template v-else>
      <!-- Error -->
      <div v-if="error" class="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        {{ error }}
        <button @click="error = ''" class="ml-2 underline">Dismiss</button>
      </div>

      <!-- Stats -->
      <section class="mb-8 bg-light-card dark:bg-dark-card rounded-lg p-6 shadow-card">
        <div class="flex items-center gap-6 flex-wrap">
          <div class="flex items-center gap-4">
            <div class="text-4xl">👥</div>
            <div>
              <p class="text-2xl font-display text-ink dark:text-pearl">{{ totalUserCount }}</p>
              <p class="text-sm text-muted dark:text-ash">Total Users</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-4xl">💎</div>
            <div>
              <p class="text-2xl font-display text-ink dark:text-pearl">{{ charmContributions.length }}</p>
              <p class="text-sm text-muted dark:text-ash">Charm Contributions</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-4xl">📋</div>
            <div>
              <p class="text-2xl font-display text-ink dark:text-pearl">{{ pendingRevisions.length }}</p>
              <p class="text-sm text-muted dark:text-ash">Catalog Revisions</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6 flex-wrap">
        <button
          @click="activeTab = 'users'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'users'
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Users ({{ totalUserCount }})
        </button>
        <button
          @click="activeTab = 'contributions'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'contributions'
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Charm Contributions ({{ charmContributions.length }})
        </button>
        <button
          @click="activeTab = 'revisions'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'revisions'
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Catalog Revisions ({{ pendingRevisions.length }})
        </button>
      </div>

      <!-- Users Section -->
      <section v-if="activeTab === 'users'" class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden mb-8">
        <div class="p-4 border-b border-light-border dark:border-dark-border">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-3">
            All Users
          </h3>

          <!-- Sort Controls -->
          <div class="flex flex-wrap gap-2 text-sm">
            <span class="text-muted dark:text-ash">Sort by:</span>
            <button
              @click="changeUserSort('created_at')"
              class="px-3 py-1 rounded transition-colors"
              :class="userSortBy === 'created_at'
                ? 'bg-rose-primary/20 text-rose-primary'
                : 'bg-light-bg dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
            >
              Joined {{ userSortBy === 'created_at' ? (userSortOrder === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="changeUserSort('updated_at')"
              class="px-3 py-1 rounded transition-colors"
              :class="userSortBy === 'updated_at'
                ? 'bg-rose-primary/20 text-rose-primary'
                : 'bg-light-bg dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
            >
              Last Active {{ userSortBy === 'updated_at' ? (userSortOrder === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="changeUserSort('name')"
              class="px-3 py-1 rounded transition-colors"
              :class="userSortBy === 'name'
                ? 'bg-rose-primary/20 text-rose-primary'
                : 'bg-light-bg dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
            >
              Name {{ userSortBy === 'name' ? (userSortOrder === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="changeUserSort('item_count')"
              class="px-3 py-1 rounded transition-colors"
              :class="userSortBy === 'item_count'
                ? 'bg-rose-primary/20 text-rose-primary'
                : 'bg-light-bg dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
            >
              Listings {{ userSortBy === 'item_count' ? (userSortOrder === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="changeUserSort('post_count')"
              class="px-3 py-1 rounded transition-colors"
              :class="userSortBy === 'post_count'
                ? 'bg-rose-primary/20 text-rose-primary'
                : 'bg-light-bg dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
            >
              Posts {{ userSortBy === 'post_count' ? (userSortOrder === 'desc' ? '↓' : '↑') : '' }}
            </button>
          </div>
        </div>

        <div v-if="adminUsers.length === 0" class="p-8 text-center text-muted dark:text-ash">
          <div class="text-4xl mb-4">👤</div>
          <p>No users found.</p>
        </div>

        <div v-else class="divide-y divide-light-border dark:divide-dark-border">
          <div
            v-for="u in adminUsers"
            :key="u.id"
            class="p-4 hover:bg-light-bg dark:hover:bg-dark-elevated transition-colors"
          >
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <div class="flex-shrink-0">
                <img
                  v-if="u.avatar"
                  :src="u.avatar"
                  :alt="u.name || u.email"
                  class="w-12 h-12 rounded-full object-cover"
                />
                <div
                  v-else
                  class="w-12 h-12 rounded-full bg-rose-primary/20 flex items-center justify-center text-rose-primary font-medium text-lg"
                >
                  {{ (u.name || u.email).charAt(0).toUpperCase() }}
                </div>
              </div>

              <!-- User Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="font-medium text-ink dark:text-pearl truncate">
                    {{ u.name || 'No name' }}
                  </h4>
                  <span v-if="u.slug" class="text-xs text-muted dark:text-ash">
                    @{{ u.slug }}
                  </span>
                </div>
                <p class="text-sm text-muted dark:text-ash truncate">{{ u.email }}</p>
                <p class="text-xs text-muted dark:text-ash mt-1">
                  Joined {{ formatDate(u.created_at) }}
                </p>
              </div>

              <!-- Stats -->
              <div class="flex gap-6 text-center flex-shrink-0">
                <div>
                  <p class="text-lg font-display text-ink dark:text-pearl">{{ u.item_count }}</p>
                  <p class="text-xs text-muted dark:text-ash">Items</p>
                </div>
                <div>
                  <p class="text-lg font-display text-ink dark:text-pearl">{{ u.post_count }}</p>
                  <p class="text-xs text-muted dark:text-ash">Posts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Charm Contributions Section -->
      <section v-if="activeTab === 'contributions'" class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden mb-8">
        <h3 class="p-4 font-display text-lg text-ink dark:text-pearl border-b border-light-border dark:border-dark-border">
          Pending Charm Contributions
        </h3>

        <div v-if="charmContributions.length === 0" class="p-8 text-center text-muted dark:text-ash">
          <div class="text-4xl mb-4">✅</div>
          <p>No pending charm contributions!</p>
        </div>

        <div v-else class="divide-y divide-light-border dark:divide-dark-border">
          <div
            v-for="contribution in charmContributions"
            :key="contribution.id"
            class="p-4 hover:bg-light-bg dark:hover:bg-dark-elevated transition-colors cursor-pointer"
            @click="selectContribution(contribution)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-mono text-rose-primary text-sm">{{ contribution.styleId }}</span>
                  <span class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {{ contribution.contributionType === 'new_charm' ? 'New' : 'Edit' }}
                  </span>
                </div>
                <h4 class="font-medium text-ink dark:text-pearl">
                  {{ parseCharmData(contribution.newValue).name || 'Unknown Name' }}
                </h4>
                <p class="text-sm text-muted dark:text-ash mt-1">
                  By {{ contribution.contributorName || contribution.contributorEmail || 'Anonymous' }}
                </p>
                <p v-if="contribution.notes" class="text-sm text-muted dark:text-ash mt-1 italic">
                  "{{ contribution.notes }}"
                </p>
                <p class="text-xs text-muted dark:text-ash mt-2">
                  Submitted {{ formatDate(contribution.createdAt) }}
                </p>
              </div>
              <div class="flex gap-2">
                <span class="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Scrapers Section - hidden until API is implemented -->
      <section v-if="false && activeTab === 'scrapers'" class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden mb-8">
        <h3 class="p-4 font-display text-lg text-ink dark:text-pearl border-b border-light-border dark:border-dark-border">
          Data Scrapers
        </h3>

        <div class="divide-y divide-light-border dark:divide-dark-border">
          <div
            v-for="scraper in scrapers"
            :key="scraper.name"
            class="p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <h4 class="font-medium text-ink dark:text-pearl">{{ scraper.name }}</h4>
                  <span
                    class="px-2 py-0.5 text-xs rounded"
                    :class="scraper.config?.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
                  >
                    {{ scraper.config?.enabled ? 'Enabled' : 'Disabled' }}
                  </span>
                  <span v-if="scraper.isRunning || runningScraperName === scraper.name" class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Running...
                  </span>
                </div>
                <p class="text-sm text-muted dark:text-ash mt-1">{{ scraper.description }}</p>

                <!-- Last run info -->
                <div v-if="scraper.config?.lastResult" class="mt-3 p-3 bg-light-bg dark:bg-dark-elevated rounded text-sm">
                  <div class="flex items-center gap-4 flex-wrap">
                    <span :class="scraper.config.lastResult.success ? 'text-green-600' : 'text-red-600'">
                      {{ scraper.config.lastResult.success ? '✓ Success' : '✗ Failed' }}
                    </span>
                    <span class="text-muted dark:text-ash">
                      {{ scraper.config.lastResult.charmsFound }} found,
                      {{ scraper.config.lastResult.charmsAdded }} added,
                      {{ scraper.config.lastResult.charmsUpdated }} updated,
                      {{ scraper.config.lastResult.sightingsAdded || 0 }} sightings
                    </span>
                    <span v-if="scraper.config.lastResult.catalogsFound" class="text-muted dark:text-ash">
                      {{ scraper.config.lastResult.catalogsFound }} catalogs
                    </span>
                  </div>
                  <div v-if="scraper.config.lastResult.errors?.length > 0" class="mt-2 text-red-600 dark:text-red-400 text-xs">
                    Errors: {{ scraper.config.lastResult.errors.slice(0, 3).join(', ') }}
                    <span v-if="scraper.config.lastResult.errors.length > 3">
                      ... and {{ scraper.config.lastResult.errors.length - 3 }} more
                    </span>
                  </div>
                  <p v-if="scraper.config.lastRun" class="text-xs text-muted dark:text-ash mt-1">
                    Last run: {{ formatDate(scraper.config.lastRun) }}
                  </p>
                </div>

                <!-- Config info -->
                <div v-if="scraper.config" class="mt-2 text-xs text-muted dark:text-ash">
                  <span v-if="scraper.config.cronSchedule">Cron: {{ scraper.config.cronSchedule }}</span>
                  <span v-if="scraper.config.rateLimit" class="ml-3">Rate: {{ scraper.config.rateLimit }} req/s</span>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  @click="toggleScraper(scraper.name, !scraper.config?.enabled)"
                  class="btn btn-secondary text-sm"
                >
                  {{ scraper.config?.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button
                  @click="runScraper(scraper.name)"
                  :disabled="!scraper.config?.enabled || runningScraperName === scraper.name || scraper.isRunning"
                  class="btn btn-primary text-sm"
                >
                  {{ runningScraperName === scraper.name || scraper.isRunning ? 'Running...' : 'Run Now' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="scrapers.length === 0" class="p-8 text-center text-muted dark:text-ash">
          No scrapers configured.
        </div>
      </section>

      <!-- Pending Revisions -->
      <section v-if="activeTab === 'revisions'" class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden">
        <h3 class="p-4 font-display text-lg text-ink dark:text-pearl border-b border-light-border dark:border-dark-border">
          Pending Submissions
        </h3>

        <div v-if="pendingRevisions.length === 0" class="p-8 text-center text-muted dark:text-ash">
          <div class="text-4xl mb-4">✅</div>
          <p>No pending submissions to review!</p>
        </div>

        <div v-else class="divide-y divide-light-border dark:divide-dark-border">
          <div
            v-for="revision in pendingRevisions"
            :key="revision.id"
            class="p-4 hover:bg-light-bg dark:hover:bg-dark-elevated transition-colors cursor-pointer"
            @click="selectRevision(revision)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <h4 class="font-medium text-ink dark:text-pearl">
                  {{ revision.catalog.season }} {{ revision.catalog.year }} ({{ revision.catalog.region }})
                </h4>
                <p class="text-sm text-muted dark:text-ash mt-1">
                  {{ revision.pageCount }} pages
                  <span v-if="revision.hasOcr" class="text-green-600 dark:text-green-400">• Has OCR</span>
                </p>
                <p v-if="revision.revisionNote" class="text-sm text-muted dark:text-ash mt-1 italic">
                  "{{ revision.revisionNote }}"
                </p>
                <p class="text-xs text-muted dark:text-ash mt-2">
                  Submitted {{ formatDate(revision.createdAt) }}
                </p>
              </div>
              <div class="flex gap-2">
                <span class="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Review Modal -->
    <Teleport to="body">
      <div
        v-if="selectedRevision"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <div class="absolute inset-0 bg-black/70" @click="closeModal"></div>

        <div class="relative bg-light-card dark:bg-dark-card rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
            <div>
              <h2 class="font-display text-xl text-ink dark:text-pearl">
                Review: {{ selectedRevision.catalog.season }} {{ selectedRevision.catalog.year }}
              </h2>
              <p class="text-sm text-muted dark:text-ash">
                {{ selectedRevision.catalog.region }} • {{ selectedRevision.pageCount }} pages
                <span v-if="selectedRevision.hasOcr" class="text-green-600">• Has OCR</span>
              </p>
            </div>
            <button @click="closeModal" class="text-muted hover:text-ink dark:hover:text-pearl text-2xl">&times;</button>
          </div>

          <!-- PDF Preview -->
          <div class="flex-1 overflow-hidden">
            <iframe :src="selectedRevision.pdfUrl" class="w-full h-full min-h-[400px]"></iframe>
          </div>

          <!-- Review Actions -->
          <div class="p-4 border-t border-light-border dark:border-dark-border">
            <div class="mb-4">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
                Review Note (optional)
              </label>
              <input
                v-model="reviewNote"
                type="text"
                placeholder="Reason for rejection or notes..."
                class="form-input"
              />
            </div>

            <div class="flex gap-3 justify-end">
              <button
                @click="closeModal"
                class="btn btn-secondary"
                :disabled="processing"
              >
                Cancel
              </button>
              <button
                @click="reviewRevision('reject')"
                class="btn bg-red-500 hover:bg-red-600 text-white"
                :disabled="processing"
              >
                {{ processing ? 'Processing...' : 'Reject' }}
              </button>
              <button
                @click="reviewRevision('approve')"
                class="btn btn-primary"
                :disabled="processing"
              >
                {{ processing ? 'Processing...' : 'Approve' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Charm Contribution Review Modal -->
      <div
        v-if="selectedContribution"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <div class="absolute inset-0 bg-black/70" @click="closeModal"></div>

        <div class="relative bg-light-card dark:bg-dark-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div class="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
            <div>
              <h2 class="font-display text-xl text-ink dark:text-pearl">
                Review Charm Contribution
              </h2>
              <p class="text-sm text-muted dark:text-ash">
                {{ selectedContribution.contributionType === 'new_charm' ? 'New charm' : 'Edit existing' }} • {{ selectedContribution.styleId }}
              </p>
            </div>
            <button @click="closeModal" class="text-muted hover:text-ink dark:hover:text-pearl text-2xl">&times;</button>
          </div>

          <div class="p-4 space-y-4">
            <div v-if="selectedContribution.imageUrl" class="flex justify-center">
              <img :src="selectedContribution.imageUrl" class="max-w-xs rounded-lg shadow" />
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-muted dark:text-ash">Style ID</p>
                <p class="font-mono text-ink dark:text-pearl">{{ selectedContribution.styleId }}</p>
              </div>
              <div>
                <p class="text-muted dark:text-ash">Name</p>
                <p class="text-ink dark:text-pearl">{{ parseCharmData(selectedContribution.newValue).name || '-' }}</p>
              </div>
              <div>
                <p class="text-muted dark:text-ash">Type</p>
                <p class="text-ink dark:text-pearl capitalize">{{ parseCharmData(selectedContribution.newValue).type || '-' }}</p>
              </div>
              <div>
                <p class="text-muted dark:text-ash">Collection</p>
                <p class="text-ink dark:text-pearl">{{ parseCharmData(selectedContribution.newValue).collection || '-' }}</p>
              </div>
              <div>
                <p class="text-muted dark:text-ash">Price</p>
                <p class="text-ink dark:text-pearl">
                  {{ parseCharmData(selectedContribution.newValue).originalPrice 
                    ? `${parseCharmData(selectedContribution.newValue).originalPrice} ${parseCharmData(selectedContribution.newValue).currency || 'USD'}` 
                    : '-' }}
                </p>
              </div>
              <div>
                <p class="text-muted dark:text-ash">Region</p>
                <p class="text-ink dark:text-pearl">{{ parseCharmData(selectedContribution.newValue).region || '-' }}</p>
              </div>
            </div>

            <div v-if="parseCharmData(selectedContribution.newValue).description">
              <p class="text-muted dark:text-ash text-sm">Description</p>
              <p class="text-ink dark:text-pearl text-sm">{{ parseCharmData(selectedContribution.newValue).description }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <span v-if="parseCharmData(selectedContribution.newValue).isLimited" class="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Limited Edition
              </span>
              <span v-if="parseCharmData(selectedContribution.newValue).isCountryExclusive" class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Country Exclusive: {{ parseCharmData(selectedContribution.newValue).exclusiveCountry }}
              </span>
            </div>

            <div v-if="selectedContribution.notes" class="p-3 bg-light-bg dark:bg-dark-elevated rounded-lg">
              <p class="text-muted dark:text-ash text-xs mb-1">Contributor Notes</p>
              <p class="text-sm text-ink dark:text-pearl">{{ selectedContribution.notes }}</p>
            </div>

            <div class="text-xs text-muted dark:text-ash">
              Submitted by {{ selectedContribution.contributorName || selectedContribution.contributorEmail || 'Anonymous' }}
              on {{ formatDate(selectedContribution.createdAt) }}
            </div>
          </div>

          <div class="p-4 border-t border-light-border dark:border-dark-border">
            <div class="mb-4">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
                Review Note (optional)
              </label>
              <input
                v-model="reviewNote"
                type="text"
                placeholder="Reason for rejection or notes..."
                class="form-input"
              />
            </div>

            <div class="flex gap-3 justify-end">
              <button
                @click="closeModal"
                class="btn btn-secondary"
                :disabled="processing"
              >
                Cancel
              </button>
              <button
                @click="reviewContribution('reject')"
                class="btn bg-red-500 hover:bg-red-600 text-white"
                :disabled="processing"
              >
                {{ processing ? 'Processing...' : 'Reject' }}
              </button>
              <button
                @click="reviewContribution('approve')"
                class="btn btn-primary"
                :disabled="processing"
              >
                {{ processing ? 'Processing...' : 'Approve' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
