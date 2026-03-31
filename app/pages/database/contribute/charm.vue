<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

import { useAuth } from '~/composables/useAuth'
import { useUpload } from '~/composables/useUpload'

const { isAuthenticated, checkSession } = useAuth()
const { uploadImage } = useUpload()

// Form state
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

const form = reactive({
  styleId: '',
  name: '',
  brand: 'Pandora',
  collection: '',
  type: 'charm',
  releaseDate: '',
  catalogueSeason: '',
  originalPrice: null as number | null,
  currency: 'USD',
  region: '',
  materials: '',
  colors: '',
  description: '',
  isLimited: false,
  isCountryExclusive: false,
  exclusiveCountry: '',
  notes: '',
})

// Image upload
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const imageUploading = ref(false)
const imageUrl = ref('')

const types = [
  { value: 'charm', label: 'Charm' },
  { value: 'clip', label: 'Clip' },
  { value: 'murano', label: 'Murano Glass' },
  { value: 'safety_chain', label: 'Safety Chain' },
  { value: 'spacer', label: 'Spacer' },
  { value: 'earring', label: 'Earring' },
  { value: 'necklace', label: 'Necklace' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'bangle', label: 'Bangle' },
  { value: 'ring', label: 'Ring' },
  { value: 'brooch', label: 'Brooch' },
  { value: 'pendant', label: 'Pendant' },
]

const collections = [
  'Moments',
  'Timeless',
  'ME',
  'Essence',
  'Reflexions',
  'Disney',
  'Marvel',
  'Star Wars',
  'Harry Potter',
  'Game of Thrones',
  'The Lion King',
  'Frozen',
  'Pandora Signature',
  'Pandora Garden',
  'Pandora People',
  'Pandora Passions',
]

const currencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD']
const regions = ['US', 'UK', 'EU', 'AU', 'CA', 'Asia', 'Global']

function handleImageSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    imageFile.value = input.files[0]
    imagePreview.value = URL.createObjectURL(input.files[0])
  }
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = ''
  imageUrl.value = ''
}

async function handleSubmit() {
  if (!form.styleId || !form.name) {
    submitError.value = 'Style ID and Name are required'
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    // Upload image if present
    if (imageFile.value && !imageUrl.value) {
      imageUploading.value = true
      try {
        imageUrl.value = await uploadImage(imageFile.value, 'charms')
      } catch (e: any) {
        submitError.value = 'Failed to upload image: ' + (e.message || 'Unknown error')
        return
      } finally {
        imageUploading.value = false
      }
    }

    // Submit to API
    await $fetch('/api/database/charm-contributions', {
      method: 'POST',
      body: {
        styleId: form.styleId,
        name: form.name,
        brand: form.brand,
        collection: form.collection || null,
        type: form.type,
        releaseDate: form.releaseDate || null,
        catalogueSeason: form.catalogueSeason || null,
        originalPrice: form.originalPrice,
        currency: form.currency,
        region: form.region || null,
        materials: form.materials ? form.materials.split(',').map(m => m.trim()) : [],
        colors: form.colors ? form.colors.split(',').map(c => c.trim()) : [],
        description: form.description || null,
        isLimited: form.isLimited,
        isCountryExclusive: form.isCountryExclusive,
        exclusiveCountry: form.exclusiveCountry || null,
        imageUrl: imageUrl.value || null,
        notes: form.notes || null,
      },
    })

    submitSuccess.value = true
  } catch (e: any) {
    submitError.value = e.message || 'Failed to submit contribution'
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  form.styleId = ''
  form.name = ''
  form.collection = ''
  form.type = 'charm'
  form.releaseDate = ''
  form.catalogueSeason = ''
  form.originalPrice = null
  form.region = ''
  form.materials = ''
  form.colors = ''
  form.description = ''
  form.isLimited = false
  form.isCountryExclusive = false
  form.exclusiveCountry = ''
  form.notes = ''
  removeImage()
  submitSuccess.value = false
}

onMounted(async () => {
  await checkSession()
})

onUnmounted(() => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
})
</script>

<template>
  <div class="px-4 py-8 max-w-2xl mx-auto">
    <!-- Header -->
    <section class="mb-8">
      <NuxtLink to="/database/contribute" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
        ← Back to Contribute
      </NuxtLink>
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Add Charm Information
      </h1>
      <p class="text-muted dark:text-ash">
        Submit details about a Pandora charm to help grow our community database.
      </p>
    </section>

    <!-- Auth Warning -->
    <div v-if="!isAuthenticated" class="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <p class="text-amber-700 dark:text-amber-400 text-sm">
        <NuxtLink to="/auth/login" class="font-medium underline">Sign in</NuxtLink> to get credit for your contributions!
        You can still submit anonymously.
      </p>
    </div>

    <!-- Success -->
    <div v-if="submitSuccess" class="text-center py-16">
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="font-display text-2xl text-ink dark:text-pearl mb-2">
        Thank You!
      </h2>
      <p class="text-muted dark:text-ash mb-6">
        Your charm contribution has been submitted for review.
        It will be added to the database once approved.
      </p>
      <div class="flex gap-4 justify-center">
        <NuxtLink to="/database" class="btn btn-secondary">
          Browse Database
        </NuxtLink>
        <button @click="resetForm" class="btn btn-primary">
          Add Another Charm
        </button>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Error -->
      <div v-if="submitError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        {{ submitError }}
      </div>

      <!-- Required Information -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
        <h3 class="font-display text-lg text-ink dark:text-pearl">Required Information</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Style ID *</label>
            <input
              v-model="form.styleId"
              type="text"
              placeholder="e.g., 798469C01"
              class="form-input font-mono"
              required
            />
            <p class="text-xs text-muted dark:text-ash mt-1">Found on the product tag or box</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Type *</label>
            <select v-model="form.type" class="form-input">
              <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Name *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Official product name"
            class="form-input"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Brand</label>
            <input v-model="form.brand" type="text" class="form-input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Collection</label>
            <select v-model="form.collection" class="form-input">
              <option value="">Select...</option>
              <option v-for="c in collections" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Image Upload -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Product Image</h3>

        <div v-if="imagePreview" class="relative inline-block">
          <img :src="imagePreview" class="w-40 h-40 object-cover rounded-lg" />
          <button
            type="button"
            @click="removeImage"
            class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600"
          >
            ×
          </button>
        </div>

        <div v-else class="border-2 border-dashed border-light-border dark:border-dark-border rounded-lg p-8 text-center">
          <div class="text-4xl mb-3">📷</div>
          <p class="text-muted dark:text-ash mb-4 text-sm">
            Upload a clear photo of the charm
          </p>
          <label class="btn btn-secondary cursor-pointer">
            Choose Image
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageSelect"
            />
          </label>
        </div>
      </section>

      <!-- Release Information -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
        <h3 class="font-display text-lg text-ink dark:text-pearl">Release Information</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Release Date</label>
            <input v-model="form.releaseDate" type="date" class="form-input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Catalogue Season</label>
            <input v-model="form.catalogueSeason" type="text" placeholder="e.g., Spring 2024" class="form-input" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Original Price</label>
            <input v-model="form.originalPrice" type="number" step="0.01" class="form-input" />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Currency</label>
            <select v-model="form.currency" class="form-input">
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Region</label>
            <select v-model="form.region" class="form-input">
              <option value="">Select...</option>
              <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Details -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
        <h3 class="font-display text-lg text-ink dark:text-pearl">Details</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Materials</label>
            <input v-model="form.materials" type="text" placeholder="e.g., Sterling Silver, Enamel" class="form-input" />
            <p class="text-xs text-muted dark:text-ash mt-1">Comma separated</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Colors</label>
            <input v-model="form.colors" type="text" placeholder="e.g., Pink, White" class="form-input" />
            <p class="text-xs text-muted dark:text-ash mt-1">Comma separated</p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Description</label>
          <textarea v-model="form.description" rows="3" class="form-input" placeholder="Describe the product's design and features"></textarea>
        </div>

        <div class="flex flex-wrap items-center gap-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.isLimited" type="checkbox" class="form-checkbox" />
            <span class="text-sm text-ink dark:text-pearl">Limited Edition</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.isCountryExclusive" type="checkbox" class="form-checkbox" />
            <span class="text-sm text-ink dark:text-pearl">Country Exclusive</span>
          </label>
        </div>

        <div v-if="form.isCountryExclusive">
          <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Exclusive Country</label>
          <input v-model="form.exclusiveCountry" type="text" placeholder="e.g., United States" class="form-input" />
        </div>
      </section>

      <!-- Notes -->
      <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Additional Notes</h3>
        <textarea
          v-model="form.notes"
          rows="2"
          placeholder="Source of information, any corrections to existing data, etc."
          class="form-input"
        ></textarea>
      </section>

      <!-- Submit -->
      <div class="flex gap-4">
        <NuxtLink to="/database/contribute" class="btn btn-secondary flex-1 text-center">
          Cancel
        </NuxtLink>
        <button
          type="submit"
          class="btn btn-primary flex-1"
          :disabled="submitting || !form.styleId || !form.name"
        >
          {{ submitting ? (imageUploading ? 'Uploading Image...' : 'Submitting...') : 'Submit for Review' }}
        </button>
      </div>
    </form>
  </div>
</template>
