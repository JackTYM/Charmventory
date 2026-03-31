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

// Check if already logged in
onMounted(async () => {
  await checkSession()
  if (isAuthenticated.value) {
    navigateTo('/home')
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
    // Use full page reload to avoid HMR state issues in dev
    window.location.href = '/home'
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

    <!-- Divider -->
    <div class="flex items-center gap-4 my-6">
      <div class="flex-1 h-px bg-light-border dark:bg-dark-border"></div>
      <span class="text-xs text-muted dark:text-ash">or</span>
      <div class="flex-1 h-px bg-light-border dark:bg-dark-border"></div>
    </div>

    <!-- Social Login -->
    <div class="space-y-3">
      <a
        href="/api/auth/sign-in/social?provider=google"
        class="btn btn-secondary w-full flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </a>
    </div>

    <!-- Register Link -->
    <p class="text-center text-sm text-muted dark:text-ash mt-6">
      Don't have an account?
      <NuxtLink to="/auth/register" class="text-rose-primary hover:underline">
        Sign up
      </NuxtLink>
    </p>
  </div>
</template>
