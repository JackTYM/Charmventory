<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useWishlist } from '~/composables/useWishlist'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { wishlistItems, fetchWishlist, loading: wishlistLoading, deleteWishlistItem } = useWishlist()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await fetchWishlist()
})

const priorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  }
  return labels[priority] || priority
}

// Get emoji for wishlist item
function getItemEmoji() {
  const emojis = ['💎', '💖', '🌙', '🌹', '🦋', '🔮', '🎀', '👑', '💍']
  return emojis[Math.floor(Math.random() * emojis.length)]
}

// Sort by priority
const sortedItems = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return [...wishlistItems.value].sort((a, b) =>
    (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) -
    (priorityOrder[b.priority as keyof typeof priorityOrder] || 1)
  )
})
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto">
    <!-- Loading State -->
    <div v-if="authLoading || wishlistLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl">
          Wishlist
        </h1>
        <p class="text-muted dark:text-ash text-sm">
          {{ wishlistItems.length }} Dreams Pending
        </p>
      </section>

      <!-- Wishlist Items -->
      <section v-if="sortedItems.length > 0" class="space-y-3">
        <NuxtLink
          v-for="item in sortedItems"
          :key="item.id"
          :to="`/wishlist/${item.id}/edit`"
          class="bg-light-card dark:bg-dark-card rounded-lg p-4 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-all cursor-pointer block"
        >
          <!-- Image -->
          <div class="w-16 h-16 lg:w-20 lg:h-20 rounded-lg bg-light-bg-alt dark:bg-dark-elevated flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              v-if="item.images?.length > 0"
              :src="item.images[0].url"
              :alt="item.name"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-3xl lg:text-4xl">{{ getItemEmoji() }}</span>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <h3 class="font-display text-base lg:text-lg text-ink dark:text-pearl line-clamp-1">
              {{ item.name }}
            </h3>
            <p v-if="item.notes" class="text-xs text-muted dark:text-ash line-clamp-1">
              {{ item.notes }}
            </p>
            <div class="flex items-center gap-3 mt-2">
              <span class="font-medium text-ink dark:text-pearl">
                {{ item.estimatedPrice ? `Est. $${item.estimatedPrice}` : 'TBD' }}
              </span>
              <span class="text-xs text-muted dark:text-ash">
                Qty: {{ item.quantityWanted }}
              </span>
              <span v-if="item.links?.length" class="text-xs text-rose-primary">
                {{ item.links.length }} link{{ item.links.length > 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <!-- Priority Badge & Actions -->
          <div class="flex flex-col items-end gap-2">
            <span
              class="badge"
              :class="{
                'badge-high': item.priority === 'high',
                'badge-medium': item.priority === 'medium',
                'badge-low': item.priority === 'low',
              }"
            >
              {{ priorityLabel(item.priority) }}
            </span>
            <a
              v-if="item.links?.length"
              :href="item.links[0].url"
              target="_blank"
              class="text-muted dark:text-ash hover:text-rose-primary transition-colors"
              @click.stop
            >
              🔍
            </a>
          </div>
        </NuxtLink>
      </section>

      <!-- Empty State -->
      <section v-else class="text-center py-16">
        <div class="mb-4 flex justify-center">
          <svg class="w-20 h-20" viewBox="0 0 64 64" fill="none">
            <!-- Large sparkle -->
            <path d="M32 8L35 24L32 40L29 24L32 8Z" fill="#D4AF37"/>
            <path d="M16 24L32 27L48 24L32 21L16 24Z" fill="#D4AF37"/>
            <!-- Small sparkle top right -->
            <path d="M48 4L49.5 10L48 16L46.5 10L48 4Z" fill="#C9A227" opacity="0.8"/>
            <path d="M42 10L48 11L54 10L48 9L42 10Z" fill="#C9A227" opacity="0.8"/>
            <!-- Small sparkle bottom left -->
            <path d="M14 36L15.5 42L14 48L12.5 42L14 36Z" fill="#B8962E" opacity="0.6"/>
            <path d="M8 42L14 43L20 42L14 41L8 42Z" fill="#B8962E" opacity="0.6"/>
          </svg>
        </div>
        <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
          Your wishlist is empty
        </h2>
        <p class="text-muted dark:text-ash mb-6">
          Start dreaming! Add charms you'd love to find.
        </p>
        <NuxtLink to="/wishlist/new" class="btn btn-primary">
          Add First Item
        </NuxtLink>
      </section>

      <!-- FAB -->
      <NuxtLink
        to="/wishlist/new"
        class="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 w-14 h-14 bg-rose-primary text-white rounded-full shadow-rose hover:shadow-rose-hover hover:-translate-y-1 transition-all flex items-center justify-center text-2xl"
      >
        +
      </NuxtLink>
    </template>
  </div>
</template>
