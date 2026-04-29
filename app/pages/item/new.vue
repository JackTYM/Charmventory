<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useItems } from '~/composables/useItems'
import { useUpload } from '~/composables/useUpload'
import { useDataApi } from '~/composables/useDataApi'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { createItem, addImage } = useItems()
const { uploadImage } = useUpload()
const { from } = useDataApi()

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.name-search-container')) {
    showSearchResults.value = false
  }
}

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (searchTimeout) clearTimeout(searchTimeout)
})

const itemTypes = [
  { value: 'charm', label: 'Charm' },
  { value: 'clip', label: 'Clip' },
  { value: 'murano', label: 'Murano Glass' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'bangle', label: 'Bangle' },
  { value: 'safety_chain', label: 'Safety Chain' },
  { value: 'ring', label: 'Ring' },
  { value: 'earring', label: 'Earring' },
  { value: 'necklace', label: 'Necklace' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'watch', label: 'Watch' },
  { value: 'brooch', label: 'Brooch' },
  { value: 'keychain', label: 'Key Chain' },
  { value: 'ornament', label: 'Ornament' },
  { value: 'box', label: 'Box' },
  { value: 'catalogue', label: 'Catalog' },
  { value: 'other', label: 'Other' },
]

const conditions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

const sources = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'online_retail', label: 'Online Retail' },
  { value: 'secondhand', label: 'Secondhand' },
  { value: 'gift', label: 'Gift' },
  { value: 'trade', label: 'Trade' },
  { value: 'other', label: 'Other' },
]

const authenticOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

const hallmarkVisibility = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'not_visible', label: 'Not Visible' },
]

const hallmarkTypes = [
  { value: 'S925 ALE', label: 'S925 ALE (Sterling Silver)' },
  { value: 'G585 ALE', label: 'G585 ALE (14k Gold)' },
  { value: 'MET ALE', label: 'MET ALE (Metal Alloy)' },
  { value: 'ALE R', label: 'ALE R (Rose Gold Plated)' },
  { value: 'other', label: 'Other' },
]

const colorOptions = [
  { value: 'Silver', label: 'Silver' },
  { value: 'Gold', label: 'Gold' },
  { value: 'Rose Gold', label: 'Rose Gold' },
  { value: 'Black', label: 'Black' },
  { value: 'White', label: 'White' },
  { value: 'Pink', label: 'Pink' },
  { value: 'Blue', label: 'Blue' },
  { value: 'Green', label: 'Green' },
  { value: 'Purple', label: 'Purple' },
  { value: 'Red', label: 'Red' },
  { value: 'Orange', label: 'Orange' },
  { value: 'Yellow', label: 'Yellow' },
  { value: 'Clear', label: 'Clear' },
  { value: 'Multi-color', label: 'Multi-color' },
  { value: 'other', label: 'Other' },
]

// Field visibility based on item type
const typeFields = computed(() => {
  const type = form.type

  // Non-jewelry collectibles
  const isCollectible = ['box', 'catalogue', 'gift_with_purchase'].includes(type)

  // Murano/glass specific
  const isMurano = type === 'murano'

  // Charms and attachables
  const isAttachable = ['charm', 'clip', 'murano', 'safety_chain', 'pendant'].includes(type)

  return {
    // Details section
    showMaterials: !isCollectible,
    showColor: true,
    showWeight: !isCollectible,
    showHallmark: !isCollectible,

    // Collectible-specific
    showEdition: isCollectible && type === 'catalogue',
    showYear: type === 'catalogue',

    // Jewelry-specific
    showAuthentication: !isCollectible,
    showWarranty: !isCollectible,
  }
})

// Form data
const form = reactive({
  type: 'charm',
  name: '',
  brand: 'Pandora',
  itemNumber: '',
  collection: '',
  description: '',
  materials: '',
  color: '',
  colorOther: '',
  collaboration: '',
  catalogueRelease: '',
  hallmarkVisibility: '',
  hallmarkType: '',
  hallmarkTypeOther: '',
  originalPrice: null as number | null,
  pricePaid: null as number | null,
  currentValue: null as number | null,
  amountOnHand: 1,
  condition: 'new',
  damageNotes: '',
  rarity: 1,
  isLimited: false,
  isCountryExclusive: false,
  countryExclusive: '',
  isGiftWithPurchase: false,
  isNumberedGwp: false,
  gwpNumber: '',
  weightGrams: null as number | null,
  size: '',
  isAuthentic: 'unknown',
  authenticationStatus: '',
  authenticatedBy: '',
  source: '',
  sourceName: '',
  datePurchased: '',
  warrantyEnd: '',
  warrantyContact: '',
  carePlanEnd: '',
  carePlanYears: null as number | null,
  notes: '',
  isForSale: false,
  isForTrade: false,
  askingPrice: null as number | null,
})

const loading = ref(false)
const error = ref('')

// Database suggestion
const dbSuggestion = ref<{
  name?: string
  releaseDate?: string
  originalPrice?: number
  collection?: string
  type?: string
  materials?: string
  isLimited?: boolean
} | null>(null)
const lookingUp = ref(false)

// Search by name feature
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searchLoading = ref(false)
const showSearchResults = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

async function handleNameSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }

  searchTimeout = setTimeout(async () => {
    searchLoading.value = true
    try {
      const { data } = await from('charm_browse')
        .select('style_id, name, brand, collection, type, original_price, currency, primary_image, is_limited')
        .or(`name.ilike.%${searchQuery.value}%,style_id.ilike.%${searchQuery.value}%`)
        .not('primary_image', 'is', null)
        .limit(10)

      searchResults.value = (data || []).map((charm: any) => ({
        styleId: charm.style_id,
        name: charm.name,
        brand: charm.brand || 'Pandora',
        collection: charm.collection,
        type: charm.type,
        originalPrice: charm.original_price ? parseFloat(String(charm.original_price)) : null,
        currency: charm.currency || 'USD',
        primaryImage: charm.primary_image,
        isLimited: charm.is_limited || false,
      }))
      showSearchResults.value = true
    } catch (e) {
      console.error('Search failed:', e)
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

function selectFromSearch(charm: any) {
  form.itemNumber = charm.styleId || ''
  form.name = charm.name || ''
  form.brand = charm.brand || 'Pandora'
  form.collection = charm.collection || ''
  if (charm.type) form.type = charm.type
  form.originalPrice = charm.originalPrice || null
  form.isLimited = charm.isLimited || false

  showSearchResults.value = false
  searchQuery.value = ''
}

function clearNameSearch() {
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
}

// Debounced lookup for style ID
let lookupTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => form.itemNumber, (styleId) => {
  if (lookupTimeout) clearTimeout(lookupTimeout)
  dbSuggestion.value = null

  if (!styleId || styleId.length < 3) return

  lookupTimeout = setTimeout(async () => {
    lookingUp.value = true
    try {
      // Check charm_database first
      const { data: dbEntry } = await from('charm_database')
        .select('name, release_date, original_price, collection, type, materials, is_limited')
        .eq('style_id', styleId)
        .single()

      if (dbEntry) {
        dbSuggestion.value = {
          name: dbEntry.name || undefined,
          releaseDate: dbEntry.release_date ? new Date(dbEntry.release_date).toISOString().split('T')[0] : undefined,
          originalPrice: dbEntry.original_price ? parseFloat(dbEntry.original_price) : undefined,
          collection: dbEntry.collection || undefined,
          type: dbEntry.type || undefined,
          materials: dbEntry.materials || undefined,
          isLimited: dbEntry.is_limited || undefined,
        }
      } else {
        // Fall back to charm_sightings for first seen data
        const { data: sighting } = await from('charm_sightings')
          .select('extracted_name, extracted_price, extracted_currency, year, season')
          .eq('style_id', styleId)
          .order('year', { ascending: true })
          .limit(1)
          .single()

        if (sighting) {
          const releaseYear = sighting.year
          const releaseSeason = sighting.season
          let releaseDate = undefined
          if (releaseYear) {
            // Approximate release date from year/season
            const monthMap: Record<string, string> = {
              'Spring': '03', 'Summer': '06', 'Autumn': '09', 'Fall': '09', 'Winter': '12'
            }
            const month = releaseSeason ? (monthMap[releaseSeason] || '01') : '01'
            releaseDate = `${releaseYear}-${month}-01`
          }

          dbSuggestion.value = {
            name: sighting.extracted_name || undefined,
            releaseDate,
            originalPrice: sighting.extracted_price && sighting.extracted_currency === 'USD'
              ? parseFloat(sighting.extracted_price)
              : undefined,
          }
        }
      }
    } catch {
      // Not found - no suggestion
    } finally {
      lookingUp.value = false
    }
  }, 500)
})

function applyDbSuggestion(field: 'name' | 'releaseDate' | 'originalPrice' | 'collection' | 'type' | 'materials' | 'isLimited') {
  if (!dbSuggestion.value) return

  switch (field) {
    case 'name':
      if (dbSuggestion.value.name) form.name = dbSuggestion.value.name
      break
    case 'releaseDate':
      if (dbSuggestion.value.releaseDate) form.catalogueRelease = dbSuggestion.value.releaseDate
      break
    case 'originalPrice':
      if (dbSuggestion.value.originalPrice) form.originalPrice = dbSuggestion.value.originalPrice
      break
    case 'collection':
      if (dbSuggestion.value.collection) form.collection = dbSuggestion.value.collection
      break
    case 'type':
      if (dbSuggestion.value.type) form.type = dbSuggestion.value.type
      break
    case 'materials':
      if (dbSuggestion.value.materials) form.materials = dbSuggestion.value.materials
      break
    case 'isLimited':
      if (dbSuggestion.value.isLimited !== undefined) form.isLimited = dbSuggestion.value.isLimited
      break
  }
}

function applyAllSuggestions() {
  if (!dbSuggestion.value) return
  if (dbSuggestion.value.name && !form.name) form.name = dbSuggestion.value.name
  if (dbSuggestion.value.releaseDate && !form.catalogueRelease) form.catalogueRelease = dbSuggestion.value.releaseDate
  if (dbSuggestion.value.originalPrice && !form.originalPrice) form.originalPrice = dbSuggestion.value.originalPrice
  if (dbSuggestion.value.collection && !form.collection) form.collection = dbSuggestion.value.collection
  if (dbSuggestion.value.type) form.type = dbSuggestion.value.type
  if (dbSuggestion.value.materials && !form.materials) form.materials = dbSuggestion.value.materials
  if (dbSuggestion.value.isLimited !== undefined) form.isLimited = dbSuggestion.value.isLimited
}

// Image upload
const imageFiles = ref<File[]>([])
const imageUrls = ref<string[]>([])

function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    imageFiles.value.push(...files)

    // Create preview URLs
    files.forEach(file => {
      imageUrls.value.push(URL.createObjectURL(file))
    })
  }
}

function removeImage(index: number) {
  imageFiles.value.splice(index, 1)
  URL.revokeObjectURL(imageUrls.value[index])
  imageUrls.value.splice(index, 1)
}

async function handleSubmit() {
  if (!form.name) {
    error.value = 'Item name is required'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Parse materials as array
    const materials = form.materials
      ? form.materials.split(',').map(m => m.trim()).filter(Boolean)
      : null

    // Combine hallmark fields
    let hallmarkVisible = null
    if (form.hallmarkVisibility && form.hallmarkVisibility !== 'not_visible') {
      const hallmarkType = form.hallmarkType === 'other' ? form.hallmarkTypeOther : form.hallmarkType
      hallmarkVisible = hallmarkType
        ? `${form.hallmarkVisibility} - ${hallmarkType}`
        : form.hallmarkVisibility
    } else if (form.hallmarkVisibility === 'not_visible') {
      hallmarkVisible = 'Not Visible'
    }

    // Handle color
    const color = form.color === 'other' ? form.colorOther : form.color

    // Create item
    const item = await createItem({
      ...form,
      materials,
      hallmarkVisible,
      color,
    })

    // Upload images and attach to item
    if (imageFiles.value.length > 0 && item) {
      for (const file of imageFiles.value) {
        const url = await uploadImage(file, 'items')
        await addImage(item.id, url, 'item')
      }
    }

    // Redirect to the new item's detail page
    await navigateTo(`/item/${item.id}`)
  } catch (e: any) {
    error.value = e.message || 'Failed to create item'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Loading State -->
    <div v-if="authLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink to="/catalog" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          ← Back to Catalog
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">
          Add New Item
        </h1>
      </section>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Search by Name -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card name-search-container">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-2">Quick Search</h3>
          <p class="text-sm text-muted dark:text-ash mb-4">
            Search for a charm by name to auto-fill details, or enter manually below.
          </p>

          <div class="relative">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by name or style ID..."
                class="form-input pr-10"
                @input="handleNameSearch"
                @focus="showSearchResults = searchResults.length > 0"
              />
              <div v-if="searchLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                <svg class="animate-spin h-5 w-5 text-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <button
                v-else-if="searchQuery"
                type="button"
                @click="clearNameSearch"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink dark:hover:text-pearl"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Search Results Dropdown -->
            <div
              v-if="showSearchResults && searchResults.length > 0"
              class="absolute z-20 w-full mt-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-lg max-h-80 overflow-y-auto"
            >
              <button
                v-for="charm in searchResults"
                :key="charm.styleId"
                type="button"
                @click="selectFromSearch(charm)"
                class="w-full p-3 flex items-center gap-3 hover:bg-light-bg dark:hover:bg-dark-bg text-left border-b border-light-border dark:border-dark-border last:border-b-0 transition-colors"
              >
                <img
                  v-if="charm.primaryImage"
                  :src="charm.primaryImage"
                  :alt="charm.name"
                  class="w-12 h-12 object-cover rounded-md flex-shrink-0"
                />
                <div v-else class="w-12 h-12 bg-light-bg dark:bg-dark-bg rounded-md flex items-center justify-center flex-shrink-0">
                  <span class="text-muted text-xs">No img</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-ink dark:text-pearl truncate">{{ charm.name }}</p>
                  <p class="text-sm text-muted dark:text-ash">
                    <span class="font-mono">{{ charm.styleId }}</span>
                    <span v-if="charm.collection" class="ml-2">{{ charm.collection }}</span>
                  </p>
                </div>
              </button>
            </div>

            <!-- No Results -->
            <div
              v-else-if="showSearchResults && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0"
              class="absolute z-20 w-full mt-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-lg p-4 text-center text-muted dark:text-ash"
            >
              No charms found in database. Enter details manually below.
            </div>
          </div>
        </section>

        <!-- Images -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Photos</h3>

          <div class="grid grid-cols-3 gap-3 mb-4">
            <div
              v-for="(url, i) in imageUrls"
              :key="i"
              class="aspect-square rounded-lg overflow-hidden relative"
            >
              <img :src="url" class="w-full h-full object-cover" />
              <button
                type="button"
                @click="removeImage(i)"
                class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs"
              >
                x
              </button>
            </div>

            <label class="aspect-square rounded-lg border-2 border-dashed border-light-border dark:border-dark-border flex items-center justify-center cursor-pointer hover:border-rose-primary transition-colors">
              <span class="text-2xl text-muted dark:text-ash">+</span>
              <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleImageSelect"
              />
            </label>
          </div>
        </section>

        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Basic Info</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Type *</label>
            <select v-model="form.type" class="form-input">
              <option v-for="t in itemTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Name *</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="e.g., Cinderella's Carriage" required />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Brand</label>
              <input v-model="form.brand" type="text" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Item Number</label>
              <div class="relative">
                <input v-model="form.itemNumber" type="text" class="form-input" placeholder="Style ID" />
                <span v-if="lookingUp" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">...</span>
              </div>
            </div>
          </div>

          <!-- Database Suggestions -->
          <div v-if="dbSuggestion" class="p-3 bg-gold-primary/10 border border-gold-primary/30 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium text-ink dark:text-pearl">Found in Database</p>
              <button
                type="button"
                @click="applyAllSuggestions"
                class="text-xs px-2 py-1 bg-gold-primary/20 hover:bg-gold-primary/30 text-gold-primary rounded transition-colors"
              >
                Apply All
              </button>
            </div>
            <p class="text-xs text-muted dark:text-ash mb-2">Data may be incomplete or incorrect. Click to autofill.</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="dbSuggestion.name"
                type="button"
                @click="applyDbSuggestion('name')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.name === dbSuggestion.name ? 'ring-1 ring-green-500' : ''"
              >
                Name: {{ dbSuggestion.name }}
              </button>
              <button
                v-if="dbSuggestion.collection"
                type="button"
                @click="applyDbSuggestion('collection')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.collection === dbSuggestion.collection ? 'ring-1 ring-green-500' : ''"
              >
                Collection: {{ dbSuggestion.collection }}
              </button>
              <button
                v-if="dbSuggestion.type"
                type="button"
                @click="applyDbSuggestion('type')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.type === dbSuggestion.type ? 'ring-1 ring-green-500' : ''"
              >
                Type: {{ dbSuggestion.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }}
              </button>
              <button
                v-if="dbSuggestion.releaseDate"
                type="button"
                @click="applyDbSuggestion('releaseDate')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.catalogueRelease === dbSuggestion.releaseDate ? 'ring-1 ring-green-500' : ''"
              >
                Release: {{ dbSuggestion.releaseDate }}
              </button>
              <button
                v-if="dbSuggestion.originalPrice"
                type="button"
                @click="applyDbSuggestion('originalPrice')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.originalPrice === dbSuggestion.originalPrice ? 'ring-1 ring-green-500' : ''"
              >
                Price: ${{ dbSuggestion.originalPrice }}
              </button>
              <button
                v-if="dbSuggestion.materials"
                type="button"
                @click="applyDbSuggestion('materials')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.materials === dbSuggestion.materials ? 'ring-1 ring-green-500' : ''"
              >
                Materials: {{ dbSuggestion.materials }}
              </button>
              <button
                v-if="dbSuggestion.isLimited"
                type="button"
                @click="applyDbSuggestion('isLimited')"
                class="text-xs px-2 py-1 bg-light-bg dark:bg-dark-bg rounded hover:bg-rose-primary/10 transition-colors"
                :class="form.isLimited === dbSuggestion.isLimited ? 'ring-1 ring-green-500' : ''"
              >
                Limited Edition
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Collection</label>
            <input v-model="form.collection" type="text" class="form-input" placeholder="e.g., Moments, Disney" />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Description</label>
            <textarea v-model="form.description" class="form-input" rows="3" placeholder="Optional description"></textarea>
          </div>
        </section>

        <!-- Details -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Details</h3>

          <div class="grid grid-cols-2 gap-4">
            <div v-if="typeFields.showMaterials">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Materials</label>
              <input v-model="form.materials" type="text" class="form-input" placeholder="Silver, Enamel, CZ" />
              <p class="text-xs text-muted dark:text-ash mt-1">Comma separated</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Color</label>
              <select v-model="form.color" class="form-input">
                <option value="">Select...</option>
                <option v-for="c in colorOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
          </div>

          <div v-if="form.color === 'other'">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Specify Color</label>
            <input v-model="form.colorOther" type="text" class="form-input" placeholder="Enter color" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Collaboration</label>
              <input v-model="form.collaboration" type="text" class="form-input" placeholder="e.g., Disney, Harry Potter" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Catalogue Release</label>
              <input v-model="form.catalogueRelease" type="text" class="form-input" placeholder="e.g., Spring 2024" />
            </div>
          </div>

          <div v-if="typeFields.showWeight">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Weight (grams)</label>
            <input v-model="form.weightGrams" type="number" step="0.1" class="form-input" />
          </div>

          <div v-if="typeFields.showHallmark" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Hallmark Visibility</label>
                <select v-model="form.hallmarkVisibility" class="form-input">
                  <option value="">Select...</option>
                  <option v-for="h in hallmarkVisibility" :key="h.value" :value="h.value">{{ h.label }}</option>
                </select>
              </div>
              <div v-if="form.hallmarkVisibility && form.hallmarkVisibility !== 'not_visible'">
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Hallmark Type</label>
                <select v-model="form.hallmarkType" class="form-input">
                  <option value="">Select...</option>
                  <option v-for="h in hallmarkTypes" :key="h.value" :value="h.value">{{ h.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="form.hallmarkType === 'other'">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Specify Hallmark</label>
              <input v-model="form.hallmarkTypeOther" type="text" class="form-input" placeholder="Enter hallmark marking" />
            </div>
          </div>

          <div class="flex items-center gap-6 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isLimited" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Limited Edition</span>
            </label>
          </div>

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isCountryExclusive" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Country Exclusive</span>
            </label>
            <input
              v-if="form.isCountryExclusive"
              v-model="form.countryExclusive"
              type="text"
              class="form-input flex-1"
              placeholder="Which country?"
            />
          </div>

          <div class="flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isGiftWithPurchase" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Gift with Purchase</span>
            </label>
            <label v-if="form.isGiftWithPurchase" class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isNumberedGwp" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Numbered</span>
            </label>
            <input
              v-if="form.isGiftWithPurchase && form.isNumberedGwp"
              v-model="form.gwpNumber"
              type="text"
              class="form-input w-32"
              placeholder="e.g. 1234/5000"
            />
          </div>
        </section>

        <!-- Pricing & Value -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Pricing & Value</h3>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Original Price</label>
              <input v-model="form.originalPrice" type="number" step="0.01" class="form-input" placeholder="$" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Price Paid</label>
              <input v-model="form.pricePaid" type="number" step="0.01" class="form-input" placeholder="$" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Current Value</label>
              <input v-model="form.currentValue" type="number" step="0.01" class="form-input" placeholder="$" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Amount on Hand</label>
              <input v-model="form.amountOnHand" type="number" min="1" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Rarity</label>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted dark:text-ash">Common</span>
                <button
                  v-for="r in 3"
                  :key="r"
                  type="button"
                  @click="form.rarity = r"
                  class="text-2xl"
                  :class="r <= form.rarity ? 'text-gold-primary' : 'text-muted dark:text-ash'"
                >
                  ★
                </button>
                <span class="text-xs text-muted dark:text-ash">Rare</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Condition & Authenticity -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Condition</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Condition</label>
              <select v-model="form.condition" class="form-input">
                <option v-for="c in conditions" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
            <div v-if="typeFields.showAuthentication">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Authentic?</label>
              <select v-model="form.isAuthentic" class="form-input">
                <option v-for="a in authenticOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
              </select>
            </div>
          </div>

          <div v-if="form.condition !== 'new'">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Damage Notes</label>
            <textarea v-model="form.damageNotes" class="form-input" rows="2" placeholder="Describe any damage or wear"></textarea>
          </div>

          <div v-if="typeFields.showAuthentication && (form.isAuthentic === 'yes' || form.isAuthentic === 'no')">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Authenticated By</label>
            <input v-model="form.authenticatedBy" type="text" class="form-input" placeholder="Who verified?" />
          </div>
        </section>

        <!-- Purchase Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Purchase Info</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Source</label>
              <select v-model="form.source" class="form-input">
                <option value="">Select...</option>
                <option v-for="s in sources" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Seller/Store Name</label>
              <input v-model="form.sourceName" type="text" class="form-input" placeholder="Where you got it" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Date Purchased</label>
            <input v-model="form.datePurchased" type="date" class="form-input" />
          </div>
        </section>

        <!-- Warranty (only for jewelry) -->
        <section v-if="typeFields.showWarranty" class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Warranty & Care Plan</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Warranty End</label>
              <input v-model="form.warrantyEnd" type="date" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Warranty Contact</label>
              <input v-model="form.warrantyContact" type="text" class="form-input" placeholder="Store or phone" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Care Plan End</label>
              <input v-model="form.carePlanEnd" type="date" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Care Plan Years</label>
              <input v-model="form.carePlanYears" type="number" class="form-input" />
            </div>
          </div>
        </section>

        <!-- Listing -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Listing Options</h3>

          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isForSale" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">For Sale</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isForTrade" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">For Trade</span>
            </label>
          </div>

          <div v-if="form.isForSale">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Asking Price</label>
            <input v-model="form.askingPrice" type="number" step="0.01" class="form-input" placeholder="$" />
          </div>
        </section>

        <!-- Notes -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Notes</h3>
          <textarea v-model="form.notes" class="form-input" rows="3" placeholder="Any additional notes..."></textarea>
        </section>

        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'Saving...' : 'Add Item' }}
        </button>
      </form>
    </template>
  </div>
</template>
