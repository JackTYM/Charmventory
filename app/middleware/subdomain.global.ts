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

  // app.charmventory.com - authenticated app
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
    // Auth pages redirect to root domain
    if (to.path.startsWith('/auth')) {
      return navigateTo('https://charmventory.com' + to.path, { external: true })
    }
  }

  // charmventory.com - landing page + auth only
  if (host === 'charmventory.com' || host === 'www.charmventory.com') {
    // Root shows hero (index.vue)
    if (to.path === '/') {
      return // Allow - shows landing page
    }
    // Auth pages stay on root domain
    if (to.path.startsWith('/auth')) {
      return // Allow - login/register
    }
    // Database goes to database subdomain
    if (to.path.startsWith('/database')) {
      return navigateTo('https://database.charmventory.com' + to.path, { external: true })
    }
    // Everything else goes to app subdomain
    return navigateTo('https://app.charmventory.com' + to.path, { external: true })
  }
})
