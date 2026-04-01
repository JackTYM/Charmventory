interface User {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
}

// Decode JWT payload without verifying signature
// For RLS, Neon Auth already validates the JWT, this is just to extract user info
function decodeJwtPayload(jwt: string): any | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
    return JSON.parse(payload)
  } catch {
    return null
  }
}

// Helper to get user from request by checking JWT or session token
export async function getUserFromRequest(event: any): Promise<User | null> {
  // Check for Authorization header (JWT or session token)
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  if (!token) {
    return null
  }

  // Try to decode as JWT first (for Data API JWT)
  const payload = decodeJwtPayload(token)
  if (payload?.sub) {
    // JWT from Neon Auth contains user info in the payload
    return {
      id: payload.sub,
      email: payload.email || '',
      name: payload.name,
      emailVerified: payload.email_verified
    }
  }

  // Fall back to validating session token with Neon Auth
  const config = useRuntimeConfig(event)
  const baseUrl = config.neonAuthUrl

  if (!baseUrl) {
    console.error('NEON_AUTH_URL not configured')
    return null
  }

  try {
    const response = await fetch(`${baseUrl}/get-session`, {
      method: 'GET',
      headers: {
        'Cookie': `neon_auth.session_token=${token}`,
        'x-neon-auth-proxy': 'nuxt-server'
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
