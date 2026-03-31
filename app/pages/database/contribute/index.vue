<script setup lang="ts">
definePageMeta({
  layout: 'database'
})

const contributionTypes = [
  {
    id: 'catalog',
    icon: '📖',
    title: 'Upload Catalog Pages',
    description: 'Scan or photograph pages from Pandora catalogs to help document release history.',
    link: '/database/contribute/catalog',
    features: ['Mobile scanning', 'Multi-page upload', 'Auto-generate PDF'],
  },
  {
    id: 'charm',
    icon: '💎',
    title: 'Add Product Information',
    description: 'Submit details about a Pandora product including Style ID, release date, and pricing.',
    link: '/database/contribute/charm',
    features: ['Style ID lookup', 'Image upload', 'Price history'],
  },
]
</script>

<template>
  <div class="px-4 py-8 max-w-4xl mx-auto">
    <!-- Header -->
    <section class="mb-8 text-center">
      <h1 class="font-display text-3xl lg:text-4xl text-ink dark:text-pearl mb-2">
        Contribute to the Database
      </h1>
      <p class="text-muted dark:text-ash max-w-2xl mx-auto">
        Help build the most complete archive of Pandora jewelry. All contributions are reviewed before being published.
      </p>
    </section>

    <!-- Contribution Types -->
    <section class="grid md:grid-cols-2 gap-6">
      <div
        v-for="type in contributionTypes"
        :key="type.id"
        @click="navigateTo(type.link)"
        class="bg-light-card dark:bg-dark-card rounded-lg p-6 shadow-card hover:shadow-card-hover transition-all group cursor-pointer"
      >
        <div class="text-4xl mb-4">{{ type.icon }}</div>
        <h2 class="font-display text-xl text-ink dark:text-pearl mb-2 group-hover:text-rose-primary transition-colors">
          {{ type.title }}
        </h2>
        <p class="text-muted dark:text-ash text-sm mb-4">
          {{ type.description }}
        </p>
        <ul class="space-y-1">
          <li v-for="feature in type.features" :key="feature" class="text-xs text-muted dark:text-ash flex items-center gap-2">
            <span class="text-green-500">✓</span> {{ feature }}
          </li>
        </ul>
      </div>
    </section>

    <!-- Stats -->
    <section class="mt-12 bg-light-bg-alt dark:bg-dark-elevated rounded-lg p-6">
      <h3 class="font-display text-lg text-ink dark:text-pearl mb-4 text-center">Community Impact</h3>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-2xl font-display text-rose-primary">0</p>
          <p class="text-xs text-muted dark:text-ash">Catalogs Documented</p>
        </div>
        <div>
          <p class="text-2xl font-display text-rose-primary">0</p>
          <p class="text-xs text-muted dark:text-ash">Products Added</p>
        </div>
        <div>
          <p class="text-2xl font-display text-rose-primary">0</p>
          <p class="text-xs text-muted dark:text-ash">Contributors</p>
        </div>
      </div>
    </section>

    <!-- Guidelines -->
    <section class="mt-8">
      <h3 class="font-display text-lg text-ink dark:text-pearl mb-4">Contribution Guidelines</h3>
      <div class="bg-light-card dark:bg-dark-card rounded-lg p-5 shadow-card">
        <ul class="space-y-3 text-sm text-muted dark:text-ash">
          <li class="flex gap-3">
            <span class="text-rose-primary">1.</span>
            <span><strong class="text-ink dark:text-pearl">Pandora only</strong> - This database is exclusively for official Pandora jewelry and catalogs.</span>
          </li>
          <li class="flex gap-3">
            <span class="text-rose-primary">2.</span>
            <span><strong class="text-ink dark:text-pearl">Quality matters</strong> - Clear photos and accurate information help everyone.</span>
          </li>
          <li class="flex gap-3">
            <span class="text-rose-primary">3.</span>
            <span><strong class="text-ink dark:text-pearl">Be thorough</strong> - Include as much detail as possible (Style IDs, dates, prices).</span>
          </li>
          <li class="flex gap-3">
            <span class="text-rose-primary">4.</span>
            <span><strong class="text-ink dark:text-pearl">No duplicates</strong> - Check if the item already exists before submitting.</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
