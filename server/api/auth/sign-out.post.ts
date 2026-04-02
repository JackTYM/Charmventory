export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sessionToken = getCookie(event, 'session_token')

  if (sessionToken) {
    try {
      await fetch(`${config.neonAuthUrl}/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `neon_auth.session_token=${sessionToken}`
        },
        body: '{}'
      })
    } catch {
    }
  }

  deleteCookie(event, 'session_token', { path: '/' })
  deleteCookie(event, 'auth_jwt', { path: '/' })

  return { success: true }
})
