<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataApi } from '~/composables/useDataApi'

const route = useRoute()
const { isAuthenticated, checkSession } = useAuth()
const { from } = useDataApi()

const item = ref<any>(null)
const loading = ref(true)
const error = ref('')
const databaseEntry = ref<any>(null)

onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await fetchItem()
})

async function checkDatabaseEntry(styleId: string) {
  if (!styleId) return
  try {
    const { data } = await from('charm_database')
      .select('style_id, name')
      .eq('style_id', styleId)
      .single()
    databaseEntry.value = data
  } catch {
    // Not found in database
    databaseEntry.value = null
  }
}

async function fetchItem() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: queryError } = await from('items')
      .select('*, item_images(*)')
      .eq('id', route.params.id)
      .single()

    if (queryError) throw new Error(queryError.message)
    if (!data) throw new Error('Item not found')

    const row = data as any
    item.value = {
      id: row.id,
      type: row.type,
      name: row.name,
      brand: row.brand || 'Pandora',
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
      condition: row.condition || 'new',
      damageNotes: row.damage_notes,
      rarity: row.rarity || 1,
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
      customMetadata: row.custom_metadata,
      isForSale: row.is_for_sale,
      isForTrade: row.is_for_trade,
      askingPrice: row.asking_price,
      createdAt: row.created_at,
      images: (row.item_images || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        category: img.category,
        caption: img.caption,
      })),
    }

    // Check if item exists in charm database
    if (row.item_number) {
      await checkDatabaseEntry(row.item_number)
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load item'
  } finally {
    loading.value = false
  }
}

const primaryImage = computed(() => {
  if (!item.value?.images?.length) return null
  return item.value.images[0]?.url
})

const formatPrice = (price: number | string | null) => {
  if (!price) return '-'
  return `$${Number(price).toFixed(2)}`
}

const getMaterials = (materials: string[] | string | null) => {
  if (!materials) return []
  if (typeof materials === 'string') {
    try {
      const parsed = JSON.parse(materials)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return [materials]
    }
  }
  return Array.isArray(materials) ? materials : []
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

const formatHallmark = (hallmark: string | null) => {
  if (!hallmark) return '-'
  // Capitalize first letter of each word
  return hallmark.replace(/\b\w/g, c => c.toUpperCase())
}

const typeLabels: Record<string, string> = {
  charm: 'Charm',
  clip: 'Clip',
  murano: 'Murano Glass',
  safety_chain: 'Safety Chain',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  bangle: 'Bangle',
  ring: 'Ring',
  brooch: 'Brooch',
  pendant: 'Pendant',
  ornament: 'Ornament',
  keychain: 'Key Chain',
  box: 'Box',
  catalogue: 'Catalogue',
  gift_with_purchase: 'Gift with Purchase',
  other: 'Other',
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto pb-24">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 mb-4">{{ error }}</p>
      <NuxtLink to="/catalog" class="text-rose-primary hover:underline">Back to Catalog</NuxtLink>
    </div>

    <!-- Item Detail -->
    <template v-else-if="item">
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink to="/catalog" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          &larr; Back to Catalog
        </NuxtLink>
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="font-display text-3xl text-ink dark:text-pearl">{{ item.name }}</h1>
            <p class="text-muted dark:text-ash">{{ typeLabels[item.type] || item.type }} &bull; {{ item.brand }}</p>
            <p v-if="item.description" class="text-ink dark:text-pearl mt-2 text-sm">{{ item.description }}</p>
          </div>
          <NuxtLink
            :to="`/item/${item.id}/edit`"
            class="btn btn-secondary text-sm"
          >
            Edit
          </NuxtLink>
        </div>
      </section>

      <!-- Images -->
      <section v-if="item.images?.length" class="mb-8">
        <div class="aspect-square max-w-md mx-auto rounded-lg overflow-hidden bg-light-card dark:bg-dark-card">
          <img
            :src="primaryImage"
            :alt="item.name"
            class="w-full h-full object-cover"
          />
        </div>
        <div v-if="item.images?.length > 1" class="flex gap-2 mt-4 justify-center">
          <div
            v-for="(img, i) in item.images"
            :key="img.id"
            class="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2"
            :class="i === 0 ? 'border-rose-primary' : 'border-transparent'"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      <!-- No Image Placeholder -->
      <section v-else class="mb-8">
        <div class="aspect-square max-w-md mx-auto rounded-lg bg-light-card dark:bg-dark-card flex items-center justify-center">
          <span class="text-6xl text-muted dark:text-ash">&#128142;</span>
        </div>
      </section>

      <!-- Details Grid -->
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Details</h3>
          <dl class="space-y-3 text-sm">
            <div v-if="item.itemNumber" class="flex justify-between items-center">
              <dt class="text-muted dark:text-ash">Item Number</dt>
              <dd class="text-ink dark:text-pearl font-medium flex items-center gap-2">
                {{ item.itemNumber }}
                <NuxtLink
                  v-if="databaseEntry"
                  :to="`/database/${item.itemNumber}`"
                  class="text-xs px-2 py-0.5 rounded bg-rose-primary/10 text-rose-primary hover:bg-rose-primary/20 transition-colors"
                  title="View in Charm Database"
                >
                  View in Database
                </NuxtLink>
              </dd>
            </div>
            <div v-if="item.collection" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Collection</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.collection }}</dd>
            </div>
            <div v-if="item.catalogueRelease" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Release</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.catalogueRelease }}</dd>
            </div>
            <div v-if="getMaterials(item.materials).length" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Materials</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ getMaterials(item.materials).join(', ') }}</dd>
            </div>
            <div v-if="item.color" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Color</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.color }}</dd>
            </div>
            <div v-if="item.collaboration" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Collaboration</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.collaboration }}</dd>
            </div>
            <div v-if="item.weightGrams" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Weight</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.weightGrams }}g</dd>
            </div>
            <div v-if="item.hallmarkVisible" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Hallmark</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatHallmark(item.hallmarkVisible) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">Condition</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ conditionLabels[item.condition] || item.condition }}</dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="text-muted dark:text-ash">Rarity</dt>
              <dd class="flex gap-0.5">
                <span
                  v-for="i in 3"
                  :key="i"
                  class="text-lg"
                  :class="i <= item.rarity ? 'text-gold-primary' : 'text-muted dark:text-ash'"
                >&#9733;</span>
              </dd>
            </div>
            <div v-if="item.isLimited" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Limited Edition</dt>
              <dd class="text-rose-primary font-medium">Yes</dd>
            </div>
            <div v-if="item.isCountryExclusive" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Country Exclusive</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.countryExclusive || 'Yes' }}</dd>
            </div>
            <div v-if="item.isAuthentic && item.isAuthentic !== 'unknown'" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Authentic</dt>
              <dd class="font-medium" :class="{
                'text-green-600 dark:text-green-400': item.isAuthentic === 'yes',
                'text-red-600 dark:text-red-400': item.isAuthentic === 'no'
              }">{{ item.isAuthentic === 'yes' ? 'Yes' : 'No' }}</dd>
            </div>
            <div v-if="item.authenticatedBy" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Authenticated By</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.authenticatedBy }}</dd>
            </div>
          </dl>
        </section>

        <!-- Pricing -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Value</h3>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">Original Price</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatPrice(item.originalPrice) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">Price Paid</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatPrice(item.pricePaid) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">Current Value</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatPrice(item.currentValue) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted dark:text-ash">Amount on Hand</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.amountOnHand || 1 }}</dd>
            </div>
          </dl>

          <div v-if="item.isForSale || item.isForTrade" class="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
            <div v-if="item.isForSale" class="flex justify-between text-sm">
              <span class="text-green-600 dark:text-green-400 font-medium">For Sale</span>
              <span class="text-ink dark:text-pearl font-medium">{{ formatPrice(item.askingPrice) }}</span>
            </div>
            <div v-if="item.isForTrade" class="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
              Open to Trades
            </div>
          </div>
        </section>

        <!-- Purchase Info -->
        <section v-if="item.source || item.datePurchased" class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Purchase Info</h3>
          <dl class="space-y-3 text-sm">
            <div v-if="item.source" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Source</dt>
              <dd class="text-ink dark:text-pearl font-medium capitalize">{{ item.source.replace('_', ' ') }}</dd>
            </div>
            <div v-if="item.sourceName" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Store/Seller</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.sourceName }}</dd>
            </div>
            <div v-if="item.datePurchased" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Date Purchased</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatDate(item.datePurchased) }}</dd>
            </div>
          </dl>
        </section>

        <!-- Warranty & Care -->
        <section v-if="item.warrantyEnd || item.carePlanEnd" class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Warranty & Care</h3>
          <dl class="space-y-3 text-sm">
            <div v-if="item.warrantyEnd" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Warranty Expires</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatDate(item.warrantyEnd) }}</dd>
            </div>
            <div v-if="item.warrantyContact" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Warranty Contact</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.warrantyContact }}</dd>
            </div>
            <div v-if="item.carePlanEnd" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Care Plan Expires</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ formatDate(item.carePlanEnd) }}</dd>
            </div>
            <div v-if="item.carePlanYears" class="flex justify-between">
              <dt class="text-muted dark:text-ash">Care Plan Duration</dt>
              <dd class="text-ink dark:text-pearl font-medium">{{ item.carePlanYears }} years</dd>
            </div>
          </dl>
        </section>

        <!-- Notes -->
        <section v-if="item.notes || item.damageNotes" class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
          <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Notes</h3>
          <div v-if="item.damageNotes" class="mb-3">
            <p class="text-xs text-muted dark:text-ash uppercase tracking-wider mb-1">Damage Notes</p>
            <p class="text-sm text-ink dark:text-pearl">{{ item.damageNotes }}</p>
          </div>
          <div v-if="item.notes">
            <p class="text-xs text-muted dark:text-ash uppercase tracking-wider mb-1">Additional Notes</p>
            <p class="text-sm text-ink dark:text-pearl">{{ item.notes }}</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
