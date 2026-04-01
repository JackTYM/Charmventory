export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const host = window.location.hostname

  // database.charmventory.com - serve database at root
  if (host === 'database.charmventory.com') {
    // Redirect /database to / (clean URL)
    if (to.path === '/database' || to.path.startsWith('/database/')) {
      const newPath = to.path.replace(/^\/database/, '') || '/'
      return navigateTo(newPath)
    }
    // Non-database paths go to app subdomain
    if (!to.path.startsWith('/database') && to.path !== '/') {
      return navigateTo('https://app.charmventory.com' + to.path, { external: true })
    }
    // Root path - internally show database content
    if (to.path === '/') {
      return navigateTo('/database')
    }
  }

  // app.charmventory.com - serve app at root
  if (host === 'app.charmventory.com') {
    // Redirect /home to / (clean URL)
    if (to.path === '/home') {
      return navigateTo('/')
    }
    // Redirect /database to database subdomain
    if (to.path.startsWith('/database')) {
      const dbPath = to.path.replace(/^\/database/, '') || '/'
      return navigateTo('https://database.charmventory.com' + dbPath, { external: true })
    }
  }

  // Root domain - redirect to appropriate subdomain
  if (host === 'charmventory.com' || host === 'www.charmventory.com') {
    if (to.path.startsWith('/database')) {
      const dbPath = to.path.replace(/^\/database/, '') || '/'
      return navigateTo('https://database.charmventory.com' + dbPath, { external: true })
    } else {
      const appPath = to.path === '/home' ? '/' : to.path
      return navigateTo('https://app.charmventory.com' + appPath, { external: true })
    }
  }
})
