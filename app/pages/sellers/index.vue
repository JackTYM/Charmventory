<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useSellers } from '~/composables/useSellers'

const { isAuthenticated, checkSession, user, loading: authLoading } = useAuth()
const {
  sellers,
  userLists,
  fetchSellers,
  fetchUserLists,
  reviewSeller,
  addToList,
  removeFromList,
  loading: sellersLoading
} = useSellers()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  await fetchSellers()
  if (isAuthenticated.value) {
    await fetchUserLists()
  }
})

const tabs = ['All', 'Preferred', 'Do Not Buy']
const activeTab = ref('All')

// Get user's relationship with seller
function getSellerStatus(sellerId: string) {
  const preferred = userLists.value.preferred.find(l => l.sellerId === sellerId)
  if (preferred) return { status: 'preferred', notes: preferred.notes }

  const doNotBuy = userLists.value.doNotBuy.find(l => l.sellerId === sellerId)
  if (doNotBuy) return { status: 'do_not_buy', notes: doNotBuy.notes }

  return null
}

// Check if user has reviewed this seller
function getUserReview(seller: any) {
  if (!user.value) return null
  return seller.reviews?.find((r: any) => r.userId === user.value?.id)
}

const filteredSellers = computed(() => {
  if (activeTab.value === 'All') return sellers.value
  if (activeTab.value === 'Preferred') {
    const preferredIds = new Set(userLists.value.preferred.map(l => l.sellerId))
    return sellers.value.filter(s => preferredIds.has(s.id))
  }
  if (activeTab.value === 'Do Not Buy') {
    const doNotBuyIds = new Set(userLists.value.doNotBuy.map(l => l.sellerId))
    return sellers.value.filter(s => doNotBuyIds.has(s.id))
  }
  return sellers.value
})

// Actions
async function handleVouch(sellerId: string) {
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await reviewSeller(sellerId, true)
}

async function handleWarn(sellerId: string) {
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await reviewSeller(sellerId, false)
}

async function handleAddToPreferred(sellerId: string) {
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await addToList(sellerId, 'preferred')
}

async function handleAddToDoNotBuy(sellerId: string) {
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await addToList(sellerId, 'do_not_buy')
}

async function handleRemoveFromList(sellerId: string) {
  await removeFromList(sellerId)
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto">
    <!-- Loading State -->
    <div v-if="authLoading || sellersLoading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl text-center">
          Source List
        </h1>
        <p class="text-muted dark:text-ash text-center text-sm mt-1">
          Community-vouched sources for charms
        </p>
      </section>

      <!-- Tabs -->
      <section v-if="isAuthenticated" class="mb-6">
        <div class="flex gap-2 justify-center">
          <button
            v-for="tab in tabs"
            :key="tab"
            @click="activeTab = tab"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all"
            :class="activeTab === tab
              ? 'bg-rose-primary text-white'
              : 'bg-light-bg-alt dark:bg-dark-elevated text-muted dark:text-ash hover:text-ink dark:hover:text-pearl'"
          >
            {{ tab }}
          </button>
        </div>
      </section>

      <!-- Sellers List -->
      <section v-if="filteredSellers.length > 0" class="space-y-4">
        <div
          v-for="seller in filteredSellers"
          :key="seller.id"
          class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card"
          :class="{
            'border-l-4 border-green-500': getSellerStatus(seller.id)?.status === 'preferred',
            'border-l-4 border-red-500': getSellerStatus(seller.id)?.status === 'do_not_buy',
          }"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="font-display text-lg text-ink dark:text-pearl">
                {{ seller.name }}
              </h3>
              <p class="text-xs text-muted dark:text-ash">
                <span v-if="seller.sourceType" class="inline-flex items-center gap-1 mr-2">
                  <span>{{ { authorized_retailer: '✓', reseller: '🔄', personal_shopper: '👤', private_seller: '🏠' }[seller.sourceType] }}</span>
                  <span>{{ { authorized_retailer: 'Authorized Retailer', reseller: 'Reseller', personal_shopper: 'Personal Shopper', private_seller: 'Private Seller' }[seller.sourceType] }}</span>
                  <span class="mx-1">·</span>
                </span>
                {{ seller.platform }}
              </p>
            </div>
            <span
              v-if="getSellerStatus(seller.id)"
              class="badge"
              :class="getSellerStatus(seller.id)?.status === 'preferred' ? 'badge-low' : 'badge-high'"
            >
              {{ getSellerStatus(seller.id)?.status === 'preferred' ? 'Preferred' : 'Do Not Buy' }}
            </span>
          </div>

          <!-- Notes if in user's list -->
          <blockquote
            v-if="getSellerStatus(seller.id)?.notes"
            class="text-sm text-muted dark:text-ash italic border-l-2 border-rose-primary pl-3 mb-4"
          >
            "{{ getSellerStatus(seller.id)?.notes }}"
          </blockquote>

          <!-- Footer -->
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-4 text-xs">
              <span class="text-green-600 dark:text-green-400">
                👍 {{ seller.vouchCount }} vouches
              </span>
              <span v-if="seller.warnCount > 0" class="text-red-600 dark:text-red-400">
                ⚠️ {{ seller.warnCount }} warnings
              </span>
            </div>

            <div class="flex items-center gap-2">
              <!-- Vouch/Warn buttons -->
              <template v-if="isAuthenticated">
                <button
                  v-if="!getUserReview(seller)"
                  @click="handleVouch(seller.id)"
                  class="btn btn-secondary text-xs py-2 px-3"
                >
                  👍 Vouch
                </button>
                <button
                  v-if="!getUserReview(seller)"
                  @click="handleWarn(seller.id)"
                  class="btn btn-secondary text-xs py-2 px-3"
                >
                  ⚠️ Warn
                </button>

                <!-- List actions -->
                <template v-if="!getSellerStatus(seller.id)">
                  <button
                    @click="handleAddToPreferred(seller.id)"
                    class="btn btn-secondary text-xs py-2 px-3"
                  >
                    + Preferred
                  </button>
                  <button
                    @click="handleAddToDoNotBuy(seller.id)"
                    class="btn btn-secondary text-xs py-2 px-3"
                  >
                    + DNB
                  </button>
                </template>
                <button
                  v-else
                  @click="handleRemoveFromList(seller.id)"
                  class="btn btn-secondary text-xs py-2 px-3"
                >
                  Remove
                </button>
              </template>

              <a
                v-if="seller.url"
                :href="seller.url"
                target="_blank"
                class="btn btn-secondary text-xs py-2 px-4"
              >
                Visit Shop
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State -->
      <section v-else class="text-center py-16">
        <div class="text-6xl mb-4">🏪</div>
        <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
          {{ activeTab === 'All' ? 'No sources yet' : `No sources in ${activeTab}` }}
        </h2>
        <p class="text-muted dark:text-ash mb-6">
          {{ activeTab === 'All' ? 'Be the first to add a source!' : 'Add sources to your list.' }}
        </p>
      </section>

      <!-- FAB -->
      <NuxtLink
        v-if="isAuthenticated"
        to="/sellers/new"
        class="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 w-14 h-14 bg-rose-primary text-white rounded-full shadow-rose hover:shadow-rose-hover hover:-translate-y-1 transition-all flex items-center justify-center text-2xl"
      >
        +
      </NuxtLink>
    </template>
  </div>
</template>
