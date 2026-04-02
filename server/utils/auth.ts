interface User {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
}

function decodeJwtPayload(jwt: string): any | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3 || !parts[1]) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export async function getUserFromRequest(event: any): Promise<User | null> {
  const jwt = getCookie(event, 'auth_jwt')
  if (jwt) {
    const payload = decodeJwtPayload(jwt)
    if (payload?.sub) {
      return {
        id: payload.sub,
        email: payload.email || '',
        name: payload.name,
        emailVerified: payload.email_verified
      }
    }
  }

  const cookieHeader = getHeader(event, 'cookie') || ''
  const sessionMatch = cookieHeader.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/)
  const sessionToken = sessionMatch ? sessionMatch[1] : null
  
  if (!sessionToken) {
    return null
  }

  const config = useRuntimeConfig(event)
  const baseUrl = config.neonAuthUrl

  if (!baseUrl) {
    return null
  }

  try {
    const response = await fetch(`${baseUrl}/get-session`, {
      method: 'GET',
      headers: {
        'Cookie': `__Secure-neon-auth.session_token=${sessionToken}`
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data?.user) {
      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        emailVerified: data.user.emailVerified
      }
    }

    return null
  } catch {
    return null
  }
}

export async function requireAuth(event: any): Promise<User> {
  const user = await getUserFromRequest(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  return user
}
