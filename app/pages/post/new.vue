<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useFeed } from '~/composables/useFeed'
import { useUpload } from '~/composables/useUpload'
import { useItems } from '~/composables/useItems'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { createPost } = useFeed()
const { uploadImage } = useUpload()
const { items: catalogItems, fetchItems } = useItems()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
  }
  await fetchItems()
})

const postTypes = [
  { value: 'new_charm', label: 'Recently Acquired', emoji: '🆕' },
  { value: 'bracelet_build', label: 'Bracelet Build', emoji: '💎' },
  { value: 'haul', label: 'Haul', emoji: '🛍️' },
  { value: 'collection', label: 'Collection', emoji: '📦' },
]

const form = reactive({
  content: '',
  postType: '',
})

const imageFiles = ref<File[]>([])
const imageUrls = ref<string[]>([])
const taggedItems = ref<{ id: string; name: string; itemNumber?: string }[]>([])
const itemSearch = ref('')
const showItemDropdown = ref(false)

const loading = ref(false)
const error = ref('')

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

// Filter catalog items based on search
const filteredCatalogItems = computed(() => {
  if (!itemSearch.value.trim()) return catalogItems.value.slice(0, 10)
  const query = itemSearch.value.toLowerCase()
  return catalogItems.value
    .filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.itemNumber?.toLowerCase().includes(query) ||
      item.collection?.toLowerCase().includes(query)
    )
    .slice(0, 10)
})

function selectItem(item: { id: string; name: string; itemNumber?: string }) {
  if (!taggedItems.value.find(t => t.id === item.id)) {
    taggedItems.value.push({ id: item.id, name: item.name, itemNumber: item.itemNumber })
  }
  itemSearch.value = ''
  showItemDropdown.value = false
}

function removeTaggedItem(index: number) {
  taggedItems.value.splice(index, 1)
}

async function handleSubmit() {
  if (!form.content && imageFiles.value.length === 0) {
    error.value = 'Add some content or images to your post'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Upload images first
    const uploadedUrls: string[] = []
    for (const file of imageFiles.value) {
      const url = await uploadImage(file, 'posts')
      uploadedUrls.push(url)
    }

    // Create post - send item numbers for tags
    const itemTagNumbers = taggedItems.value
      .map(t => t.itemNumber)
      .filter((n): n is string => !!n)

    await createPost({
      content: form.content || undefined,
      postType: form.postType || undefined,
      imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      itemTags: itemTagNumbers.length > 0 ? itemTagNumbers : undefined,
    })

    navigateTo('/feed')
  } catch (e: any) {
    error.value = e.message || 'Failed to create post'
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
        <NuxtLink to="/feed" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          ← Back to Feed
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">
          Create Post
        </h1>
      </section>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Post Type -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">What are you sharing?</h3>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="type in postTypes"
              :key="type.value"
              type="button"
              @click="form.postType = form.postType === type.value ? '' : type.value"
              class="p-3 rounded-lg border-2 transition-all text-center"
              :class="form.postType === type.value
                ? 'border-rose-primary bg-rose-pale dark:bg-rose-glow text-rose-primary'
                : 'border-light-border dark:border-dark-border text-muted dark:text-ash hover:border-rose-primary/50'"
            >
              <div class="text-2xl mb-1">{{ type.emoji }}</div>
              <div class="text-xs font-medium">{{ type.label }}</div>
            </button>
          </div>
        </section>

        <!-- Images -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Photos</h3>

          <div class="grid grid-cols-3 gap-3">
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

        <!-- Content -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Caption</h3>
          <textarea
            v-model="form.content"
            class="form-input"
            rows="4"
            placeholder="Share your thoughts..."
          ></textarea>
        </section>

        <!-- Tag Items from Catalog -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Tag Items from Collection</h3>

          <!-- Search Input -->
          <div class="relative mb-3">
            <input
              v-model="itemSearch"
              type="text"
              class="form-input"
              placeholder="Search your collection..."
              @focus="showItemDropdown = true"
              @blur="setTimeout(() => showItemDropdown = false, 200)"
            />

            <!-- Dropdown -->
            <div
              v-if="showItemDropdown && filteredCatalogItems.length > 0"
              class="absolute z-10 top-full left-0 right-0 mt-1 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              <button
                v-for="item in filteredCatalogItems"
                :key="item.id"
                type="button"
                class="w-full px-4 py-3 text-left hover:bg-light-bg-alt dark:hover:bg-dark-elevated flex items-center gap-3 border-b border-light-border dark:border-dark-border last:border-0"
                @mousedown.prevent="selectItem(item)"
              >
                <div class="w-10 h-10 rounded bg-light-bg-alt dark:bg-dark-elevated flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    v-if="item.images?.length > 0"
                    :src="item.images[0].url"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-lg">💎</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-ink dark:text-pearl truncate">{{ item.name }}</p>
                  <p class="text-xs text-muted dark:text-ash">
                    {{ item.itemNumber || 'No Style ID' }}
                    <span v-if="item.collection"> · {{ item.collection }}</span>
                  </p>
                </div>
              </button>
            </div>
          </div>

          <!-- Tagged Items -->
          <div v-if="taggedItems.length > 0" class="flex flex-wrap gap-2">
            <span
              v-for="(item, i) in taggedItems"
              :key="item.id"
              class="tag tag-active flex items-center gap-1"
            >
              {{ item.name }}
              <span v-if="item.itemNumber" class="opacity-70">#{{ item.itemNumber }}</span>
              <button type="button" @click="removeTaggedItem(i)" class="ml-1 hover:text-red-500">&times;</button>
            </span>
          </div>

          <p v-if="catalogItems.length === 0" class="text-sm text-muted dark:text-ash">
            Add items to your collection first to tag them in posts.
          </p>
          <p v-else class="text-xs text-muted dark:text-ash mt-2">
            Tag items from your collection so others can discover posts featuring specific charms
          </p>
        </section>

        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'Posting...' : 'Share Post' }}
        </button>
      </form>
    </template>
  </div>
</template>
