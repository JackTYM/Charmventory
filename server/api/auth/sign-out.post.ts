export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const cookieHeader = getHeader(event, 'cookie') || ''
  
  const sessionMatch = cookieHeader.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/)
  const sessionToken = sessionMatch ? sessionMatch[1] : null

  if (sessionToken) {
    try {
      const response = await fetch(`${config.neonAuthUrl}/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `__Secure-neon-auth.session_token=${sessionToken}`
        },
        body: '{}'
      })
      
      const neonCookie = response.headers.get('set-cookie')
      if (neonCookie) {
        appendResponseHeader(event, 'Set-Cookie', neonCookie)
      }
    } catch {
    }
  }

  deleteCookie(event, 'auth_jwt', { path: '/' })

  return { success: true }
})
