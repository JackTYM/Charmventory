// Neon Auth cookies can have different prefixes
const NEON_AUTH_COOKIE_PREFIXES = ['neon_auth', 'neon-auth', '__Secure-neon-auth', '__Host-neon-auth']

interface User {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
}

function extractNeonAuthCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return ''

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const neonCookies = cookies.filter(c =>
    NEON_AUTH_COOKIE_PREFIXES.some(prefix => c.startsWith(prefix))
  )
  return neonCookies.join('; ')
}

// Helper to get user from request by checking Neon Auth session
export async function getUserFromRequest(event: any): Promise<User | null> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL

  if (!baseUrl) {
    console.error('NEON_AUTH_BASE_URL not configured')
    return null
  }

  // Try cookies first
  const cookieHeader = getHeader(event, 'cookie')
  const neonCookies = extractNeonAuthCookies(cookieHeader || '')

  // Also check for Authorization header as fallback
  const authHeader = getHeader(event, 'authorization')
  let bearerToken: string | null = null
  if (authHeader?.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7)
  }

  // If no cookies and no bearer token, unauthorized
  if (!neonCookies && !bearerToken) {
    return null
  }

  try {
    // Build request headers
    const requestHeaders: Record<string, string> = {
      'x-neon-auth-proxy': 'nuxt-server'
    }

    // Add cookies if available
    if (neonCookies) {
      requestHeaders['Cookie'] = neonCookies
    }

    // Add bearer token as cookie format if no cookies but we have token
    if (!neonCookies && bearerToken) {
      // The token from signin/signup response can be used directly
      // We need to format it as the session token cookie
      requestHeaders['Cookie'] = `neon_auth.session_token=${bearerToken}`
    }

    const response = await fetch(`${baseUrl}/get-session`, {
      method: 'GET',
      headers: requestHeaders
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data && data.user) {
      return {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        emailVerified: data.user.emailVerified
      }
    }

    return null
  } catch (e) {
    console.error('Error checking session:', e)
    return null
  }
}

// Middleware helper to require auth
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
