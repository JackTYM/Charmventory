<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useItems } from '~/composables/useItems'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { items, fetchItems, loading: itemsLoading } = useItems()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await fetchItems()
})

const filters = [
  { id: 'all', label: 'All' },
  { id: 'charm', label: 'Charms' },
  { id: 'murano', label: 'Murano' },
  { id: 'clip', label: 'Clips' },
  { id: 'bracelet', label: 'Bracelets' },
  { id: 'ring', label: 'Rings' },
  { id: 'limited', label: 'Limited Edition' },
]

const activeFilter = ref('all')
const sortOptions = ['Newest', 'Oldest', 'Price: High', 'Price: Low', 'Rarity', 'A-Z']
const activeSort = ref('Newest')
const searchQuery = ref('')

const filteredItems = computed(() => {
  let result = [...items.value]

  // Filter by type
  if (activeFilter.value !== 'all') {
    if (activeFilter.value === 'limited') {
      result = result.filter(item => item.isLimited)
    } else {
      result = result.filter(item => item.type === activeFilter.value)
    }
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.collection?.toLowerCase().includes(query) ||
      item.itemNumber?.toLowerCase().includes(query) ||
      item.brand?.toLowerCase().includes(query)
    )
  }

  // Sort
  switch (activeSort.value) {
    case 'Newest':
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      break
    case 'Oldest':
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      break
    case 'Price: High':
      result.sort((a, b) => (b.currentValue || b.pricePaid || 0) - (a.currentValue || a.pricePaid || 0))
      break
    case 'Price: Low':
      result.sort((a, b) => (a.currentValue || a.pricePaid || 0) - (b.currentValue || b.pricePaid || 0))
      break
    case 'Rarity':
      result.sort((a, b) => b.rarity - a.rarity)
      break
    case 'A-Z':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
  }

  return result
})

// Get first image or placeholder emoji based on item type
function getItemImage(item: any) {
  if (item.images?.length > 0) {
    return { type: 'url', value: item.images[0].url }
  }
  const typeEmojis: Record<string, string> = {
    charm: '💎',
    clip: '📎',
    murano: '🔮',
    safety_chain: '⛓️',
    earring: '💫',
    necklace: '📿',
    bracelet: '⭕',
    bangle: '🔵',
    ring: '💍',
    brooch: '🌸',
    pendant: '🎀',
    box: '📦',
    catalogue: '📖',
    gift_with_purchase: '🎁',
  }
  return { type: 'emoji', value: typeEmojis[item.type] || '✨' }
}

// Show add item modal
const showAddModal = ref(false)
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto">
    <!-- Loading State -->
    <div v-if="authLoading || itemsLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl text-center mb-2">
          My Catalog
        </h1>
        <p class="text-muted dark:text-ash text-center text-sm">{{ items.length }} Items</p>
      </section>

      <!-- Search -->
      <section class="mb-4">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, collection, item number..."
            class="form-input pl-10"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-ash">
            🔍
          </span>
        </div>
      </section>

      <!-- Filters -->
      <section class="mb-4 overflow-x-auto pb-2 -mx-4 px-4">
        <div class="flex gap-2 min-w-max">
          <button
            v-for="filter in filters"
            :key="filter.id"
            @click="activeFilter = filter.id"
            class="tag"
            :class="activeFilter === filter.id ? 'tag-active' : 'tag-default'"
          >
            {{ filter.label }}
          </button>
        </div>
      </section>

      <!-- Sort -->
      <section class="mb-6 flex items-center justify-between">
        <span class="text-sm text-muted dark:text-ash">
          {{ filteredItems.length }} items
        </span>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted dark:text-ash">Sort:</span>
          <select
            v-model="activeSort"
            class="form-input py-2 px-3 text-sm w-auto"
          >
            <option v-for="opt in sortOptions" :key="opt" :value="opt">
              {{ opt }}
            </option>
          </select>
        </div>
      </section>

      <!-- Empty State -->
      <section v-if="filteredItems.length === 0" class="text-center py-16">
        <div class="text-6xl mb-4">✨</div>
        <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
          {{ searchQuery || activeFilter !== 'all' ? 'No items found' : 'Your catalog is empty' }}
        </h2>
        <p class="text-muted dark:text-ash mb-6">
          {{ searchQuery || activeFilter !== 'all' ? 'Try adjusting your filters.' : 'Start adding charms to build your collection.' }}
        </p>
        <NuxtLink v-if="!searchQuery && activeFilter === 'all'" to="/item/new" class="btn btn-primary">
          Add Your First Item
        </NuxtLink>
      </section>

      <!-- Items Grid -->
      <section v-else>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="item in filteredItems"
            :key="item.id"
            :to="`/item/${item.id}`"
            class="card cursor-pointer"
          >
            <!-- Image -->
            <div class="aspect-square bg-gradient-to-br from-rose-pale to-light-bg-alt dark:from-dark-elevated dark:to-dark-card flex items-center justify-center relative overflow-hidden">
              <span
                v-if="item.collaboration"
                class="card-badge"
              >
                {{ item.collaboration }}
              </span>
              <span
                v-else-if="item.rarity >= 3"
                class="card-badge card-badge-gold"
              >
                Rare
              </span>
              <span
                v-else-if="item.isLimited"
                class="card-badge"
              >
                Limited
              </span>

              <img
                v-if="getItemImage(item).type === 'url'"
                :src="getItemImage(item).value"
                :alt="item.name"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-4xl lg:text-5xl opacity-70">{{ getItemImage(item).value }}</span>
            </div>

            <!-- Content -->
            <div class="p-4">
              <p class="text-[10px] uppercase tracking-wider text-rose-primary mb-1">
                {{ item.collection || item.brand }}
              </p>
              <h3 class="font-display text-base lg:text-lg text-ink dark:text-pearl mb-2 line-clamp-1">
                {{ item.name }}
              </h3>
              <div class="flex items-center justify-between pt-3 border-t border-light-border dark:border-dark-border">
                <span class="font-display text-ink dark:text-pearl">
                  ${{ Number(item.currentValue || item.pricePaid || 0).toFixed(2) }}
                </span>
                <div class="flex gap-0.5">
                  <span
                    v-for="i in 3"
                    :key="i"
                    class="star text-xs"
                    :class="{ 'star-empty': i > item.rarity }"
                  >
                    ★
                  </span>
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- FAB for adding items -->
      <NuxtLink
        to="/item/new"
        class="fixed bottom-28 lg:bottom-8 right-4 lg:right-8 z-50 w-14 h-14 bg-rose-primary text-white rounded-full shadow-rose hover:shadow-rose-hover hover:-translate-y-1 transition-all flex items-center justify-center text-2xl"
      >
        +
      </NuxtLink>
    </template>
  </div>
</template>
