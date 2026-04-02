import { db } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

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

  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  const origin = getHeader(event, 'origin') || 'https://app.charmventory.com'

  const neonAuthResponse = await fetch(`${config.neonAuthUrl}/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin
    },
    body: JSON.stringify({ email, password })
  })

  const jwt = neonAuthResponse.headers.get('set-auth-jwt')
  const neonSessionCookie = neonAuthResponse.headers.get('set-cookie')

  const authResult = await neonAuthResponse.json()

  console.log('Neon Auth response:', { 
    status: neonAuthResponse.status,
    jwt: !!jwt,
    cookie: neonSessionCookie,
    hasSession: !!authResult.session,
    sessionToken: authResult.session?.token ? 'present' : 'missing'
  })

  if (!neonAuthResponse.ok) {
    throw createError({
      statusCode: neonAuthResponse.status,
      message: authResult.message || authResult.error || 'Sign in failed'
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
    const userName = authResult.user.name || email.split('@')[0]
    const slug = await getUniqueSlug(generateSlug(userName))
    
    await db.insert(users).values({
      id: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name,
      slug,
    })
  } else if (!existingUser.slug) {
    const userName = existingUser.name || email.split('@')[0]
    const slug = await getUniqueSlug(generateSlug(userName))
    
    await db.update(users)
      .set({ slug })
      .where(eq(users.id, existingUser.id))
  }

  let sessionToken = authResult.session?.token
  
  if (!sessionToken && neonSessionCookie) {
    const match = neonSessionCookie.match(/neon_auth\.session_token=([^;]+)/)
    if (match) {
      sessionToken = match[1]
    }
  }

  if (sessionToken) {
    setCookie(event, 'session_token', sessionToken, COOKIE_OPTIONS)
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
