<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useFeed } from '~/composables/useFeed'

const { isAuthenticated, checkSession, user, loading: authLoading } = useAuth()
const { posts, fetchPosts, deletePost, loading: feedLoading, hasMore, clearPosts } = useFeed()

const postToDelete = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const deleting = ref(false)

const postTypes = [
  { value: '', label: 'All Posts' },
  { value: 'new_charm', label: 'New Products' },
  { value: 'bracelet_build', label: 'Bracelet Builds' },
  { value: 'haul', label: 'Hauls' },
  { value: 'collection', label: 'Collections' },
]

const activeFilter = ref('')
const showNewPostModal = ref(false)

// Check auth on mount
onMounted(async () => {
  await checkSession()
  await fetchPosts()
})

// Watch filter changes
watch(activeFilter, async () => {
  clearPosts()
  await fetchPosts({ postType: activeFilter.value || undefined })
})

async function loadMore() {
  if (!hasMore.value || feedLoading.value) return
  await fetchPosts({
    offset: posts.value.length,
    postType: activeFilter.value || undefined,
  })
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getPostTypeLabel(type?: string) {
  if (!type) return ''
  const found = postTypes.find(t => t.value === type)
  return found?.label || type
}

function confirmDeletePost(postId: string) {
  postToDelete.value = postId
  showDeleteConfirm.value = true
}

async function handleDeletePost() {
  if (!postToDelete.value) return
  deleting.value = true
  try {
    await deletePost(postToDelete.value)
    showDeleteConfirm.value = false
    postToDelete.value = null
  } catch (e) {
    // Error handled in composable
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Header -->
    <section class="mb-6">
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl text-center mb-2">
        Community Feed
      </h1>
      <p class="text-muted dark:text-ash text-center text-sm">Share and discover collections</p>
    </section>

    <!-- Filters -->
    <section class="mb-6 overflow-x-auto pb-2 -mx-4 px-4">
      <div class="flex gap-2 min-w-max">
        <button
          v-for="filter in postTypes"
          :key="filter.value"
          @click="activeFilter = filter.value"
          class="tag"
          :class="activeFilter === filter.value ? 'tag-active' : 'tag-default'"
        >
          {{ filter.label }}
        </button>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="authLoading || (feedLoading && posts.length === 0)" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Empty State -->
    <section v-else-if="posts.length === 0" class="text-center py-16">
      <div class="text-6xl mb-4">📸</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
        No posts yet
      </h2>
      <p class="text-muted dark:text-ash mb-6">
        Be the first to share your collection!
      </p>
      <NuxtLink v-if="isAuthenticated" to="/post/new" class="btn btn-primary">
        Create Post
      </NuxtLink>
    </section>

    <!-- Posts -->
    <section v-else class="space-y-6">
      <article
        v-for="post in posts"
        :key="post.id"
        class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden"
      >
        <!-- Post Header -->
        <div class="p-4 flex items-center gap-3">
          <NuxtLink :to="`/profile/${post.userId}`" class="flex items-center gap-3 flex-1">
            <div class="w-10 h-10 rounded-full bg-rose-pale dark:bg-rose-glow flex items-center justify-center text-rose-primary font-medium">
              {{ post.user?.name?.charAt(0) || '?' }}
            </div>
            <div>
              <p class="font-medium text-ink dark:text-pearl">
                {{ post.user?.name || 'Anonymous' }}
              </p>
              <p class="text-xs text-muted dark:text-ash">
                {{ formatDate(post.createdAt) }}
                <span v-if="post.postType" class="ml-2 text-rose-primary">
                  {{ getPostTypeLabel(post.postType) }}
                </span>
              </p>
            </div>
          </NuxtLink>
          <!-- Delete button for own posts -->
          <button
            v-if="user && post.userId === user.id"
            @click="confirmDeletePost(post.id)"
            class="text-muted dark:text-ash hover:text-red-500 dark:hover:text-red-400 p-2 transition-colors"
            title="Delete post"
          >
            🗑️
          </button>
        </div>

        <!-- Images -->
        <div v-if="post.images.length > 0" class="relative">
          <div v-if="post.images.length === 1" class="aspect-square">
            <img :src="post.images[0].url" :alt="post.images[0].caption || ''" class="w-full h-full object-cover" />
          </div>
          <div v-else class="flex overflow-x-auto snap-x snap-mandatory">
            <div
              v-for="(image, i) in post.images"
              :key="image.id"
              class="flex-shrink-0 w-full aspect-square snap-center"
            >
              <img :src="image.url" :alt="image.caption || ''" class="w-full h-full object-cover" />
            </div>
          </div>
          <div v-if="post.images.length > 1" class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {{ post.images.length }} photos
          </div>
        </div>

        <!-- Content -->
        <div class="p-4">
          <p v-if="post.content" class="text-ink dark:text-pearl whitespace-pre-wrap">
            {{ post.content }}
          </p>

          <!-- Item Tags -->
          <div v-if="post.itemTags.length > 0" class="mt-3 flex flex-wrap gap-2">
            <NuxtLink
              v-for="tag in post.itemTags"
              :key="tag.id"
              :to="`/search?item=${tag.itemNumber}`"
              class="tag tag-default text-xs"
            >
              #{{ tag.itemNumber }}
            </NuxtLink>
          </div>
        </div>
      </article>

      <!-- Load More -->
      <div v-if="hasMore" class="text-center pt-4">
        <button
          @click="loadMore"
          class="btn btn-secondary"
          :disabled="feedLoading"
        >
          {{ feedLoading ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </section>

    <!-- FAB for creating posts -->
    <NuxtLink
      v-if="isAuthenticated"
      to="/post/new"
      class="fixed bottom-28 lg:bottom-8 right-4 lg:right-8 z-50 w-14 h-14 bg-rose-primary text-white rounded-full shadow-rose hover:shadow-rose-hover hover:-translate-y-1 transition-all flex items-center justify-center text-2xl"
    >
      +
    </NuxtLink>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div class="bg-light-card dark:bg-dark-card rounded-lg p-6 max-w-md w-full shadow-xl">
          <h3 class="font-display text-xl text-ink dark:text-pearl mb-2">Delete Post?</h3>
          <p class="text-muted dark:text-ash mb-6">
            Are you sure you want to delete this post? This action cannot be undone.
          </p>
          <div class="flex gap-3">
            <button
              @click="showDeleteConfirm = false; postToDelete = null"
              class="btn btn-secondary flex-1"
              :disabled="deleting"
            >
              Cancel
            </button>
            <button
              @click="handleDeletePost"
              class="btn bg-red-500 hover:bg-red-600 text-white flex-1"
              :disabled="deleting"
            >
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
