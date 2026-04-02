export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sessionToken = getCookie(event, 'session_token')

  if (!sessionToken) {
    return { user: null }
  }

  try {
    const response = await fetch(`${config.neonAuthUrl}/get-session`, {
      method: 'GET',
      headers: {
        'Cookie': `neon_auth.session_token=${sessionToken}`
      }
    })

    if (!response.ok) {
      deleteCookie(event, 'session_token', { path: '/' })
      deleteCookie(event, 'auth_jwt', { path: '/' })
      return { user: null }
    }

    const jwt = response.headers.get('set-auth-jwt')
    if (jwt) {
      setCookie(event, 'auth_jwt', jwt, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 15, // JWT expires in 15 min
      })
    }

    const data = await response.json()

    if (!data?.user) {
      deleteCookie(event, 'session_token', { path: '/' })
      deleteCookie(event, 'auth_jwt', { path: '/' })
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
