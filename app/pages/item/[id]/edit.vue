<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useItems } from '~/composables/useItems'
import { useUpload } from '~/composables/useUpload'
import { useDataApi } from '~/composables/useDataApi'

const route = useRoute()
const { isAuthenticated, checkSession } = useAuth()
const { updateItem, deleteItem, addImage, deleteImage } = useItems()
const { uploadImage } = useUpload()
const { from } = useDataApi()

const itemTypes = [
  { value: 'charm', label: 'Charm' },
  { value: 'clip', label: 'Clip' },
  { value: 'murano', label: 'Murano Glass' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'bangle', label: 'Bangle' },
  { value: 'safety_chain', label: 'Safety Chain' },
  { value: 'ring', label: 'Ring' },
  { value: 'earring', label: 'Earring' },
  { value: 'necklace', label: 'Necklace' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'brooch', label: 'Brooch' },
  { value: 'keychain', label: 'Key Chain' },
  { value: 'ornament', label: 'Ornament' },
  { value: 'box', label: 'Box' },
  { value: 'catalogue', label: 'Catalog' },
  { value: 'other', label: 'Other' },
]

const conditions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

const sources = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'online_retail', label: 'Online Retail' },
  { value: 'secondhand', label: 'Secondhand' },
  { value: 'gift', label: 'Gift' },
  { value: 'trade', label: 'Trade' },
  { value: 'other', label: 'Other' },
]

const authenticOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

const hallmarkVisibility = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'not_visible', label: 'Not Visible' },
]

const hallmarkTypes = [
  { value: 'S925 ALE', label: 'S925 ALE (Sterling Silver)' },
  { value: 'G585 ALE', label: 'G585 ALE (14k Gold)' },
  { value: 'MET ALE', label: 'MET ALE (Metal Alloy)' },
  { value: 'ALE R', label: 'ALE R (Rose Gold Plated)' },
  { value: 'other', label: 'Other' },
]

const colorOptions = [
  { value: 'Silver', label: 'Silver' },
  { value: 'Gold', label: 'Gold' },
  { value: 'Rose Gold', label: 'Rose Gold' },
  { value: 'Black', label: 'Black' },
  { value: 'White', label: 'White' },
  { value: 'Pink', label: 'Pink' },
  { value: 'Blue', label: 'Blue' },
  { value: 'Green', label: 'Green' },
  { value: 'Purple', label: 'Purple' },
  { value: 'Red', label: 'Red' },
  { value: 'Orange', label: 'Orange' },
  { value: 'Yellow', label: 'Yellow' },
  { value: 'Clear', label: 'Clear' },
  { value: 'Multi-color', label: 'Multi-color' },
  { value: 'other', label: 'Other' },
]

const form = reactive({
  type: 'charm',
  name: '',
  brand: 'Pandora',
  itemNumber: '',
  collection: '',
  description: '',
  materials: '',
  color: '',
  colorOther: '',
  collaboration: '',
  catalogueRelease: '',
  hallmarkVisibility: '',
  hallmarkType: '',
  hallmarkTypeOther: '',
  originalPrice: null as number | null,
  pricePaid: null as number | null,
  currentValue: null as number | null,
  amountOnHand: 1,
  condition: 'new',
  damageNotes: '',
  rarity: 1,
  isLimited: false,
  isCountryExclusive: false,
  countryExclusive: '',
  isGiftWithPurchase: false,
  isNumberedGwp: false,
  gwpNumber: '',
  weightGrams: null as number | null,
  size: '',
  isAuthentic: 'unknown',
  authenticationStatus: '',
  authenticatedBy: '',
  source: '',
  sourceName: '',
  datePurchased: '',
  warrantyEnd: '',
  warrantyContact: '',
  carePlanEnd: '',
  carePlanYears: null as number | null,
  notes: '',
  isForSale: false,
  isForTrade: false,
  askingPrice: null as number | null,
})

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const showDeleteConfirm = ref(false)
const error = ref('')
const itemId = route.params.id as string

// Existing images from database
const existingImages = ref<Array<{ id: string; url: string; category: string }>>([])
// New images to upload
const newImageFiles = ref<File[]>([])
const newImagePreviews = ref<string[]>([])
const uploadingImages = ref(false)

onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await fetchItem()
})

async function fetchItem() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: queryError } = await from('items')
      .select('*, item_images(*)')
      .eq('id', itemId)
      .single()

    if (queryError) throw new Error(queryError.message)

    const row = data as any
    
    // Load existing images
    existingImages.value = (row.item_images || []).map((img: any) => ({
      id: img.id,
      url: img.url,
      category: img.category || 'item',
    }))
    
    const response = {
      type: row.type,
      name: row.name,
      brand: row.brand,
      itemNumber: row.item_number,
      collection: row.collection,
      description: row.description,
      materials: row.materials,
      color: row.color,
      collaboration: row.collaboration,
      catalogueRelease: row.catalogue_release,
      hallmarkVisible: row.hallmark_visible,
      originalPrice: row.original_price,
      pricePaid: row.price_paid,
      currentValue: row.current_value,
      amountOnHand: row.amount_on_hand,
      condition: row.condition,
      damageNotes: row.damage_notes,
      rarity: row.rarity,
      isLimited: row.is_limited,
      isCountryExclusive: row.is_country_exclusive,
      countryExclusive: row.country_exclusive,
      isGiftWithPurchase: row.is_gift_with_purchase,
      isNumberedGwp: row.is_numbered_gwp,
      gwpNumber: row.gwp_number,
      weightGrams: row.weight_grams,
      size: row.size,
      isAuthentic: row.is_authentic,
      authenticationStatus: row.authentication_status,
      authenticatedBy: row.authenticated_by,
      source: row.source,
      sourceName: row.source_name,
      datePurchased: row.date_purchased,
      warrantyEnd: row.warranty_end,
      warrantyContact: row.warranty_contact,
      carePlanEnd: row.care_plan_end,
      carePlanYears: row.care_plan_years,
      notes: row.notes,
      isForSale: row.is_for_sale,
      isForTrade: row.is_for_trade,
      askingPrice: row.asking_price,
    }

    // Populate form
    form.type = response.type || 'charm'
    form.name = response.name || ''
    form.brand = response.brand || 'Pandora'
    form.itemNumber = response.itemNumber || ''
    form.collection = response.collection || ''
    form.description = response.description || ''
    // Handle materials - could be array or JSON string
    if (Array.isArray(response.materials)) {
      form.materials = response.materials.join(', ')
    } else if (typeof response.materials === 'string') {
      try {
        form.materials = JSON.parse(response.materials).join(', ')
      } catch {
        form.materials = response.materials
      }
    } else {
      form.materials = ''
    }
    // Parse color - check if it's a known color
    const knownColors = colorOptions.map(c => c.value).filter(v => v !== 'other')
    if (response.color && knownColors.includes(response.color)) {
      form.color = response.color
      form.colorOther = ''
    } else if (response.color) {
      form.color = 'other'
      form.colorOther = response.color
    } else {
      form.color = ''
      form.colorOther = ''
    }
    form.collaboration = response.collaboration || ''
    form.catalogueRelease = response.catalogueRelease || ''
    // Parse hallmark visibility and type from combined field
    if (response.hallmarkVisible) {
      if (response.hallmarkVisible === 'Not Visible') {
        form.hallmarkVisibility = 'not_visible'
        form.hallmarkType = ''
        form.hallmarkTypeOther = ''
      } else if (response.hallmarkVisible.includes(' - ')) {
        const [vis, type] = response.hallmarkVisible.split(' - ')
        form.hallmarkVisibility = vis
        // Check if type is a known hallmark type
        const knownTypes = hallmarkTypes.map(h => h.value).filter(v => v !== 'other')
        if (knownTypes.includes(type)) {
          form.hallmarkType = type
          form.hallmarkTypeOther = ''
        } else {
          form.hallmarkType = 'other'
          form.hallmarkTypeOther = type
        }
      } else {
        form.hallmarkVisibility = response.hallmarkVisible
        form.hallmarkType = ''
        form.hallmarkTypeOther = ''
      }
    }
    form.originalPrice = response.originalPrice ? Number(response.originalPrice) : null
    form.pricePaid = response.pricePaid ? Number(response.pricePaid) : null
    form.currentValue = response.currentValue ? Number(response.currentValue) : null
    form.amountOnHand = response.amountOnHand || 1
    form.condition = response.condition || 'new'
    form.damageNotes = response.damageNotes || ''
    form.rarity = response.rarity || 1
    form.isLimited = response.isLimited || false
    form.isCountryExclusive = response.isCountryExclusive || false
    form.countryExclusive = response.countryExclusive || ''
    form.isGiftWithPurchase = response.isGiftWithPurchase || false
    form.isNumberedGwp = response.isNumberedGwp || false
    form.gwpNumber = response.gwpNumber || ''
    form.weightGrams = response.weightGrams ? Number(response.weightGrams) : null
    form.size = response.size || ''
    form.isAuthentic = response.isAuthentic || 'yes'
    form.authenticationStatus = response.authenticationStatus || ''
    form.authenticatedBy = response.authenticatedBy || ''
    form.source = response.source || ''
    form.sourceName = response.sourceName || ''
    form.datePurchased = response.datePurchased?.split('T')[0] || ''
    form.warrantyEnd = response.warrantyEnd?.split('T')[0] || ''
    form.warrantyContact = response.warrantyContact || ''
    form.carePlanEnd = response.carePlanEnd?.split('T')[0] || ''
    form.carePlanYears = response.carePlanYears
    form.notes = response.notes || ''
    form.isForSale = response.isForSale || false
    form.isForTrade = response.isForTrade || false
    form.askingPrice = response.askingPrice ? Number(response.askingPrice) : null
  } catch (e: any) {
    error.value = e.message || 'Failed to load item'
  } finally {
    loading.value = false
  }
}

// Image handling
function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    newImageFiles.value.push(...files)
    files.forEach(file => {
      newImagePreviews.value.push(URL.createObjectURL(file))
    })
  }
}

function removeNewImage(index: number) {
  URL.revokeObjectURL(newImagePreviews.value[index])
  newImageFiles.value.splice(index, 1)
  newImagePreviews.value.splice(index, 1)
}

async function removeExistingImage(imageId: string) {
  try {
    await deleteImage(imageId, itemId)
    existingImages.value = existingImages.value.filter(img => img.id !== imageId)
  } catch (e: any) {
    error.value = e.message || 'Failed to delete image'
  }
}

async function handleSubmit() {
  if (!form.name) {
    error.value = 'Item name is required'
    return
  }

  saving.value = true
  error.value = ''

  try {
    const materials = form.materials
      ? form.materials.split(',').map(m => m.trim()).filter(Boolean)
      : null

    // Combine hallmark fields
    let hallmarkVisible = null
    if (form.hallmarkVisibility && form.hallmarkVisibility !== 'not_visible') {
      const hallmarkType = form.hallmarkType === 'other' ? form.hallmarkTypeOther : form.hallmarkType
      hallmarkVisible = hallmarkType
        ? `${form.hallmarkVisibility} - ${hallmarkType}`
        : form.hallmarkVisibility
    } else if (form.hallmarkVisibility === 'not_visible') {
      hallmarkVisible = 'Not Visible'
    }

    // Handle color
    const color = form.color === 'other' ? form.colorOther : form.color

    await updateItem(itemId, {
      ...form,
      materials,
      hallmarkVisible,
      color,
    })

    // Upload new images
    if (newImageFiles.value.length > 0) {
      uploadingImages.value = true
      for (const file of newImageFiles.value) {
        const url = await uploadImage(file, 'items')
        await addImage(itemId, url, 'item')
      }
      uploadingImages.value = false
    }

    await navigateTo(`/item/${itemId}`)
  } catch (e: any) {
    error.value = e.message || 'Failed to update item'
  } finally {
    saving.value = false
    uploadingImages.value = false
  }
}

async function handleDelete() {
  deleting.value = true
  error.value = ''
  try {
    await deleteItem(itemId)
    await navigateTo('/catalog')
  } catch (e: any) {
    error.value = e.message || 'Failed to delete item'
    showDeleteConfirm.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink :to="`/item/${itemId}`" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          &larr; Back to Item
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">Edit Item</h1>
      </section>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Photos -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Photos</h3>

          <div class="grid grid-cols-3 gap-3">
            <!-- Existing images -->
            <div
              v-for="image in existingImages"
              :key="image.id"
              class="aspect-square rounded-lg overflow-hidden relative group"
            >
              <img :src="image.url" class="w-full h-full object-cover" />
              <button
                type="button"
                @click="removeExistingImage(image.id)"
                class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>

            <!-- New images to upload -->
            <div
              v-for="(url, i) in newImagePreviews"
              :key="'new-' + i"
              class="aspect-square rounded-lg overflow-hidden relative"
            >
              <img :src="url" class="w-full h-full object-cover" />
              <button
                type="button"
                @click="removeNewImage(i)"
                class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs"
              >
                ✕
              </button>
            </div>

            <!-- Add image button -->
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

          <p v-if="uploadingImages" class="text-xs text-rose-primary mt-3">
            Uploading images...
          </p>
        </section>

        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Basic Info</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Type *</label>
            <select v-model="form.type" class="form-input">
              <option v-for="t in itemTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Name *</label>
            <input v-model="form.name" type="text" class="form-input" required />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Brand</label>
              <input v-model="form.brand" type="text" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Item Number</label>
              <input v-model="form.itemNumber" type="text" class="form-input" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Collection</label>
            <input v-model="form.collection" type="text" class="form-input" />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Description</label>
            <textarea v-model="form.description" class="form-input" rows="3"></textarea>
          </div>
        </section>

        <!-- Details -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Details</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Materials</label>
              <input v-model="form.materials" type="text" class="form-input" placeholder="Comma separated" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Color</label>
              <select v-model="form.color" class="form-input">
                <option value="">Select...</option>
                <option v-for="c in colorOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
          </div>

          <div v-if="form.color === 'other'">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Specify Color</label>
            <input v-model="form.colorOther" type="text" class="form-input" placeholder="Enter color" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Collaboration</label>
              <input v-model="form.collaboration" type="text" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Release Season</label>
              <input v-model="form.catalogueRelease" type="text" class="form-input" placeholder="e.g. Spring 2024" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Weight (g)</label>
            <input v-model="form.weightGrams" type="number" step="0.01" class="form-input" />
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Hallmark Visibility</label>
                <select v-model="form.hallmarkVisibility" class="form-input">
                  <option value="">Select...</option>
                  <option v-for="h in hallmarkVisibility" :key="h.value" :value="h.value">{{ h.label }}</option>
                </select>
              </div>
              <div v-if="form.hallmarkVisibility && form.hallmarkVisibility !== 'not_visible'">
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Hallmark Type</label>
                <select v-model="form.hallmarkType" class="form-input">
                  <option value="">Select...</option>
                  <option v-for="h in hallmarkTypes" :key="h.value" :value="h.value">{{ h.label }}</option>
                </select>
              </div>
            </div>
            <div v-if="form.hallmarkType === 'other'">
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Specify Hallmark</label>
              <input v-model="form.hallmarkTypeOther" type="text" class="form-input" placeholder="Enter hallmark marking" />
            </div>
          </div>

          <div class="flex items-center gap-6">
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
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Which Country?</label>
            <input v-model="form.countryExclusive" type="text" class="form-input" placeholder="e.g. UK, Australia" />
          </div>

          <div class="flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isGiftWithPurchase" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Gift with Purchase</span>
            </label>
            <label v-if="form.isGiftWithPurchase" class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isNumberedGwp" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">Numbered</span>
            </label>
            <input
              v-if="form.isGiftWithPurchase && form.isNumberedGwp"
              v-model="form.gwpNumber"
              type="text"
              class="form-input w-32"
              placeholder="e.g. 1234/5000"
            />
          </div>

          <div class="border-t border-light-border dark:border-dark-border pt-4 mt-4">
            <h4 class="text-sm font-medium text-muted dark:text-ash uppercase tracking-wider mb-3">Authenticity</h4>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Authentic</label>
                <select v-model="form.isAuthentic" class="form-input">
                  <option v-for="a in authenticOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
                </select>
              </div>
              <div v-if="form.isAuthentic === 'yes' || form.isAuthentic === 'no'">
                <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Authenticated By</label>
                <input v-model="form.authenticatedBy" type="text" class="form-input" placeholder="Who verified?" />
              </div>
            </div>
          </div>
        </section>

        <!-- Pricing -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Pricing & Value</h3>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Original Price</label>
              <input v-model="form.originalPrice" type="number" step="0.01" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Price Paid</label>
              <input v-model="form.pricePaid" type="number" step="0.01" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Current Value</label>
              <input v-model="form.currentValue" type="number" step="0.01" class="form-input" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Amount on Hand</label>
              <input v-model="form.amountOnHand" type="number" min="1" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Rarity</label>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted dark:text-ash">Common</span>
                <button
                  v-for="r in 3"
                  :key="r"
                  type="button"
                  @click="form.rarity = r"
                  class="text-2xl"
                  :class="r <= form.rarity ? 'text-gold-primary' : 'text-muted dark:text-ash'"
                >&#9733;</button>
                <span class="text-xs text-muted dark:text-ash">Rare</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Condition -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Condition</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Condition</label>
            <select v-model="form.condition" class="form-input">
              <option v-for="c in conditions" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>

          <div v-if="form.condition !== 'new'">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Damage Notes</label>
            <textarea v-model="form.damageNotes" class="form-input" rows="2"></textarea>
          </div>
        </section>

        <!-- Purchase Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Purchase Info</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Source</label>
              <select v-model="form.source" class="form-input">
                <option value="">Select...</option>
                <option v-for="s in sources" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Store/Seller</label>
              <input v-model="form.sourceName" type="text" class="form-input" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Date Purchased</label>
            <input v-model="form.datePurchased" type="date" class="form-input" />
          </div>
        </section>

        <!-- Warranty & Care -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Warranty & Care</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Warranty End Date</label>
              <input v-model="form.warrantyEnd" type="date" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Warranty Contact</label>
              <input v-model="form.warrantyContact" type="text" class="form-input" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Care Plan End Date</label>
              <input v-model="form.carePlanEnd" type="date" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Care Plan Years</label>
              <input v-model="form.carePlanYears" type="number" min="1" class="form-input" />
            </div>
          </div>
        </section>

        <!-- Listing -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Listing Options</h3>

          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isForSale" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">For Sale</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isForTrade" type="checkbox" class="form-checkbox" />
              <span class="text-sm text-ink dark:text-pearl">For Trade</span>
            </label>
          </div>

          <div v-if="form.isForSale">
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Asking Price</label>
            <input v-model="form.askingPrice" type="number" step="0.01" class="form-input" />
          </div>
        </section>

        <!-- Notes -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Notes</h3>
          <textarea v-model="form.notes" class="form-input" rows="3"></textarea>
        </section>

        <!-- Submit -->
        <div class="flex gap-4">
          <NuxtLink :to="`/item/${itemId}`" class="btn btn-secondary flex-1 text-center">
            Cancel
          </NuxtLink>
          <button type="submit" class="btn btn-primary flex-1" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>

        <!-- Danger Zone -->
        <section class="mt-8 border border-red-200 dark:border-red-800 rounded-lg p-5 space-y-4">
          <h3 class="font-display text-lg text-red-600 dark:text-red-400">Danger Zone</h3>
          <p class="text-sm text-muted dark:text-ash">
            Permanently delete this item and all its images. This action cannot be undone.
          </p>
          <button
            type="button"
            @click="showDeleteConfirm = true"
            class="btn bg-red-500 hover:bg-red-600 text-white"
          >
            Delete Item
          </button>
        </section>
      </form>

      <!-- Delete Confirmation Modal -->
      <Teleport to="body">
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div class="bg-light-card dark:bg-dark-card rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 class="font-display text-xl text-ink dark:text-pearl mb-2">Delete Item?</h3>
            <p class="text-muted dark:text-ash mb-6">
              Are you sure you want to delete "<strong class="text-ink dark:text-pearl">{{ form.name }}</strong>"? This will permanently remove the item and all associated images. This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <button
                @click="showDeleteConfirm = false"
                class="btn btn-secondary flex-1"
                :disabled="deleting"
              >
                Cancel
              </button>
              <button
                @click="handleDelete"
                class="btn bg-red-500 hover:bg-red-600 text-white flex-1"
                :disabled="deleting"
              >
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
