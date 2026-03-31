<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

import { useAuth } from '~/composables/useAuth'

const { user, checkSession } = useAuth()
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

const pendingRevisions = ref<PendingRevision[]>([])
const loading = ref(true)
const error = ref('')

// Selected revision for preview
const selectedRevision = ref<PendingRevision | null>(null)
const reviewNote = ref('')
const processing = ref(false)

// Scrapers
const scrapers = ref<ScraperInfo[]>([])
const activeTab = ref<'revisions' | 'scrapers'>('revisions')
const runningScraperName = ref<string | null>(null)

onMounted(async () => {
  await checkSession()
  if (isAdmin.value) {
    await Promise.all([
      loadPendingRevisions(),
      loadScrapers(),
    ])
  }
  loading.value = false
})

async function loadPendingRevisions() {
  try {
    pendingRevisions.value = await $fetch('/api/catalogs/revisions/pending')
  } catch (e: any) {
    error.value = e.message || 'Failed to load pending revisions'
  }
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
  reviewNote.value = ''
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
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-4">
            <div class="text-4xl">📋</div>
            <div>
              <p class="text-2xl font-display text-ink dark:text-pearl">{{ pendingRevisions.length }}</p>
              <p class="text-sm text-muted dark:text-ash">Pending Reviews</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-4xl">🤖</div>
            <div>
              <p class="text-2xl font-display text-ink dark:text-pearl">{{ scrapers.length }}</p>
              <p class="text-sm text-muted dark:text-ash">Scrapers</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button
          @click="activeTab = 'revisions'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'revisions'
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Pending Reviews ({{ pendingRevisions.length }})
        </button>
        <button
          @click="activeTab = 'scrapers'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'scrapers'
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Scrapers
        </button>
      </div>

      <!-- Scrapers Section -->
      <section v-if="activeTab === 'scrapers'" class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden mb-8">
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
                    :class="scraper.config.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
                  >
                    {{ scraper.config.enabled ? 'Enabled' : 'Disabled' }}
                  </span>
                  <span v-if="scraper.isRunning || runningScraperName === scraper.name" class="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Running...
                  </span>
                </div>
                <p class="text-sm text-muted dark:text-ash mt-1">{{ scraper.description }}</p>

                <!-- Last run info -->
                <div v-if="scraper.config.lastResult" class="mt-3 p-3 bg-light-bg dark:bg-dark-elevated rounded text-sm">
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
                  <div v-if="scraper.config.lastResult.errors.length > 0" class="mt-2 text-red-600 dark:text-red-400 text-xs">
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
                <div class="mt-2 text-xs text-muted dark:text-ash">
                  <span v-if="scraper.config.cronSchedule">Cron: {{ scraper.config.cronSchedule }}</span>
                  <span v-if="scraper.config.rateLimit" class="ml-3">Rate: {{ scraper.config.rateLimit }} req/s</span>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  @click="toggleScraper(scraper.name, !scraper.config.enabled)"
                  class="btn btn-secondary text-sm"
                >
                  {{ scraper.config.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button
                  @click="runScraper(scraper.name)"
                  :disabled="!scraper.config.enabled || runningScraperName === scraper.name || scraper.isRunning"
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
    </Teleport>
  </div>
</template>
