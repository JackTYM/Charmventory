export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const cookieHeader = getHeader(event, 'cookie') || ''
  
  const sessionMatch = cookieHeader.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/)
  const sessionToken = sessionMatch ? sessionMatch[1] : null

  if (!sessionToken) {
    return { user: null }
  }

  try {
    const response = await fetch(`${config.neonAuthUrl}/get-session`, {
      method: 'GET',
      headers: {
        'Cookie': `__Secure-neon-auth.session_token=${sessionToken}`
      }
    })

    if (!response.ok) {
      return { user: null }
    }

    const jwt = response.headers.get('set-auth-jwt')
    if (jwt) {
      setCookie(event, 'auth_jwt', jwt, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15,
      })
    }

    const data = await response.json()

    if (!data?.user) {
      return { user: null }
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        avatar: data.user.image,
        emailVerified: data.user.emailVerified
      }
    }
  } catch {
    return { user: null }
  }
})
