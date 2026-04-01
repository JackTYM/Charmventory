<script setup lang="ts">
// Detect if we're on the app subdomain
const isAppSubdomain = ref(false)

onMounted(() => {
  const host = window.location.hostname
  isAppSubdomain.value = host === 'app.charmventory.com'
  // Set layout based on subdomain
  if (isAppSubdomain.value) {
    setPageLayout('default')
  } else {
    setPageLayout('landing')
  }
})

// Handle unauthenticated on app subdomain
function handleUnauthenticated() {
  const host = window.location.hostname
  if (host === 'app.charmventory.com') {
    window.location.href = 'https://charmventory.com/auth/login'
  } else {
    navigateTo('/auth/login')
  }
}

const features = [
  {
    icon: '💎',
    title: 'Track Your Jewelry',
    description: 'Catalog every charm with details like Style ID, condition, rarity, and value.',
  },
  {
    icon: '⭐',
    title: 'Manage Your Wishlist',
    description: 'Keep track of charms you want with priority levels and links to listings.',
  },
  {
    icon: '📸',
    title: 'Share with Community',
    description: 'Post your bracelet builds, new finds, and connect with fellow collectors.',
  },
  {
    icon: '🏪',
    title: 'Find Trusted Sources',
    description: 'Community-vouched sellers and sources for authentic Pandora pieces.',
  },
  {
    icon: '📚',
    title: 'Open Pandora Database',
    description: 'Free crowdsourced database with Style IDs, catalogs, and API access for the community.',
  },
  {
    icon: '🔒',
    title: 'Privacy Controls',
    description: 'Choose what to share publicly and keep your collection private if you prefer.',
  },
]
</script>

<template>
  <!-- App subdomain: show home dashboard -->
  <HomeContent v-if="isAppSubdomain" @unauthenticated="handleUnauthenticated" />

  <!-- Root domain: show landing page -->
  <div v-else class="min-h-screen bg-rose-pale dark:bg-dark-bg">
    <!-- Hero Section -->
    <section>
      <div class="px-4 py-16 lg:py-24 max-w-6xl mx-auto">
        <div class="text-center">
          <!-- Logo -->
          <img src="/logo.png" alt="Charmventory" class="h-32 lg:h-48 mx-auto mb-8 dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" />

          <!-- Tagline -->
          <h1 class="font-display text-3xl lg:text-5xl text-ink dark:text-pearl mb-6">
            Your Pandora Collection,
            <span class="text-gradient-rose italic">Beautifully Organized</span>
          </h1>

          <p class="text-lg lg:text-xl text-muted dark:text-ash max-w-2xl mx-auto mb-10">
            Track your jewelry, manage your wishlist, and connect with a community of Pandora collectors.
          </p>

          <!-- CTA Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <NuxtLink to="/auth/register" class="btn btn-primary text-lg px-8 py-4">
              Start Your Collection
            </NuxtLink>
            <NuxtLink to="/auth/login" class="btn btn-secondary text-lg px-8 py-4">
              Sign In
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="px-4 py-16 lg:py-24 max-w-6xl mx-auto">
      <h2 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl text-center mb-12">
        Everything You Need
      </h2>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="bg-light-card dark:bg-dark-card rounded-lg p-6 shadow-card"
        >
          <div class="text-4xl mb-4">{{ feature.icon }}</div>
          <h3 class="font-display text-xl text-ink dark:text-pearl mb-2">
            {{ feature.title }}
          </h3>
          <p class="text-muted dark:text-ash text-sm">
            {{ feature.description }}
          </p>
        </div>
      </div>
    </section>

    <!-- Database Preview Section -->
    <section class="px-4 py-16 lg:py-24">
      <div class="max-w-6xl mx-auto text-center">
        <h2 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-4">
          Open Pandora Database
        </h2>
        <p class="text-muted dark:text-ash mb-8 max-w-2xl mx-auto">
          A free, community-driven archive of Pandora jewelry. Browse Style IDs, digitized catalogs, and historical data.
        </p>
        <NuxtLink to="/database" class="btn btn-primary">
          Visit Database
        </NuxtLink>
        <p class="text-sm text-muted dark:text-ash mt-4">
          Help us document every catalog and charm ever released
        </p>
      </div>
    </section>

    <!-- Footer CTA -->
    <section class="bg-rose-primary px-4 py-16">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="font-display text-3xl lg:text-4xl text-white mb-4">
          Ready to Start?
        </h2>
        <p class="text-white/80 mb-8">
          Create your free account and start organizing your Pandora collection today.
        </p>
        <NuxtLink to="/auth/register" class="btn bg-white text-rose-primary hover:bg-light-bg px-8 py-4 text-lg">
          Get Started Free
        </NuxtLink>
      </div>
    </section>

    <!-- Simple Footer -->
    <footer class="bg-rose-primary px-4 py-6">
      <div class="max-w-6xl mx-auto text-center text-sm text-white/80">
        <p>&copy; {{ new Date().getFullYear() }} Charmventory. Made with love for Pandora collectors.</p>
      </div>
    </footer>
  </div>
</template>
