import { db } from '../../db'
import { users } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let suffix = 0
  
  while (true) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1)
    
    if (!existing) return slug
    
    suffix++
    slug = `${baseSlug}-${suffix}`
  }
}

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
  const neonSessionCookie = neonAuthResponse.headers.get('set-cookie')

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
    const userName = authResult.user.name || name
    const slug = await getUniqueSlug(generateSlug(userName))
    
    await db.insert(users).values({
      id: authResult.user.id,
      email: authResult.user.email,
      name: userName,
      slug,
    })
  }

  if (neonSessionCookie) {
    appendResponseHeader(event, 'Set-Cookie', neonSessionCookie)
  }

  if (jwt) {
    setCookie(event, 'auth_jwt', jwt, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 15,
    })
  }

  return {
    user: authResult.user,
  }
})
