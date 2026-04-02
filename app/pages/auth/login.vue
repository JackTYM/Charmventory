<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth'
})

const { checkSession, signIn, isAuthenticated } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function getAppUrl(path: string = '/') {
  const host = window.location.hostname
  if (host === 'app.charmventory.com') {
    return path
  }
  return '/home'
}

onMounted(async () => {
  await checkSession()
  if (isAuthenticated.value) {
    navigateTo(getAppUrl())
  }
})

async function handleSubmit() {
  if (!email.value || !password.value) {
    error.value = 'Please fill in all fields'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await signIn(email.value, password.value)
    navigateTo(getAppUrl())
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Invalid email or password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="font-display text-2xl text-ink dark:text-pearl text-center mb-6">
      Welcome Back
    </h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Error -->
      <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        {{ error }}
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
          placeholder="Enter your password"
          required
        />
      </div>

      <!-- Submit -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="loading"
      >
        {{ loading ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>

    <!-- Register Link -->
    <p class="text-center text-sm text-muted dark:text-ash mt-6">
      Don't have an account?
      <NuxtLink to="/auth/register" class="text-rose-primary hover:underline">
        Sign up
      </NuxtLink>
    </p>
  </div>
</template>
