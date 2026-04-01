<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataApi } from '~/composables/useDataApi'

const route = useRoute()
const { isAuthenticated, checkSession, user } = useAuth()
const { from } = useDataApi()

const post = ref<any>(null)
const loading = ref(true)
const error = ref('')
const fullscreenImage = ref<string | null>(null)

onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await fetchPost()
})

async function fetchPost() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: queryError } = await from('posts')
      .select('*, post_images(*), post_item_tags(*)')
      .eq('id', route.params.id)
      .single()

    if (queryError) throw new Error(queryError.message)
    if (!data) throw new Error('Post not found')

    const row = data as any

    // Fetch user data separately
    const { data: userData } = await from('users')
      .select('id, name, avatar')
      .eq('id', row.user_id)
      .single()

    post.value = {
      id: row.id,
      userId: row.user_id,
      user: {
        id: userData?.id || row.user_id,
        name: userData?.name,
        avatar: userData?.avatar,
      },
      content: row.content || undefined,
      postType: row.post_type || undefined,
      images: (row.post_images || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        caption: img.caption || undefined,
      })),
      itemTags: (row.post_item_tags || []).map((tag: any) => ({
        id: tag.id,
        itemNumber: tag.item_number,
      })),
      createdAt: row.created_at,
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load post'
  } finally {
    loading.value = false
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const isOwnPost = computed(() => post.value?.userId === user.value?.id)

function openFullscreen(url: string) {
  fullscreenImage.value = url
}

function closeFullscreen() {
  fullscreenImage.value = null
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <NuxtLink to="/feed" class="text-rose-primary hover:underline">Back to Feed</NuxtLink>
    </div>

    <!-- Post Detail -->
    <template v-else-if="post">
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink to="/feed" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-4 inline-block">
          &larr; Back to Feed
        </NuxtLink>
      </section>

      <!-- Post Card -->
      <article class="bg-light-card dark:bg-dark-card rounded-lg shadow-card overflow-hidden">
        <!-- User Header -->
        <div class="p-4 flex items-center gap-3 border-b border-light-border dark:border-dark-border">
          <div class="w-10 h-10 rounded-full bg-rose-primary/20 flex items-center justify-center overflow-hidden">
            <img v-if="post.user.avatar" :src="post.user.avatar" class="w-full h-full object-cover" />
            <span v-else class="text-rose-primary font-medium">
              {{ post.user.name?.[0]?.toUpperCase() || '?' }}
            </span>
          </div>
          <div class="flex-1">
            <p class="font-medium text-ink dark:text-pearl">{{ post.user.name || 'Anonymous' }}</p>
            <p class="text-xs text-muted dark:text-ash">{{ formatDate(post.createdAt) }}</p>
          </div>
          <span v-if="post.postType" class="text-xs px-2 py-1 rounded-full bg-rose-primary/10 text-rose-primary capitalize">
            {{ post.postType }}
          </span>
        </div>

        <!-- Content -->
        <div v-if="post.content" class="p-4">
          <p class="text-ink dark:text-pearl whitespace-pre-wrap">{{ post.content }}</p>
        </div>

        <!-- Images -->
        <div v-if="post.images?.length" class="px-4 pb-4">
          <div
            class="grid gap-2"
            :class="{
              'grid-cols-1': post.images.length === 1,
              'grid-cols-2': post.images.length >= 2,
            }"
          >
            <div
              v-for="(img, i) in post.images"
              :key="img.id"
              class="relative cursor-pointer group"
              :class="{ 'col-span-2': post.images.length === 1 }"
              @click="openFullscreen(img.url)"
            >
              <img
                :src="img.url"
                :alt="img.caption || 'Post image'"
                class="w-full rounded-lg object-cover"
                :class="post.images.length === 1 ? 'max-h-[600px]' : 'aspect-square'"
              />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                <span class="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity">
                  Click to expand
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Item Tags -->
        <div v-if="post.itemTags?.length" class="px-4 pb-4 flex flex-wrap gap-2">
          <NuxtLink
            v-for="tag in post.itemTags"
            :key="tag.id"
            :to="`/catalog?search=${tag.itemNumber}`"
            class="text-xs px-2 py-1 rounded-full bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 transition-colors"
          >
            #{{ tag.itemNumber }}
          </NuxtLink>
        </div>
      </article>
    </template>

    <!-- Fullscreen Image Modal -->
    <Teleport to="body">
      <div
        v-if="fullscreenImage"
        class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
        @click="closeFullscreen"
      >
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl z-10"
          @click="closeFullscreen"
        >
          &times;
        </button>
        <img
          :src="fullscreenImage"
          class="max-w-full max-h-full object-contain"
          @click.stop
        />
      </div>
    </Teleport>
  </div>
</template>
