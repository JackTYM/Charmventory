import { db } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody(event)

  const { email, password, name } = body

  if (!email || !password || !name) {
    throw createError({ statusCode: 400, message: 'Email, password, and name are required' })
  }

  const origin = getHeader(event, 'origin') || 'https://app.charmventory.com'

  const neonAuthResponse = await fetch(`${config.neonAuthUrl}/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin
    },
    body: JSON.stringify({ email, password, name })
  })

  const jwt = neonAuthResponse.headers.get('set-auth-jwt')

  const authResult = await neonAuthResponse.json()

  if (!neonAuthResponse.ok) {
    throw createError({
      statusCode: neonAuthResponse.status,
      message: authResult.message || authResult.error || 'Sign up failed'
    })
  }

  if (!authResult.user?.id) {
    throw createError({ statusCode: 500, message: 'No user returned from auth service' })
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, authResult.user.id))
    .limit(1)

  if (!existingUser) {
    await db.insert(users).values({
      id: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name || name,
    })
  }

  if (authResult.session?.token) {
    setCookie(event, 'session_token', authResult.session.token, COOKIE_OPTIONS)
  }

  if (jwt) {
    setCookie(event, 'auth_jwt', jwt, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 15, // JWT expires in 15 min
    })
  }

  return {
    user: authResult.user,
  }
})
