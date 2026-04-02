export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const cookieHeader = getHeader(event, 'cookie') || ''
  
  const sessionMatch = cookieHeader.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/)
  const sessionToken = sessionMatch ? sessionMatch[1] : null

  if (sessionToken) {
    try {
      await fetch(`${config.neonAuthUrl}/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `__Secure-neon-auth.session_token=${sessionToken}`
        },
        body: '{}'
      })
    } catch {
    }
  }

  deleteCookie(event, 'auth_jwt', { path: '/' })

  return { success: true }
})
