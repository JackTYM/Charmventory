<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

import { useCharmDatabase } from '~/composables/useCharmDatabase'
import { useAuth } from '~/composables/useAuth'
import { getImageUrl } from '~/utils/imageUrl'

const route = useRoute()
const { getCharm, loading, error } = useCharmDatabase()
const { isAuthenticated } = useAuth()

const charm = ref<any>(null)
const styleId = route.params.styleId as string
const selectedRegion = ref('')
const initialLoading = ref(true)

onMounted(async () => {
  try {
    charm.value = await getCharm(styleId)
    // Default to US if available, otherwise first available price
    if (availablePrices.value.length > 0) {
      const usPrice = availablePrices.value.find(p => p.region === 'US')
      selectedRegion.value = usPrice?.region || availablePrices.value[0].region
    }
  } catch (e) {
    // Error handled by composable
  } finally {
    initialLoading.value = false
  }
})

// Extract unique prices by region from sightings
const availablePrices = computed(() => {
  if (!charm.value?.sightings) return []

  const pricesByRegion = new Map<string, { price: number; currency: string; region: string }>()

  for (const s of charm.value.sightings) {
    if (s.price && !pricesByRegion.has(s.region || 'US')) {
      pricesByRegion.set(s.region || 'US', {
        price: Number(s.price),
        currency: s.currency || 'USD',
        region: s.region || 'US',
      })
    }
  }

  // Also include the main charm price if available
  if (charm.value.originalPrice && !pricesByRegion.has(charm.value.region || 'US')) {
    pricesByRegion.set(charm.value.region || 'US', {
      price: Number(charm.value.originalPrice),
      currency: charm.value.currency || 'USD',
      region: charm.value.region || 'US',
    })
  }

  return Array.from(pricesByRegion.values())
})

// Get selected price info
const selectedPrice = computed(() => {
  return availablePrices.value.find(p => p.region === selectedRegion.value) || availablePrices.value[0]
})

// Get first seen date from sightings
const firstSeen = computed(() => {
  if (!charm.value?.sightings?.length) return null

  // Find earliest sighting by year, then by season
  const sorted = [...charm.value.sightings].sort((a, b) => {
    if (a.year !== b.year) return (a.year || 9999) - (b.year || 9999)
    // Q1 < Q2 < Q3 < Q4, Spring < Summer < Fall < Winter
    return 0
  })

  const earliest = sorted[0]
  if (!earliest) return null

  return {
    season: earliest.season,
    year: earliest.year,
    region: earliest.region,
  }
})

function formatPrice(price: number | null | undefined, currency = 'USD') {
  if (!price) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price)
}

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })
}

// Image gallery
const selectedImageIndex = ref(0)
const selectedImage = computed(() => {
  if (!charm.value?.images?.length) return null
  return charm.value.images[selectedImageIndex.value]?.url
})

function selectImage(index: number) {
  selectedImageIndex.value = index
}

// Track broken images
const brokenImages = ref(new Set<number>())
function handleImageError(index: number) {
  brokenImages.value.add(index)
  // If current image broke, try to select next working one
  if (index === selectedImageIndex.value) {
    const nextWorking = charm.value?.images?.findIndex((_: any, i: number) => !brokenImages.value.has(i))
    if (nextWorking !== undefined && nextWorking >= 0) {
      selectedImageIndex.value = nextWorking
    }
  }
}

// Filter out broken images from display
const workingImages = computed(() => {
  if (!charm.value?.images) return []
  return charm.value.images.filter((_: any, i: number) => !brokenImages.value.has(i))
})

const typeLabels: Record<string, string> = {
  charm: 'Charm',
  clip: 'Clip',
  murano: 'Murano Glass',
  safety_chain: 'Safety Chain',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  bangle: 'Bangle',
  ring: 'Ring',
  brooch: 'Brooch',
  pendant: 'Pendant',
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto pb-24">
    <!-- Loading -->
    <div v-if="loading || initialLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error || !charm" class="text-center py-12">
      <div class="text-6xl mb-4">😢</div>
      <p class="text-red-500 mb-4">{{ error || 'Product not found' }}</p>
      <NuxtLink to="/database" class="btn btn-primary">Back to Database</NuxtLink>
    </div>

    <!-- Charm Detail -->
    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink to="/database" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          &larr; Back to Database
        </NuxtLink>
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-rose-primary font-mono text-sm mb-1">{{ charm.styleId }}</p>
            <h1 class="font-display text-3xl text-ink dark:text-pearl">{{ charm.name }}</h1>
            <p class="text-muted dark:text-ash">
              {{ typeLabels[charm.type] || charm.type }} &bull; {{ charm.brand }}
            </p>
          </div>
          <div class="flex gap-2">
            <span v-if="charm.verified" class="badge badge-low">Verified</span>
            <span v-if="charm.isLimited" class="badge badge-medium">Limited</span>
            <span v-if="charm.isRetired" class="badge badge-high">Retired</span>
          </div>
        </div>
      </section>

      <!-- Images -->
      <section v-if="workingImages.length > 0" class="mb-8">
        <div class="aspect-square max-w-md mx-auto rounded-lg overflow-hidden bg-light-card dark:bg-dark-card">
          <img
            :src="getImageUrl(selectedImage || workingImages[0]?.url)"
            :alt="charm.name"
            class="w-full h-full object-cover"
            @error="handleImageError(selectedImageIndex)"
          />
        </div>
        <div v-if="workingImages.length > 1" class="flex gap-2 mt-4 justify-center overflow-x-auto">
          <div
            v-for="(img, i) in workingImages"
            :key="img.id || i"
            @click="selectedImageIndex = charm.images.indexOf(img)"
            class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer border-2 hover:border-rose-light transition-colors"
            :class="charm.images.indexOf(img) === selectedImageIndex ? 'border-rose-primary' : 'border-transparent'"
          >
            <img :src="getImageUrl(img.url)" class="w-full h-full object-cover" @error="handleImageError(charm.images.indexOf(img))" />
          </div>
        </div>
      </section>

      <!-- No Image -->
      <section v-else-if="!charm.images?.length || workingImages.length === 0" class="mb-8">
        <div class="aspect-square max-w-md mx-auto rounded-lg bg-light-card dark:bg-dark-card flex items-center justify-center">
          <span class="text-6xl">💎</span>
        </div>
      </section>

      <!-- Details Grid -->
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Details</h3>
          <dl class="space-y-3 text-sm">
            <div v-if="charm.collection" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Collection</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ charm.collection }}</dd>
            </div>
            <div v-if="charm.catalogueSeason" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Catalogue</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ charm.catalogueSeason }}</dd>
            </div>
            <div v-if="charm.materials?.length" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Materials</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ charm.materials.join(', ') }}</dd>
            </div>
            <div v-if="charm.colors?.length" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Colors</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ charm.colors.join(', ') }}</dd>
            </div>
            <div v-if="charm.isCountryExclusive" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Exclusive To</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ charm.exclusiveCountry || 'Unknown' }}</dd>
            </div>
          </dl>
        </section>

        <!-- Pricing & Dates -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Pricing & Dates</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between items-center">
              <dt class="text-muted dark:text-ash">Original Price</dt>
              <dd class="text-ink dark:text-pearl font-medium flex items-center gap-2">
                <template v-if="selectedPrice">
                  {{ formatPrice(selectedPrice.price, selectedPrice.currency) }}
                </template>
                <template v-else>-</template>
                <!-- Region switcher -->
                <select
                  v-if="availablePrices.length > 1"
                  v-model="selectedRegion"
                  class="ml-2 text-xs bg-light-bg-alt dark:bg-dark-elevated border border-light-border dark:border-dark-border rounded px-2 py-1"
                >
                  <option v-for="p in availablePrices" :key="p.region" :value="p.region">
                    {{ p.region }}
                  </option>
                </select>
                <span v-else-if="selectedPrice" class="text-xs text-muted dark:text-ash">({{ selectedPrice.region }})</span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">First Seen</dt>
              <dd class="text-ink dark:text-pearl font-medium">
                <template v-if="firstSeen">
                  {{ firstSeen.season }}<template v-if="firstSeen.year && !firstSeen.season?.includes(String(firstSeen.year))"> {{ firstSeen.year }}</template>
                  <span v-if="firstSeen.region" class="text-xs text-muted dark:text-ash">({{ firstSeen.region }})</span>
                </template>
                <template v-else>-</template>
              </dd>
            </div>
            <div v-if="charm.isRetired" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Retired</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatDate(charm.discontinueDate) }}</dd>
            </div>
          </dl>
        </section>

        <!-- Description -->
        <section v-if="charm.description" class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card md:col-span-2">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Description</h3>
          <p class="text-sm text-ink dark:text-pearl">{{ charm.description }}</p>
        </section>
      </div>

      <!-- Sources / Sightings -->
      <section v-if="charm.sightings?.length" class="mt-8 bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">
          Sources ({{ charm.sightings.length }})
        </h3>
        <ul class="divide-y divide-light-border dark:divide-dark-border">
          <li
            v-for="sighting in charm.sightings"
            :key="sighting.id"
            class="py-3 first:pt-0 last:pb-0"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-ink dark:text-pearl truncate">
                  {{ sighting.catalogName }}
                </p>
                <p class="text-xs text-muted dark:text-ash">
                  {{ sighting.season }} {{ sighting.year }}
                  <span v-if="sighting.region">&bull; {{ sighting.region }}</span>
                  <span v-if="sighting.price"> &bull; {{ formatPrice(sighting.price) }}</span>
                </p>
                <p v-if="sighting.name && sighting.name !== charm.name" class="text-xs text-muted dark:text-ash italic">
                  Listed as: "{{ sighting.name }}"
                </p>
              </div>
              <a
                v-if="sighting.sourceUrl"
                :href="sighting.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-rose-primary hover:underline flex-shrink-0"
              >
                View Source &rarr;
              </a>
            </div>
          </li>
        </ul>
      </section>

      <!-- Contribute CTA -->
      <section class="mt-8 bg-light-bg-alt dark:bg-dark-elevated rounded-lg p-5 text-center">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-2">Something missing or incorrect?</h3>
        <p class="text-sm text-muted dark:text-ash mb-4">Help improve this entry</p>
        <NuxtLink
          :to="`/database/contribute?styleId=${charm.styleId}`"
          class="btn btn-secondary"
        >
          Suggest Edit
        </NuxtLink>
      </section>
    </template>
  </div>
</template>
