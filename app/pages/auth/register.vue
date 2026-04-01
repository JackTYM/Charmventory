<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth'
})

const { checkSession, signUp, isAuthenticated } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

// Redirect to app subdomain (or /home in dev)
function getAppUrl(path: string = '/') {
  const host = window.location.hostname
  if (host === 'charmventory.com' || host === 'www.charmventory.com') {
    return `https://app.charmventory.com${path}`
  }
  // Local dev
  return '/home'
}

// Check if already logged in
onMounted(async () => {
  await checkSession()
  if (isAuthenticated.value) {
    window.location.href = getAppUrl()
  }
})

async function handleSubmit() {
  if (!name.value || !email.value || !password.value) {
    error.value = 'Please fill in all fields'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await signUp(email.value, password.value, name.value)
    // Redirect to app subdomain
    window.location.href = getAppUrl()
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to create account'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="font-display text-2xl text-ink dark:text-pearl text-center mb-6">
      Create Account
    </h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Error -->
      <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        {{ error }}
      </div>

      <!-- Name -->
      <div>
        <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
          Name
        </label>
        <input
          v-model="name"
          type="text"
          class="form-input"
          placeholder="Your name"
          required
        />
      </div>

      <!-- Email -->
      <div>
        <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
          Email
        </label>
        <input
          v-model="email"
          type="email"
          class="form-input"
          placeholder="you@example.com"
          required
        />
      </div>

      <!-- Password -->
      <div>
        <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
          Password
        </label>
        <input
          v-model="password"
          type="password"
          class="form-input"
          placeholder="At least 8 characters"
          required
        />
      </div>

      <!-- Confirm Password -->
      <div>
        <label class="block text-sm font-medium text-ink dark:text-pearl mb-1">
          Confirm Password
        </label>
        <input
          v-model="confirmPassword"
          type="password"
          class="form-input"
          placeholder="Confirm your password"
          required
        />
      </div>

      <!-- Submit -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="loading"
      >
        {{ loading ? 'Creating account...' : 'Create Account' }}
      </button>
    </form>

    <!-- Login Link -->
    <p class="text-center text-sm text-muted dark:text-ash mt-6">
      Already have an account?
      <NuxtLink to="/auth/login" class="text-rose-primary hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
