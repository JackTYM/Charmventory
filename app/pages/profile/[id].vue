<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useFeed } from '~/composables/useFeed'
import { useCharmDatabase } from '~/composables/useCharmDatabase'

const route = useRoute()
const { user: currentUser, isAuthenticated, checkSession } = useAuth()
const { posts, fetchPosts, clearPosts } = useFeed()

// Use anonymous client for public profile data
const { getClient } = useCharmDatabase()

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

const profile = ref<ProfileData | null>(null)
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
    const config = useRuntimeConfig()

    // Fetch user data using anonymous fetch (public data)
    const userResponse = await fetch(
      `${config.public.neonDataApiUrl}/users?id=eq.${profileId.value}&select=id,name,avatar,bio,social_links,created_at`,
      { headers: { 'Content-Type': 'application/json' } }
    )

    if (!userResponse.ok) throw new Error('Profile not found')

    const users = await userResponse.json()
    if (!users || users.length === 0) throw new Error('Profile not found')

    const userData = users[0]

    // Fetch privacy settings (public read)
    const privacyResponse = await fetch(
      `${config.public.neonDataApiUrl}/profile_privacy?user_id=eq.${profileId.value}`,
      { headers: { 'Content-Type': 'application/json' } }
    )
    const privacyData = privacyResponse.ok ? await privacyResponse.json() : []
    const privacy = privacyData[0] || {}

    // Fetch post count
    const postsResponse = await fetch(
      `${config.public.neonDataApiUrl}/posts?user_id=eq.${profileId.value}&select=id`,
      { headers: { 'Content-Type': 'application/json', 'Prefer': 'count=exact' } }
    )
    const postCount = parseInt(postsResponse.headers.get('content-range')?.split('/')[1] || '0')

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
      itemCount: 0, // Items are private via RLS, so we can't count them for other users
      postCount,
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
    await fetchPosts({ userId: profileId.value })
  } catch (e: any) {
    error.value = e.message || 'Profile not found'
  } finally {
    loading.value = false
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
    </template>
  </div>
</template>
