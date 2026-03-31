<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useWishlist } from '~/composables/useWishlist'
import { useUpload } from '~/composables/useUpload'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { createWishlistItem, addLink, addImage } = useWishlist()
const { uploadImage } = useUpload()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
  }
})

// Form data
const form = reactive({
  name: '',
  itemNumber: '',
  estimatedPrice: null as number | null,
  priority: 'medium',
  quantityWanted: 1,
  notes: '',
})

// Images
const imageFiles = ref<File[]>([])
const imageUrls = ref<string[]>([])

function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    imageFiles.value.push(...files)
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

// Links
const links = ref<{ url: string; notes: string }[]>([])

function addLinkField() {
  links.value.push({ url: '', notes: '' })
}

function removeLink(index: number) {
  links.value.splice(index, 1)
}

const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!form.name) {
    error.value = 'Item name is required'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Create wishlist item
    const item = await createWishlistItem({
      name: form.name,
      itemNumber: form.itemNumber || undefined,
      estimatedPrice: form.estimatedPrice,
      priority: form.priority as 'high' | 'medium' | 'low',
      quantityWanted: form.quantityWanted,
      notes: form.notes,
    })

    // Upload and add images
    for (const file of imageFiles.value) {
      const url = await uploadImage(file, 'wishlist')
      await addImage(item.id, url)
    }

    // Add links
    for (const link of links.value) {
      if (link.url) {
        await addLink(item.id, link.url, link.notes)
      }
    }

    await navigateTo('/wishlist')
  } catch (e: any) {
    error.value = e.message || 'Failed to create wishlist item'
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
        <NuxtLink to="/wishlist" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          ← Back to Wishlist
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">
          Add to Wishlist
        </h1>
      </section>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Item Details</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Name *</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="What are you looking for?" required />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Style ID</label>
            <input v-model="form.itemNumber" type="text" class="form-input" placeholder="e.g., 798469C01" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Estimated Price</label>
              <input v-model="form.estimatedPrice" type="number" step="0.01" class="form-input" placeholder="$" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Quantity Wanted</label>
              <input v-model="form.quantityWanted" type="number" min="1" class="form-input" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Priority</label>
            <div class="flex gap-3">
              <button
                type="button"
                @click="form.priority = 'high'"
                class="flex-1 text-center py-2 rounded border-2 transition-all"
                :class="form.priority === 'high'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-500'
                  : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 border-transparent opacity-60'"
              >
                High
              </button>
              <button
                type="button"
                @click="form.priority = 'medium'"
                class="flex-1 text-center py-2 rounded border-2 transition-all"
                :class="form.priority === 'medium'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-500'
                  : 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-500 border-transparent opacity-60'"
              >
                Medium
              </button>
              <button
                type="button"
                @click="form.priority = 'low'"
                class="flex-1 text-center py-2 rounded border-2 transition-all"
                :class="form.priority === 'low'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-500'
                  : 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-500 border-transparent opacity-60'"
              >
                Low
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Notes</label>
            <textarea v-model="form.notes" class="form-input" rows="3" placeholder="Any details about what you're looking for..."></textarea>
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

          <p class="text-xs text-muted dark:text-ash mt-3">
            Add reference photos of the item you're looking for
          </p>
        </section>

        <!-- Links -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-display text-lg text-ink dark:text-pearl">Links</h3>
            <button
              type="button"
              @click="addLinkField"
              class="text-rose-primary text-sm hover:underline"
            >
              + Add Link
            </button>
          </div>

          <p v-if="links.length === 0" class="text-sm text-muted dark:text-ash">
            Add links to where this item is currently for sale.
          </p>

          <div v-for="(link, i) in links" :key="i" class="space-y-2 pb-4 border-b border-light-border dark:border-dark-border last:border-0 last:pb-0">
            <div class="flex gap-2">
              <input
                v-model="link.url"
                type="url"
                class="form-input flex-1"
                placeholder="https://..."
              />
              <button
                type="button"
                @click="removeLink(i)"
                class="text-red-500 hover:text-red-600 px-2"
              >
                x
              </button>
            </div>
            <input
              v-model="link.notes"
              type="text"
              class="form-input"
              placeholder="Notes about this listing..."
            />
          </div>
        </section>

        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'Saving...' : 'Add to Wishlist' }}
        </button>
      </form>
    </template>
  </div>
</template>
