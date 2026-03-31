export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const host = window.location.hostname

  // database.charmventory.com - only allow /database routes
  if (host === 'database.charmventory.com') {
    if (!to.path.startsWith('/database')) {
      return navigateTo('/database')
    }
  }

  // app.charmventory.com - redirect /database to database subdomain
  if (host === 'app.charmventory.com') {
    if (to.path.startsWith('/database')) {
      return navigateTo('https://database.charmventory.com' + to.path, { external: true })
    }
  }

  // Root domain redirect to app subdomain
  if (host === 'charmventory.com' || host === 'www.charmventory.com') {
    if (to.path.startsWith('/database')) {
      return navigateTo('https://database.charmventory.com' + to.path, { external: true })
    } else {
      return navigateTo('https://app.charmventory.com' + to.path, { external: true })
    }
  }
})
