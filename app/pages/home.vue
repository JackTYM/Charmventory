<script setup lang="ts">
// This page is for direct /home access (mainly localhost dev)
// On app.charmventory.com, users are redirected to / which shows HomeContent

function handleUnauthenticated() {
  navigateTo('/auth/login')
}
</script>

<template>
  <HomeContent @unauthenticated="handleUnauthenticated" />
</template>
