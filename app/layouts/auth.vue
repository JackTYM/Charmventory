<template>
  <div class="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <!-- Logo/Brand -->
      <div class="text-center mb-8">
        <h1 class="font-display text-4xl text-ink dark:text-pearl">
          <span class="text-gradient-rose italic">Charmventory</span>
        </h1>
        <p class="text-muted dark:text-ash text-sm mt-2">
          Your Pandora Collection, Organized
        </p>
      </div>

      <!-- Content slot -->
      <div class="bg-light-card dark:bg-dark-card rounded-xl shadow-card p-6 lg:p-8">
        <slot />
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-muted dark:text-ash mt-6">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  </div>
</template>
