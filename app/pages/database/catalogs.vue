<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

interface CatalogStatus {
  year: number
  season: string
  region: string
  status: 'complete' | 'partial' | 'missing'
  pages: number
  hasOcr: boolean
  catalogId: string | null
  pdfUrl: string | null
}

const allCatalogs = ref<CatalogStatus[]>([])
const loading = ref(true)
const error = ref('')

// Region filter
const regions = ['US', 'UK', 'EU', 'AU', 'Asia', 'Other']
const selectedRegion = ref('US')

// Selected catalog for viewing
const selectedCatalog = ref<CatalogStatus | null>(null)
const showViewer = ref(false)
const showHistory = ref(false)
const revisions = ref<any[]>([])
const loadingRevisions = ref(false)

onMounted(async () => {
  try {
    const data = await $fetch<CatalogStatus[]>('/api/database/catalog-status')
    allCatalogs.value = data
  } catch (e: any) {
    error.value = e.message || 'Failed to load catalog status'
  } finally {
    loading.value = false
  }
})

// Filter catalogs by selected region
const catalogs = computed(() => {
  return allCatalogs.value.filter(c => c.region === selectedRegion.value)
})

const years = computed(() => {
  const uniqueYears = [...new Set(catalogs.value.map(c => c.year))]
  return uniqueYears.sort((a, b) => b - a)
})

const regularSeasons = ['Spring', 'Summer', 'Autumn', 'Winter']
const specialSeasons = [
  "Valentine's Day", "Mother's Day", "Father's Day",
  'Easter', 'Halloween', 'Christmas', 'Holiday',
  'Pre-Spring', 'Pre-Autumn', 'Year-Round', 'Special Edition'
]

function getCatalog(year: number, season: string) {
  return catalogs.value.find(c => c.year === year && c.season === season)
}

function getStatusColor(status: string) {
  switch (status) {
    case 'complete': return 'bg-green-500'
    case 'partial': return 'bg-amber-500'
    case 'missing': return 'bg-red-500'
    default: return 'bg-gray-300'
  }
}

function getStatusBg(status: string) {
  switch (status) {
    case 'complete': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    case 'partial': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    case 'missing': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    default: return 'bg-gray-50 dark:bg-gray-900/20'
  }
}

const stats = computed(() => {
  const total = catalogs.value.length
  const complete = catalogs.value.filter(c => c.status === 'complete').length
  const partial = catalogs.value.filter(c => c.status === 'partial').length
  const missing = catalogs.value.filter(c => c.status === 'missing').length
  return { total, complete, partial, missing }
})

async function openCatalog(year: number, season: string) {
  const catalog = getCatalog(year, season)

  if (!catalog || catalog.status === 'missing') {
    // Go to contribute page
    navigateTo(`/database/contribute/catalog?year=${year}&season=${season}&region=${selectedRegion.value}`)
    return
  }

  selectedCatalog.value = catalog
  showViewer.value = true
}

async function loadRevisions() {
  if (!selectedCatalog.value?.catalogId) return

  loadingRevisions.value = true
  try {
    revisions.value = await $fetch(`/api/catalogs/${selectedCatalog.value.catalogId}/revisions`)
  } catch (e) {
    console.error('Failed to load revisions:', e)
  } finally {
    loadingRevisions.value = false
  }
}

function openHistory() {
  showHistory.value = true
  loadRevisions()
}

function closeViewer() {
  showViewer.value = false
  showHistory.value = false
  selectedCatalog.value = null
  revisions.value = []
}

const catalogTitle = computed(() => {
  if (!selectedCatalog.value) return ''
  return `${selectedCatalog.value.season} ${selectedCatalog.value.year} (${selectedCatalog.value.region})`
})
</script>

<template>
  <div class="px-4 py-8 max-w-6xl mx-auto">
    <!-- Header -->
    <section class="mb-8 text-center">
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Catalog Archive
      </h1>
      <p class="text-muted dark:text-ash max-w-2xl mx-auto mb-4">
        Browse digitized Pandora catalogs. Click to view or help fill in the gaps!
      </p>

      <!-- Region Selector -->
      <div class="flex justify-center gap-2 flex-wrap">
        <button
          v-for="region in regions"
          :key="region"
          @click="selectedRegion = region"
          class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
          :class="selectedRegion === region
            ? 'bg-rose-primary text-white'
            : 'bg-light-card dark:bg-dark-card text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          {{ region }}
        </button>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-rose-primary">Loading catalog status...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <button @click="$router.go(0)" class="btn btn-primary">Retry</button>
    </div>

    <template v-else>
      <!-- Legend & Stats -->
      <section class="mb-8 bg-light-card dark:bg-dark-card rounded-lg p-6 shadow-card">
        <div class="flex flex-wrap justify-between items-center gap-6">
          <div class="flex flex-wrap gap-4">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-green-500"></span>
              <span class="text-sm text-muted dark:text-ash">Complete (with OCR)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-amber-500"></span>
              <span class="text-sm text-muted dark:text-ash">Available</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded bg-red-500"></span>
              <span class="text-sm text-muted dark:text-ash">Missing</span>
            </div>
          </div>

          <div class="flex gap-6 text-center">
            <div>
              <p class="text-xl font-display text-green-600 dark:text-green-400">{{ stats.complete }}</p>
              <p class="text-xs text-muted dark:text-ash">Complete</p>
            </div>
            <div>
              <p class="text-xl font-display text-amber-600 dark:text-amber-400">{{ stats.partial }}</p>
              <p class="text-xs text-muted dark:text-ash">Available</p>
            </div>
            <div>
              <p class="text-xl font-display text-red-600 dark:text-red-400">{{ stats.missing }}</p>
              <p class="text-xs text-muted dark:text-ash">Needed</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Regular Seasons Grid -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden overflow-x-auto mb-8">
        <h3 class="p-4 font-display text-lg text-ink dark:text-pearl border-b border-light-border dark:border-dark-border">
          Seasonal Catalogs
        </h3>
        <div class="grid grid-cols-5 bg-light-bg-alt dark:bg-dark-elevated min-w-[600px]">
          <div class="p-4 font-medium text-ink dark:text-pearl">Year</div>
          <div v-for="season in regularSeasons" :key="season" class="p-4 font-medium text-ink dark:text-pearl text-center">
            {{ season }}
          </div>
        </div>

        <div v-for="year in years" :key="year" class="grid grid-cols-5 border-t border-light-border dark:border-dark-border min-w-[600px]">
          <div class="p-4 font-display text-lg text-ink dark:text-pearl">{{ year }}</div>
          <div v-for="season in regularSeasons" :key="season" class="p-2">
            <button
              @click="openCatalog(year, season)"
              class="w-full rounded-lg p-3 border cursor-pointer hover:shadow-md transition-shadow text-left"
              :class="getStatusBg(getCatalog(year, season)?.status || 'missing')"
            >
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="w-2 h-2 rounded-full"
                  :class="getStatusColor(getCatalog(year, season)?.status || 'missing')"
                ></span>
                <span class="text-xs font-medium text-ink dark:text-pearl capitalize">
                  {{ getCatalog(year, season)?.status || 'missing' }}
                </span>
              </div>
              <p v-if="getCatalog(year, season)?.pages" class="text-xs text-muted dark:text-ash">
                {{ getCatalog(year, season)?.pages }} pages
              </p>
              <p v-else class="text-xs text-rose-primary">+ Contribute</p>
            </button>
          </div>
        </div>
      </section>

      <!-- Special Catalogs -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden">
        <h3 class="p-4 font-display text-lg text-ink dark:text-pearl border-b border-light-border dark:border-dark-border">
          Special & Holiday Catalogs
        </h3>
        <div class="p-4">
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <template v-for="year in years.slice(0, 10)" :key="year">
              <template v-for="season in specialSeasons" :key="`${year}-${season}`">
                <button
                  v-if="getCatalog(year, season)?.status !== 'missing'"
                  @click="openCatalog(year, season)"
                  class="rounded-lg p-3 border cursor-pointer hover:shadow-md transition-shadow text-left"
                  :class="getStatusBg(getCatalog(year, season)?.status || 'missing')"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="getStatusColor(getCatalog(year, season)?.status || 'missing')"
                    ></span>
                    <span class="text-xs font-medium text-ink dark:text-pearl">{{ year }}</span>
                  </div>
                  <p class="text-xs text-ink dark:text-pearl font-medium truncate">{{ season }}</p>
                  <p class="text-xs text-muted dark:text-ash">{{ getCatalog(year, season)?.pages || 0 }} pages</p>
                </button>
              </template>
            </template>
          </div>

          <div v-if="!catalogs.some(c => specialSeasons.includes(c.season) && c.status !== 'missing')" class="text-center py-8 text-muted dark:text-ash">
            <p>No special catalogs documented yet for {{ selectedRegion }}.</p>
            <NuxtLink to="/database/contribute/catalog" class="text-rose-primary hover:underline text-sm mt-2 inline-block">
              Be the first to contribute!
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="mt-8 text-center">
        <NuxtLink to="/database/contribute/catalog" class="btn btn-primary">
          Upload Catalog
        </NuxtLink>
      </section>
    </template>

    <!-- PDF Viewer Modal -->
    <Teleport to="body">
      <div
        v-if="showViewer && selectedCatalog"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeViewer"
      >
        <div class="absolute inset-0 bg-black/70" @click="closeViewer"></div>

        <div class="relative bg-light-card dark:bg-dark-card rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
            <h2 class="font-display text-xl text-ink dark:text-pearl">{{ catalogTitle }}</h2>
            <div class="flex items-center gap-3">
              <button @click="openHistory" class="btn btn-secondary text-sm">
                History
              </button>
              <NuxtLink
                :to="`/database/contribute/catalog?year=${selectedCatalog.year}&season=${selectedCatalog.season}&region=${selectedCatalog.region}`"
                class="btn btn-secondary text-sm"
              >
                Upload New Version
              </NuxtLink>
              <button @click="closeViewer" class="text-muted hover:text-ink dark:hover:text-pearl text-2xl">&times;</button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden">
            <!-- History View -->
            <div v-if="showHistory" class="p-4 overflow-y-auto h-full">
              <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Revision History</h3>

              <div v-if="loadingRevisions" class="text-center py-8 text-muted dark:text-ash">
                Loading revisions...
              </div>

              <div v-else-if="revisions.length === 0" class="text-center py-8 text-muted dark:text-ash">
                No revision history available.
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="rev in revisions"
                  :key="rev.id"
                  class="p-4 bg-light-bg dark:bg-dark-elevated rounded-lg"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <span
                        class="px-2 py-0.5 text-xs rounded"
                        :class="{
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400': rev.status === 'approved',
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': rev.status === 'pending',
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400': rev.status === 'rejected',
                        }"
                      >
                        {{ rev.status }}
                      </span>
                      <p class="text-sm text-ink dark:text-pearl mt-2">{{ rev.revisionNote || 'No note' }}</p>
                      <p v-if="rev.status === 'rejected' && rev.reviewNote" class="text-sm text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                        Rejection reason: {{ rev.reviewNote }}
                      </p>
                      <p class="text-xs text-muted dark:text-ash mt-1">
                        {{ rev.pageCount }} pages
                        <span v-if="rev.hasOcr" class="text-green-600 dark:text-green-400">• Has OCR</span>
                      </p>
                      <p class="text-xs text-muted dark:text-ash">
                        Uploaded {{ new Date(rev.createdAt).toLocaleDateString() }}
                        <span v-if="rev.reviewedAt"> • Reviewed {{ new Date(rev.reviewedAt).toLocaleDateString() }}</span>
                      </p>
                    </div>
                    <a
                      :href="rev.pdfUrl"
                      target="_blank"
                      class="btn btn-secondary text-sm"
                    >
                      View PDF
                    </a>
                  </div>
                </div>
              </div>

              <button @click="showHistory = false" class="mt-4 text-sm text-rose-primary hover:underline">
                ← Back to viewer
              </button>
            </div>

            <!-- PDF Viewer -->
            <div v-else class="h-full">
              <iframe
                v-if="selectedCatalog.pdfUrl"
                :src="selectedCatalog.pdfUrl"
                class="w-full h-full"
              ></iframe>
              <div v-else class="flex items-center justify-center h-full text-muted dark:text-ash">
                <div class="text-center">
                  <p class="text-4xl mb-4">📖</p>
                  <p>No PDF available yet.</p>
                  <NuxtLink
                    :to="`/database/contribute/catalog?year=${selectedCatalog.year}&season=${selectedCatalog.season}&region=${selectedCatalog.region}`"
                    class="text-rose-primary hover:underline text-sm mt-2 inline-block"
                  >
                    Be the first to upload!
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
