<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

import { useCharmDatabase } from '~/composables/useCharmDatabase'
import { getImageUrl } from '~/utils/imageUrl'

const { charms, charmsTotal, searchCharms, loading, error, getSources, fetchCatalogPages, catalogPages } = useCharmDatabase()

const activeTab = ref<'charms' | 'catalogs'>('charms')
const search = ref('')
const selectedCollection = ref('')
const selectedType = ref('')
const selectedSource = ref('')
const selectedSort = ref('newest')
const currentOffset = ref(0)
const pageSize = 50
const loadingMore = ref(false)

const sortOptions = [
  { value: 'newest', label: 'First Seen: Recent', sortBy: 'created_at', sortOrder: 'desc' },
  { value: 'oldest', label: 'First Seen: Old', sortBy: 'created_at', sortOrder: 'asc' },
  { value: 'name_asc', label: 'Name: A-Z', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Name: Z-A', sortBy: 'name', sortOrder: 'desc' },
  { value: 'price_high', label: 'Price: High-Low', sortBy: 'original_price', sortOrder: 'desc' },
  { value: 'price_low', label: 'Price: Low-High', sortBy: 'original_price', sortOrder: 'asc' },
] as const

// Get current sort config
const currentSortConfig = computed(() => {
  return sortOptions.find(opt => opt.value === selectedSort.value) || sortOptions[0]
})

// Available sources
const sources = ref<Array<{ id: string; name: string; count: number }>>([])

async function fetchSources() {
  try {
    sources.value = await getSources()
  } catch (e) {
    console.error('Failed to load sources:', e)
  }
}

// Catalog data
const catalogLoading = ref(false)
const catalogError = ref('')

async function fetchCatalogs() {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    await fetchCatalogPages()
  } catch (e: any) {
    catalogError.value = e.message || 'Failed to load catalogs'
  } finally {
    catalogLoading.value = false
  }
}

// Group catalogs by name
const groupedCatalogs = computed(() => {
  const groups: Record<string, any[]> = {}
  catalogPages.value.forEach(page => {
    const key = page.catalogName || 'Unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(page)
  })
  // Sort pages within each group
  Object.values(groups).forEach(pages => {
    pages.sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0))
  })
  return groups
})

watch(activeTab, (tab) => {
  if (tab === 'catalogs' && catalogPages.value.length === 0) {
    fetchCatalogs()
  }
})

const collections = [
  'Moments',
  'Timeless',
  'ME',
  'Essence',
  'Reflexions',
  'Disney',
  'Marvel',
  'Star Wars',
  'Harry Potter',
]

const types = [
  { value: 'charm', label: 'Charms' },
  { value: 'clip', label: 'Clips' },
  { value: 'murano', label: 'Muranos' },
  { value: 'bracelet', label: 'Bracelets' },
  { value: 'bangle', label: 'Bangles' },
  { value: 'safety_chain', label: 'Safety Chains' },
  { value: 'ring', label: 'Rings' },
  { value: 'earring', label: 'Earrings' },
  { value: 'necklace', label: 'Necklaces' },
  { value: 'pendant', label: 'Pendants' },
  { value: 'watch', label: 'Watches' },
  { value: 'brooch', label: 'Brooches' },
  { value: 'keychain', label: 'Key Chains' },
  { value: 'ornament', label: 'Ornaments' },
  { value: 'box', label: 'Boxes' },
  { value: 'catalogue', label: 'Catalogs' },
  { value: 'other', label: 'Other' },
]

onMounted(async () => {
  await Promise.all([
    searchCharms({ 
      limit: pageSize,
      sortBy: currentSortConfig.value.sortBy as any,
      sortOrder: currentSortConfig.value.sortOrder as any,
    }),
    fetchSources(),
  ])
})

async function handleSearch() {
  currentOffset.value = 0
  await searchCharms({
    search: search.value || undefined,
    collection: selectedCollection.value || undefined,
    type: selectedType.value || undefined,
    source: selectedSource.value || undefined,
    sortBy: currentSortConfig.value.sortBy as any,
    sortOrder: currentSortConfig.value.sortOrder as any,
    limit: pageSize,
    offset: 0,
  })
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  currentOffset.value += pageSize
  try {
    await searchCharms({
      search: search.value || undefined,
      collection: selectedCollection.value || undefined,
      type: selectedType.value || undefined,
      source: selectedSource.value || undefined,
      sortBy: currentSortConfig.value.sortBy as any,
      sortOrder: currentSortConfig.value.sortOrder as any,
      limit: pageSize,
      offset: currentOffset.value,
    })
  } finally {
    loadingMore.value = false
  }
}

const hasMore = computed(() => charms.value.length < charmsTotal.value)

// Track broken images and loading images
const brokenImages = ref(new Set<string>())
const loadingImages = ref(new Set<string>())

function handleImageError(styleId: string) {
  brokenImages.value.add(styleId)
  loadingImages.value.delete(styleId)
}

function handleImageLoad(styleId: string) {
  loadingImages.value.delete(styleId)
}

// Initialize loading state for new charms with images
watch(charms, (newCharms) => {
  newCharms.forEach(charm => {
    if (charm.primaryImage && !brokenImages.value.has(charm.styleId)) {
      loadingImages.value.add(charm.styleId)
    }
  })
}, { immediate: true })

// Show all charms regardless of image status
const displayedCharms = computed(() => charms.value)

watch([search, selectedCollection, selectedType, selectedSource, selectedSort], () => {
  handleSearch()
}, { debounce: 300 } as any)

function formatPrice(price: number | null | undefined, currency = 'USD') {
  if (!price) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price)
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return null
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto pb-24">
    <!-- Header -->
    <section class="mb-6 text-center">
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Pandora Database
      </h1>
      <p class="text-muted dark:text-ash">
        Browse and discover Pandora products from our community-curated database
      </p>
    </section>

    <!-- Tabs -->
    <section class="mb-6">
      <div class="flex gap-2 justify-center">
        <button
          @click="activeTab = 'charms'"
          class="px-6 py-3 rounded-full text-sm font-medium transition-all"
          :class="activeTab === 'charms'
            ? 'bg-rose-primary text-white'
            : 'bg-light-bg-alt dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Products
        </button>
        <button
          @click="activeTab = 'catalogs'"
          class="px-6 py-3 rounded-full text-sm font-medium transition-all"
          :class="activeTab === 'catalogs'
            ? 'bg-rose-primary text-white'
            : 'bg-light-bg-alt dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
        >
          Catalogs
        </button>
      </div>
    </section>

    <!-- CHARMS TAB -->
    <template v-if="activeTab === 'charms'">
    <!-- Search & Filters -->
    <section class="mb-6 space-y-4">
      <div class="relative">
        <input
          v-model="search"
          type="search"
          placeholder="Search by Style ID, name, or collection..."
          class="form-input w-full pl-10"
          @keyup.enter="($event.target as HTMLInputElement).blur()"
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-ash">
          🔍
        </span>
      </div>

      <div class="flex gap-2 flex-wrap items-center">
        <select
          v-model="selectedCollection"
          class="form-input py-2 px-3 text-sm"
        >
          <option value="">All Collections</option>
          <option v-for="c in collections" :key="c" :value="c">{{ c }}</option>
        </select>

        <select
          v-model="selectedType"
          class="form-input py-2 px-3 text-sm"
        >
          <option value="">All Types</option>
          <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>

        <select
          v-model="selectedSource"
          class="form-input py-2 px-3 text-sm"
        >
          <option value="">All Sources</option>
          <option v-for="s in sources" :key="s.id" :value="s.id">
            {{ s.name }} ({{ s.count.toLocaleString() }})
          </option>
        </select>

        <select
          v-model="selectedSort"
          class="form-input py-2 px-3 text-sm"
        >
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </section>

    <!-- Stats -->
    <section class="mb-6 flex items-center justify-between text-sm text-muted dark:text-ash">
      <span v-if="charmsTotal > 0">
        Showing {{ displayedCharms.length.toLocaleString() }} of {{ charmsTotal.toLocaleString() }} products
      </span>
      <span v-else-if="loading">Loading...</span>
      <span v-else>No products found</span>
    </section>

    <!-- Loading -->
    <div v-if="loading && charms.length === 0" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <button @click="handleSearch" class="btn btn-primary">Retry</button>
    </div>

    <!-- Charms Grid -->
    <section v-else-if="displayedCharms.length > 0">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <NuxtLink
          v-for="charm in displayedCharms"
          :key="charm.styleId"
          :to="`/database/${charm.styleId}`"
          class="bg-light-card dark:bg-dark-card rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all group"
        >
          <!-- Image -->
          <div class="aspect-square bg-light-bg-alt dark:bg-dark-elevated flex items-center justify-center overflow-hidden relative">
            <!-- Loading spinner -->
            <div
              v-if="charm.primaryImage && loadingImages.has(charm.styleId)"
              class="absolute inset-0 flex items-center justify-center z-10"
            >
              <div class="w-8 h-8 border-2 border-rose-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <img
              v-if="charm.primaryImage && !brokenImages.has(charm.styleId)"
              :src="getImageUrl(charm.primaryImage)"
              :alt="charm.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
              :class="{ 'opacity-0': loadingImages.has(charm.styleId) }"
              @load="handleImageLoad(charm.styleId)"
              @error="handleImageError(charm.styleId)"
            />
            <span v-if="!charm.primaryImage || brokenImages.has(charm.styleId)" class="text-5xl">💎</span>
          </div>

          <!-- Info -->
          <div class="p-3">
            <p class="text-xs text-rose-primary font-mono mb-1">{{ charm.styleId }}</p>
            <h3 class="font-display text-sm text-ink dark:text-pearl line-clamp-2 mb-1">
              {{ charm.name || 'Unknown' }}
            </h3>
            <p class="text-xs text-muted dark:text-ash">
              {{ charm.collection || 'Unknown Collection' }}
            </p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs font-medium text-ink dark:text-pearl">
                {{ formatPrice(charm.originalPrice, charm.currency) }}
              </span>
              <div class="flex gap-1 items-center">
                <span v-if="charm.isLimited" class="text-xs" title="Limited Edition">⭐</span>
                <span v-if="charm.isRetired" class="text-xs" title="Retired">🏷️</span>
                <span v-if="charm.verified" class="text-xs text-green-500" title="Verified">✓</span>
              </div>
            </div>
            <p v-if="charm.createdAt" class="text-[10px] text-muted dark:text-ash mt-1">
              First seen: {{ formatDate(charm.createdAt) }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMore" class="mt-8 text-center">
        <button
          @click="loadMore"
          :disabled="loadingMore"
          class="btn btn-secondary px-8"
        >
          {{ loadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </section>

    <!-- Empty State -->
    <section v-else class="text-center py-16">
      <div class="text-6xl mb-4">📚</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
        No products found
      </h2>
      <p class="text-muted dark:text-ash mb-6">
        Try adjusting your search or filters
      </p>
      <NuxtLink to="/database/contribute" class="btn btn-primary">
        Contribute Data
      </NuxtLink>
    </section>

    <!-- Contribute CTA -->
    <section class="mt-12 bg-rose-pale dark:bg-rose-glow rounded-lg p-6 text-center">
      <h2 class="font-display text-xl text-ink dark:text-pearl mb-2">
        Help Build Our Database
      </h2>
      <p class="text-muted dark:text-ash text-sm mb-4">
        Know a product that's missing? Have catalog pages to share?
      </p>
      <div class="flex gap-3 justify-center flex-wrap">
        <NuxtLink to="/database/contribute" class="btn btn-primary">
          Add a Product
        </NuxtLink>
      </div>
    </section>
    </template>

    <!-- CATALOGS TAB -->
    <template v-else>
      <!-- Loading -->
      <div v-if="catalogLoading" class="flex items-center justify-center h-64">
        <div class="text-rose-primary text-xl">Loading catalogs...</div>
      </div>

      <!-- Error -->
      <div v-else-if="catalogError" class="text-center py-12">
        <p class="text-red-500 mb-4">{{ catalogError }}</p>
        <button @click="fetchCatalogs" class="btn btn-primary">Retry</button>
      </div>

      <!-- Catalogs Grid -->
      <section v-else-if="Object.keys(groupedCatalogs).length > 0" class="space-y-8">
        <div v-for="(pages, catalogName) in groupedCatalogs" :key="catalogName">
          <h2 class="font-display text-xl text-ink dark:text-pearl mb-4">
            {{ catalogName }}
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <a
              v-for="page in pages"
              :key="page.id"
              :href="page.imageUrl"
              target="_blank"
              class="bg-light-card dark:bg-dark-card rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all"
            >
              <div class="aspect-[3/4] bg-light-bg-alt dark:bg-dark-elevated flex items-center justify-center overflow-hidden">
                <img
                  v-if="page.imageUrl"
                  :src="page.imageUrl"
                  :alt="`${catalogName} - Page ${page.pageNumber}`"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-5xl">📖</span>
              </div>
              <div class="p-3">
                <p class="text-sm font-medium text-ink dark:text-pearl">
                  Page {{ page.pageNumber || '?' }}
                </p>
                <p class="text-xs text-muted dark:text-ash">
                  {{ page.year }} {{ page.season || '' }} {{ page.region || '' }}
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <section v-else class="text-center py-16">
        <div class="text-6xl mb-4">📖</div>
        <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
          No catalogs yet
        </h2>
        <p class="text-muted dark:text-ash mb-6">
          Be the first to contribute catalog pages!
        </p>
        <NuxtLink to="/database/contribute" class="btn btn-primary">
          Upload Catalog Pages
        </NuxtLink>
      </section>
    </template>
  </div>
</template>
