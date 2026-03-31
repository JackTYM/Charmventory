<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'
import { useDataApi } from '~/composables/useDataApi'

const { user, isAuthenticated, checkSession, loading: authLoading } = useAuth()
const { from } = useDataApi()

onMounted(async () => {
  await checkSession()
  if (!isAuthenticated.value) {
    navigateTo('/auth/login')
    return
  }
  await loadProfile()
})

const form = reactive({
  name: '',
  bio: '',
  instagram: '',
  tiktok: '',
  youtube: '',
})

const privacy = reactive({
  collection: true,
  wishlist: true,
  forSale: true,
  preferredSellers: true,
  doNotBuy: true,
})

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

async function loadProfile() {
  try {
    // Fetch user profile
    const { data: userData, error: userError } = await from('users')
      .select('*')
      .single()

    if (userError) throw new Error(userError.message)

    const data = userData as any
    form.name = data.name || ''
    form.bio = data.bio || ''

    if (data.social_links) {
      const socialLinks = typeof data.social_links === 'string'
        ? JSON.parse(data.social_links)
        : data.social_links
      form.instagram = socialLinks.instagram || ''
      form.tiktok = socialLinks.tiktok || ''
      form.youtube = socialLinks.youtube || ''
    }

    // Fetch privacy settings
    const { data: privacyData } = await from('profile_privacy')
      .select('*')
      .single()

    if (privacyData) {
      const p = privacyData as any
      privacy.collection = p.show_collection !== false
      privacy.wishlist = p.show_wishlist !== false
      privacy.forSale = p.show_for_sale !== false
      privacy.preferredSellers = p.show_preferred_sellers !== false
      privacy.doNotBuy = p.show_do_not_buy !== false
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load profile'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    // Update user profile
    const { error: updateError } = await from('users')
      .update({
        name: form.name,
        bio: form.bio,
        social_links: JSON.stringify({
          instagram: form.instagram || null,
          tiktok: form.tiktok || null,
          youtube: form.youtube || null,
        }),
      })
      .eq('id', user.value?.id)

    if (updateError) throw new Error(updateError.message)

    // Upsert privacy settings
    const { error: privacyError } = await from('profile_privacy')
      .upsert({
        user_id: user.value?.id,
        show_collection: privacy.collection,
        show_wishlist: privacy.wishlist,
        show_for_sale: privacy.forSale,
        show_preferred_sellers: privacy.preferredSellers,
        show_do_not_buy: privacy.doNotBuy,
      })

    if (privacyError) throw new Error(privacyError.message)

    success.value = 'Profile saved!'
    setTimeout(() => success.value = '', 3000)
  } catch (e: any) {
    error.value = e.message || 'Failed to save profile'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="px-4 py-6 lg:px-8 lg:py-8 max-w-2xl mx-auto pb-24">
    <!-- Loading State -->
    <div v-if="authLoading || loading" class="flex items-center justify-center h-64">
      <div class="text-rose-primary text-xl">Loading...</div>
    </div>

    <template v-else>
      <!-- Header -->
      <section class="mb-6">
        <NuxtLink to="/feed" class="text-muted dark:text-ash text-sm hover:text-rose-primary mb-2 inline-block">
          ← Back
        </NuxtLink>
        <h1 class="font-display text-3xl text-ink dark:text-pearl">
          Profile Settings
        </h1>
      </section>

      <form @submit.prevent="saveProfile" class="space-y-6">
        <!-- Messages -->
        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </div>
        <div v-if="success" class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
          {{ success }}
        </div>

        <!-- Basic Info -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Basic Info</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Display Name</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="Your name" />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Bio</label>
            <textarea v-model="form.bio" class="form-input" rows="3" placeholder="Tell us about your collection..."></textarea>
          </div>
        </section>

        <!-- Social Links -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Social Links</h3>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">Instagram</label>
            <input v-model="form.instagram" type="text" class="form-input" placeholder="@username" />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">TikTok</label>
            <input v-model="form.tiktok" type="text" class="form-input" placeholder="@username" />
          </div>

          <div>
            <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">YouTube</label>
            <input v-model="form.youtube" type="text" class="form-input" placeholder="Channel URL" />
          </div>
        </section>

        <!-- Privacy Settings -->
        <section class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card space-y-4">
          <h3 class="font-display text-lg text-ink dark:text-pearl">Privacy Settings</h3>
          <p class="text-sm text-muted dark:text-ash">Choose what others can see on your profile</p>

          <div class="space-y-3">
            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-sm text-ink dark:text-pearl">Collection</span>
              <input v-model="privacy.collection" type="checkbox" class="form-checkbox" />
            </label>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-sm text-ink dark:text-pearl">Wishlist</span>
              <input v-model="privacy.wishlist" type="checkbox" class="form-checkbox" />
            </label>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-sm text-ink dark:text-pearl">Items for Sale</span>
              <input v-model="privacy.forSale" type="checkbox" class="form-checkbox" />
            </label>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-sm text-ink dark:text-pearl">Preferred Sellers</span>
              <input v-model="privacy.preferredSellers" type="checkbox" class="form-checkbox" />
            </label>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-sm text-ink dark:text-pearl">Do Not Buy List</span>
              <input v-model="privacy.doNotBuy" type="checkbox" class="form-checkbox" />
            </label>
          </div>
        </section>

        <!-- Submit -->
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="saving"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </form>
    </template>
  </div>
</template>
