<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useFeed } from '~/composables/useFeed'
import { useDataApi } from '~/composables/useDataApi'

const route = useRoute()
const { user: currentUser, isAuthenticated, checkSession } = useAuth()
const { posts, fetchPosts, clearPosts } = useFeed()
const { from } = useDataApi()

const profileId = computed(() => route.params.id as string)
const isOwnProfile = computed(() => currentUser.value?.id === profileId.value)

interface ProfileData {
  id: string
  name?: string
  avatar?: string
  bio?: string
  socialLinks?: Record<string, string>
  itemCount: number
  postCount: number
  joinedAt: string
  privacy: {
    collection: boolean
    wishlist: boolean
    forSale: boolean
  }
  items?: any[]
}

interface ForSaleItem {
  id: string
  user_id: string
  name: string
  item_number: string | null
  type: string | null
  is_for_sale: boolean
  is_for_trade: boolean
  asking_price: number | null
  primary_image: string | null
}

const profile = ref<ProfileData | null>(null)
const forSaleItems = ref<ForSaleItem[]>([])
const loading = ref(true)
const error = ref('')
const activeTab = ref<'posts' | 'collection' | 'forSale'>('posts')

onMounted(async () => {
  await checkSession()
  await loadProfile()
})

watch(profileId, async () => {
  await loadProfile()
})

async function loadProfile() {
  loading.value = true
  error.value = ''

  try {
    // Try to find user by slug first, then by ID
    let { data: users, error: userError } = await from('users')
      .select('id,name,avatar,bio,social_links,created_at')
      .eq('slug', profileId.value)
      .limit(1)

    if (!users?.length) {
      // Try by ID
      const result = await from('users')
        .select('id,name,avatar,bio,social_links,created_at')
        .eq('id', profileId.value)
        .limit(1)
      users = result.data
      userError = result.error
    }

    if (userError) throw new Error(userError.message)
    if (!users?.length) throw new Error('Profile not found')

    const userData = users[0]

    // Fetch privacy settings
    const { data: privacyData } = await from('profile_privacy')
      .select('*')
      .eq('user_id', userData.id)
      .limit(1)
    const privacy = privacyData?.[0] || {}

    // Fetch counts
    const { count: itemCount } = await from('items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)

    const { count: postCount } = await from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.id)

    // Parse social links
    let socialLinks = {}
    if (userData.social_links) {
      socialLinks = typeof userData.social_links === 'string'
        ? JSON.parse(userData.social_links)
        : userData.social_links
    }

    profile.value = {
      id: userData.id,
      name: userData.name,
      avatar: userData.avatar,
      bio: userData.bio,
      socialLinks,
      itemCount: itemCount || 0,
      postCount: postCount || 0,
      joinedAt: userData.created_at,
      privacy: {
        collection: privacy.show_collection !== false,
        wishlist: privacy.show_wishlist !== false,
        forSale: privacy.show_for_sale !== false,
      },
      items: [],
    }

    // Load user's posts
    clearPosts()
    await fetchPosts({ userId: userData.id })

    // Load for-sale/for-trade items (only for other users' profiles)
    if (!isOwnProfile.value && profile.value?.privacy.forSale) {
      await loadForSaleItems(userData.id)
    }
  } catch (e: any) {
    error.value = e.message || 'Profile not found'
  } finally {
    loading.value = false
  }
}

async function loadForSaleItems(userId: string) {
  try {
    const { data, error: fetchError } = await from('items_for_sale_public')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (fetchError) {
      console.error('Error fetching for-sale items:', fetchError)
      return
    }

    forSaleItems.value = data || []
  } catch (e) {
    console.error('Error loading for-sale items:', e)
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-16">
      <div class="text-6xl mb-4">😢</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
        {{ error }}
      </h2>
      <NuxtLink to="/feed" class="btn btn-secondary mt-4">
        Back to Feed
      </NuxtLink>
    </div>

    <template v-else-if="profile">
      <!-- Profile Header -->
      <section class="text-center mb-8">
        <div class="w-24 h-24 mx-auto rounded-full bg-rose-pale dark:bg-rose-glow flex items-center justify-center text-rose-primary text-3xl font-display mb-4">
          <img v-if="profile.avatar" :src="profile.avatar" class="w-full h-full rounded-full object-cover" />
          <span v-else>{{ profile.name?.charAt(0) || '?' }}</span>
        </div>

        <h1 class="font-display text-2xl text-ink dark:text-pearl mb-1">
          {{ profile.name || 'Collector' }}
        </h1>

        <p v-if="profile.bio" class="text-muted dark:text-ash text-sm mb-3">
          {{ profile.bio }}
        </p>

        <p class="text-xs text-muted dark:text-ash">
          Joined {{ formatDate(profile.joinedAt) }}
        </p>

        <!-- Stats -->
        <div class="flex justify-center gap-8 mt-6">
          <div class="text-center">
            <div class="font-display text-xl text-ink dark:text-pearl">{{ profile.postCount }}</div>
            <div class="text-xs text-muted dark:text-ash">Posts</div>
          </div>
        </div>

        <!-- Edit Profile Button -->
        <NuxtLink
          v-if="isOwnProfile"
          to="/settings/profile"
          class="btn btn-secondary mt-6"
        >
          Edit Profile
        </NuxtLink>
      </section>

      <!-- Tabs -->
      <section class="mb-6">
        <div class="flex border-b border-light-border dark:border-dark-border">
          <button
            @click="activeTab = 'posts'"
            class="flex-1 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'posts'
              ? 'text-rose-primary border-b-2 border-rose-primary'
              : 'text-muted dark:text-ash'"
          >
            Posts
          </button>
          <button
            v-if="!isOwnProfile && forSaleItems.length > 0"
            @click="activeTab = 'forSale'"
            class="flex-1 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'forSale'
              ? 'text-rose-primary border-b-2 border-rose-primary'
              : 'text-muted dark:text-ash'"
          >
            For Sale/Trade ({{ forSaleItems.length }})
          </button>
        </div>
      </section>

      <!-- Tab Content: Posts -->
      <section v-if="activeTab === 'posts'">
        <div v-if="posts.length === 0" class="text-center py-12 text-muted dark:text-ash">
          No posts yet
        </div>

        <div v-else class="grid grid-cols-3 gap-1">
          <NuxtLink
            v-for="post in posts"
            :key="post.id"
            :to="`/post/${post.id}`"
            class="aspect-square bg-light-bg-alt dark:bg-dark-elevated"
          >
            <img
              v-if="post.images[0]"
              :src="post.images[0].url"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-muted dark:text-ash">
              <span class="text-xs p-2 text-center line-clamp-3">{{ post.content }}</span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Tab Content: For Sale/Trade -->
      <section v-if="activeTab === 'forSale' && !isOwnProfile">
        <div v-if="forSaleItems.length === 0" class="text-center py-12 text-muted dark:text-ash">
          No items for sale or trade
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div
            v-for="item in forSaleItems"
            :key="item.id"
            class="bg-light-bg-alt dark:bg-dark-elevated rounded-lg overflow-hidden shadow-sm"
          >
            <!-- Item Image -->
            <div class="aspect-square bg-light-bg dark:bg-dark-surface">
              <img
                v-if="item.primary_image"
                :src="item.primary_image"
                :alt="item.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-muted dark:text-ash">
                <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <!-- Item Details -->
            <div class="p-3">
              <h3 class="font-medium text-sm text-ink dark:text-pearl line-clamp-2 mb-1">
                {{ item.name }}
              </h3>

              <p v-if="item.item_number" class="text-xs text-muted dark:text-ash mb-2">
                {{ item.item_number }}
              </p>

              <!-- Status Badges -->
              <div class="flex flex-wrap gap-1 mb-2">
                <span
                  v-if="item.is_for_sale"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                >
                  For Sale
                </span>
                <span
                  v-if="item.is_for_trade"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  For Trade
                </span>
              </div>

              <!-- Price -->
              <p v-if="item.is_for_sale && item.asking_price" class="text-sm font-semibold text-rose-primary">
                ${{ item.asking_price.toFixed(2) }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
