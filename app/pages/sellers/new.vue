<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useSellers } from '~/composables/useSellers'

const { isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { createSeller, addToList } = useSellers()

// Check auth on mount
onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
  }
})

const sourceTypes = [
  { value: 'authorized_retailer', label: 'Authorized Retailer', icon: '✓' },
  { value: 'reseller', label: 'Reseller', icon: '🔄' },
  { value: 'personal_shopper', label: 'Personal Shopper', icon: '👤' },
  { value: 'private_seller', label: 'Private Seller', icon: '🏠' },
]

const platforms = [
  'Pandora Store',
  'Etsy',
  'eBay',
  'Mercari',
  'Poshmark',
  'Facebook Marketplace',
  'Instagram',
  'Independent Website',
  'Other',
]

// Form data
const form = reactive({
  name: '',
  sourceType: '',
  platform: '',
  url: '',
  listType: '' as '' | 'preferred' | 'do_not_buy',
  notes: '',
})

const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!form.name || !form.platform || !form.sourceType || !form.listType) {
    error.value = 'Source type, name, platform, and list selection are required'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Create seller
    const seller = await createSeller({
      name: form.name,
      sourceType: form.sourceType,
      platform: form.platform,
      url: form.url || undefined,
    })

    // Add to list if specified
    if (form.listType && seller) {
      await addToList(seller.id, form.listType, form.notes || undefined)
    }

    navigateTo('/sellers')
  } catch (e: any) {
    error.value = e.message || 'Failed to add seller'
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
        <NuxtLink to="/sellers" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          ← Back to Source List
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">
          Add Source
        </h1>
      </section>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Source Type -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Source Type *</h3>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              v-for="type in sourceTypes"
              :key="type.value"
              type="button"
              @click="form.sourceType = form.sourceType === type.value ? '' : type.value"
              class="p-3 rounded-lg border-2 transition-all text-center"
              :class="form.sourceType === type.value
                ? 'border-rose-primary bg-rose-pale dark:bg-rose-glow text-rose-primary'
                : 'border-light-border dark:border-dark-border text-muted dark:text-ash hover:border-rose-primary/50'"
            >
              <div class="text-2xl mb-1">{{ type.icon }}</div>
              <div class="text-xs font-medium">{{ type.label }}</div>
            </button>
          </div>
        </section>

        <!-- Source Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Source Info</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Name *</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="e.g., Silver Whimsy Boutique" required />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Platform *</label>
            <select v-model="form.platform" class="form-input" required>
              <option value="">Select platform...</option>
              <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Shop URL</label>
            <input v-model="form.url" type="url" class="form-input" placeholder="https://..." />
          </div>
        </section>

        <!-- Your List -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Add to Your List *</h3>

          <div class="flex gap-3">
            <button
              type="button"
              @click="form.listType = form.listType === 'preferred' ? '' : 'preferred'"
              class="flex-1 py-3 rounded-lg border-2 transition-all"
              :class="form.listType === 'preferred'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'border-light-border dark:border-dark-border text-muted dark:text-ash'"
            >
              Preferred
            </button>
            <button
              type="button"
              @click="form.listType = form.listType === 'do_not_buy' ? '' : 'do_not_buy'"
              class="flex-1 py-3 rounded-lg border-2 transition-all"
              :class="form.listType === 'do_not_buy'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'border-light-border dark:border-dark-border text-muted dark:text-ash'"
            >
              Do Not Buy
            </button>
          </div>

          <div v-if="form.listType">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
              {{ form.listType === 'preferred' ? 'Why do you recommend them?' : 'Why should others avoid?' }}
            </label>
            <textarea
              v-model="form.notes"
              class="form-input"
              rows="3"
              :placeholder="form.listType === 'preferred'
                ? 'Great packaging, fast shipping, authentic items...'
                : 'Counterfeit items, slow response, never received order...'"
            ></textarea>
          </div>
        </section>

        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="loading"
        >
          {{ loading ? 'Saving...' : 'Add Source' }}
        </button>
      </form>
    </template>
  </div>
</template>
