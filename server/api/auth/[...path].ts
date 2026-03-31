/**
 * Catch-all route handler that proxies auth requests to Neon Auth
 * Similar to Next.js authApiHandler but for Nuxt/h3
 */

// Neon Auth cookies can have different prefixes
const NEON_AUTH_COOKIE_PREFIXES = ['neon_auth', 'neon-auth', '__Secure-neon-auth', '__Host-neon-auth']
const PROXY_HEADERS = ['user-agent', 'authorization', 'referer', 'content-type']
const RESPONSE_HEADERS_ALLOWLIST = [
  'set-cookie',
  'set-auth-jwt',
  'set-auth-token',
]

function extractNeonAuthCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return ''

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const neonCookies = cookies.filter(c =>
    NEON_AUTH_COOKIE_PREFIXES.some(prefix => c.startsWith(prefix))
  )
  return neonCookies.join('; ')
}

export default defineEventHandler(async (event) => {
  const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      message: 'NEON_AUTH_BASE_URL or NEON_AUTH_URL environment variable is required'
    })
  }

  // Get the path from the URL
  const path = getRouterParam(event, 'path')
  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'Auth path required'
    })
  }

  // Build the upstream URL
  const upstreamUrl = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)

  // Copy query params
  const query = getQuery(event)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      upstreamUrl.searchParams.set(key, String(value))
    }
  }

  // Prepare headers for the upstream request
  const requestHeaders: Record<string, string> = {}

  for (const header of PROXY_HEADERS) {
    const value = getHeader(event, header)
    if (value) {
      requestHeaders[header] = value
    }
  }

  // Add origin
  const origin = getHeader(event, 'origin') ||
                 getHeader(event, 'referer')?.split('/').slice(0, 3).join('/') ||
                 ''
  requestHeaders['Origin'] = origin

  // Add Neon Auth cookies
  const cookieHeader = getHeader(event, 'cookie')
  let cookies = extractNeonAuthCookies(cookieHeader || '')

  // If no cookies but we have a bearer token, convert it to cookie format for get-session
  if (!cookies && requestHeaders['authorization']?.startsWith('Bearer ')) {
    const token = requestHeaders['authorization'].substring(7)
    cookies = `neon_auth.session_token=${token}`
  }

  requestHeaders['Cookie'] = cookies

  // Add proxy identifier
  requestHeaders['x-neon-auth-proxy'] = 'nuxt'

  // Get request body for POST/PUT/PATCH
  let body: string | undefined
  const method = event.method
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const rawBody = await readBody(event)
      body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)
      // Only set content-type if not already set from proxied headers
      if (!requestHeaders['content-type']) {
        requestHeaders['Content-Type'] = 'application/json'
      }
    } catch {
      // No body
    }
  }

  try {
    // Make the request to Neon Auth
    const response = await fetch(upstreamUrl.toString(), {
      method,
      headers: requestHeaders,
      body
    })

    // Copy allowed response headers
    for (const header of RESPONSE_HEADERS_ALLOWLIST) {
      const value = response.headers.get(header)
      if (value) {
        setHeader(event, header, value)
      }
    }

    // Set status code
    setResponseStatus(event, response.status, response.statusText)

    // Return response body - always try to parse as JSON first
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      // Not valid JSON, return as text
      return text
    }
  } catch (e: any) {
    console.error('[Neon Auth Proxy Error]', e)
    throw createError({
      statusCode: 500,
      message: e.message || 'Auth proxy request failed'
    })
  }
})
