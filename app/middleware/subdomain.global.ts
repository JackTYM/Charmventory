export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const host = window.location.hostname

  // database.charmventory.com - database browser
  if (host === 'database.charmventory.com') {
    // Root shows database index
    if (to.path === '/') {
      return navigateTo('/database')
    }
    // Clean up /database prefix in URLs
    if (to.path === '/database' || to.path.startsWith('/database/')) {
      return // Allow - these are the database pages
    }
    // Any non-database path goes to app subdomain
    return navigateTo('https://app.charmventory.com' + to.path, { external: true })
  }

  // app.charmventory.com - authenticated app + auth pages
  if (host === 'app.charmventory.com') {
    // Root (/) is handled by index.vue which shows HomeContent
    // Redirect /home to / for clean URLs
    if (to.path === '/home') {
      return navigateTo('/')
    }
    // Redirect /database to database subdomain
    if (to.path.startsWith('/database')) {
      return navigateTo('https://database.charmventory.com' + to.path, { external: true })
    }
    // Auth pages stay on app subdomain (same origin as the app for localStorage)
    if (to.path.startsWith('/auth')) {
      return // Allow
    }
  }

  // charmventory.com - landing page only
  if (host === 'charmventory.com' || host === 'www.charmventory.com') {
    if (to.path === '/') {
      return
    }
    // Auth pages redirect to app subdomain
    if (to.path.startsWith('/auth')) {
      return navigateTo('https://app.charmventory.com' + to.path, { external: true })
    }
    // Database goes to database subdomain
    if (to.path.startsWith('/database')) {
      return navigateTo('https://database.charmventory.com' + to.path, { external: true })
    }
    // Everything else goes to app subdomain
    return navigateTo('https://app.charmventory.com' + to.path, { external: true })
  }
})
