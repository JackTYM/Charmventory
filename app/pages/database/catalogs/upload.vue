<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

// Redirect to the actual contribute page
onMounted(() => {
  const route = useRoute()
  const query = new URLSearchParams()
  if (route.query.year) query.set('year', route.query.year as string)
  if (route.query.season) query.set('season', route.query.season as string)

  navigateTo(`/database/contribute/catalog${query.toString() ? '?' + query.toString() : ''}`)
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[50vh]">
    <p class="text-muted dark:text-ash">Redirecting...</p>
  </div>
</template>
