<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useItems } from '~/composables/useItems'
import { useWishlist } from '~/composables/useWishlist'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { items, fetchItems, loading: itemsLoading } = useItems()
const { wishlistItems, fetchWishlist } = useWishlist()

const emit = defineEmits<{
  (e: 'unauthenticated'): void
}>()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    emit('unauthenticated')
    return
  }
  await Promise.all([fetchItems(), fetchWishlist()])
})

// Computed stats
const stats = computed(() => {
  const totalValue = items.value.reduce((sum, item) => {
    const value = item.currentValue || item.pricePaid || item.originalPrice || 0
    return sum + (typeof value === 'number' ? value : parseFloat(value) || 0)
  }, 0)

  const rareCount = items.value.filter(item => item.rarity >= 3).length

  return [
    { label: 'Total Charms', value: items.value.length.toString(), variant: 'default' },
    { label: 'Collection Value', value: `$${totalValue.toLocaleString()}`, variant: 'rose' },
    { label: 'Rare Pieces', value: rareCount.toString(), variant: 'gold' },
    { label: 'Wishlisted', value: wishlistItems.value.length.toString(), variant: 'default' },
  ]
})

const recentItems = computed(() => {
  return items.value.slice(0, 4)
})

const rarityBreakdown = computed(() => {
  const counts = { 3: 0, 2: 0, 1: 0 }
  items.value.forEach(item => {
    const rarity = Math.min(3, Math.max(1, item.rarity || 1))
    counts[rarity as 1 | 2 | 3]++
  })
  return [
    { stars: 3, count: counts[3] },
    { stars: 2, count: counts[2] },
    { stars: 1, count: counts[1] },
  ]
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
  return { type: 'emoji', value: typeEmojis[item.type] || '💎' }
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto">
    <!-- Loading State -->
    <div v-if="authLoading || itemsLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Welcome Section -->
      <section class="mb-8">
        <p class="text-muted dark:text-ash text-sm mb-1">Welcome back to your</p>
        <h1 class="font-display text-4xl lg:text-5xl">
          <span class="text-gradient-rose italic">Collection</span>
        </h1>
      </section>

      <!-- Stats Grid -->
      <section class="mb-8">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="stat-card"
          >
            <div
              class="stat-value"
              :class="{
                'stat-value-rose': stat.variant === 'rose',
                'stat-value-gold': stat.variant === 'gold',
              }"
            >
              {{ stat.value }}
            </div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </section>

      <!-- Rarity Breakdown -->
      <section class="mb-8 p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-card text-center">
        <h3 class="text-sm uppercase tracking-wider text-muted dark:text-ash mb-4">Rarity Breakdown</h3>
        <div class="flex items-center justify-center gap-6">
          <div
            v-for="tier in rarityBreakdown"
            :key="tier.stars"
            class="flex items-center gap-2"
          >
            <div class="flex gap-0.5">
              <span
                v-for="i in 3"
                :key="i"
                class="star"
                :class="{ 'star-empty': i > tier.stars }"
              >
                ★
              </span>
            </div>
            <span class="font-medium text-ink dark:text-pearl">{{ tier.count }}</span>
          </div>
        </div>
      </section>

      <!-- Recently Added -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display text-xl lg:text-2xl text-ink dark:text-pearl">Recently Added</h2>
          <NuxtLink to="/catalog" class="btn-ghost text-sm">
            View All →
          </NuxtLink>
        </div>

        <!-- Empty State -->
        <div v-if="recentItems.length === 0" class="text-center py-16">
          <div class="mb-4 flex justify-center">
            <svg class="w-16 h-16" viewBox="0 0 64 64" fill="none">
              <path d="M32 8L35 24L32 40L29 24L32 8Z" fill="#D4AF37"/>
              <path d="M16 24L32 27L48 24L32 21L16 24Z" fill="#D4AF37"/>
              <path d="M48 4L49.5 10L48 16L46.5 10L48 4Z" fill="#C9A227" opacity="0.8"/>
              <path d="M42 10L48 11L54 10L48 9L42 10Z" fill="#C9A227" opacity="0.8"/>
              <path d="M14 36L15.5 42L14 48L12.5 42L14 36Z" fill="#B8962E" opacity="0.6"/>
              <path d="M8 42L14 43L20 42L14 41L8 42Z" fill="#B8962E" opacity="0.6"/>
            </svg>
          </div>
          <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
            Your collection is empty
          </h2>
          <p class="text-muted dark:text-ash mb-6">
            Start adding charms to build your collection.
          </p>
          <NuxtLink to="/catalog" class="btn btn-primary">
            Add Your First Charm
          </NuxtLink>
        </div>

        <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="item in recentItems"
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

      <!-- Database Link (visible on mobile where sidebar isn't shown) -->
      <section class="mt-8 lg:hidden">
        <a
          href="https://database.charmventory.com"
          class="block p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-card hover:shadow-md transition-shadow"
        >
          <div class="flex items-center gap-4">
            <div class="text-3xl">📚</div>
            <div class="flex-1">
              <h3 class="font-display text-lg text-ink dark:text-pearl">Pandora Database</h3>
              <p class="text-sm text-muted dark:text-ash">Browse Style IDs, catalogs & historical data</p>
            </div>
            <span class="text-rose-primary">→</span>
          </div>
        </a>
      </section>
    </template>
  </div>
</template>
