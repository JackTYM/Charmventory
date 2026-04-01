interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  emailVerified?: boolean
}

interface Session {
  token: string
  expiresAt?: string
}

// Storage keys
const USER_KEY = 'charmventory_user'
const TOKEN_KEY = 'charmventory_token'
const JWT_KEY = 'charmventory_jwt'  // JWT for Data API

// Get auth base URL from runtime config or fallback
function getAuthUrl(): string {
  const config = useRuntimeConfig()
  return config.public.neonAuthUrl || ''
}

export function useAuth() {
  // Use Nuxt's useState for SSR-safe state that persists across navigation
  const user = useState<User | null>('auth-user', () => null)
  const session = useState<Session | null>('auth-session', () => null)
  const loading = useState('auth-loading', () => true)

  // Check both useState and localStorage for auth status
  const isAuthenticated = computed(() => {
    if (user.value) return true
    // Fallback to localStorage check for HMR/SSR edge cases
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_KEY)
      return !!stored
    }
    return false
  })

  function getStoredUser(): User | null {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(USER_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }
    return null
  }

  function storeUser(userData: User) {
    if (typeof window === 'undefined') return
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
  }

  function getStoredToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }

  function storeToken(token: string) {
    if (typeof window === 'undefined') return
    localStorage.setItem(TOKEN_KEY, token)
  }

  function getStoredJwt(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(JWT_KEY)
  }

  function storeJwt(jwt: string) {
    if (typeof window === 'undefined') return
    localStorage.setItem(JWT_KEY, jwt)
  }

  function clearStorage() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(JWT_KEY)
  }

  async function checkSession() {
    loading.value = true

    // First check localStorage for user data
    const storedUser = getStoredUser()
    if (storedUser) {
      user.value = storedUser
    }

    const authUrl = getAuthUrl()
    if (!authUrl) {
      loading.value = false
      return null
    }

    try {
      // Call Neon Auth directly
      const headers: Record<string, string> = {}
      const storedToken = getStoredToken()
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`
      }

      // Use native fetch to access response headers for JWT
      const response = await fetch(`${authUrl}/get-session`, {
        credentials: 'include',
        headers
      })

      // Capture JWT from response header (for Data API)
      const jwt = response.headers.get('set-auth-jwt')
      if (jwt) {
        storeJwt(jwt)
      }

      const res = await response.json()

      if (res && res.user) {
        const userData: User = {
          id: res.user.id || res.session?.userId || 'unknown',
          email: res.user.email,
          name: res.user.name,
          avatar: res.user.image,
          emailVerified: res.user.emailVerified
        }
        user.value = userData
        session.value = res.session
        storeUser(userData)
        if (res.session?.token) {
          storeToken(res.session.token)
        }
      } else {
        // Session invalid/expired - clear stale data
        user.value = null
        session.value = null
        clearStorage()
      }
    } catch {
      // Network error - keep stored user for offline support
      // but mark session as potentially stale
    } finally {
      loading.value = false
    }

    return user.value
  }

  async function signUp(email: string, password: string, name: string) {
    const authUrl = getAuthUrl()
    // Call Neon Auth directly
    const response = await fetch(`${authUrl}/sign-up/email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })

    // Capture JWT from response header (for Data API)
    const jwt = response.headers.get('set-auth-jwt')
    if (jwt) {
      storeJwt(jwt)
    }

    const res = await response.json()

    if (res.user) {
      const userData: User = {
        id: res.user.id || res.session?.userId || 'unknown',
        email: res.user.email,
        name: res.user.name,
        avatar: res.user.image,
        emailVerified: res.user.emailVerified
      }
      user.value = userData
      storeUser(userData)

      const token = res.session?.token || res.token || res.accessToken
      if (token) {
        storeToken(token)
        session.value = { token }
      }
    }

    return res
  }

  async function signIn(email: string, password: string) {
    const authUrl = getAuthUrl()
    // Call Neon Auth directly
    const response = await fetch(`${authUrl}/sign-in/email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    // Capture JWT from response header (for Data API)
    const jwt = response.headers.get('set-auth-jwt')
    if (jwt) {
      storeJwt(jwt)
    }

    const res = await response.json()

    if (res.user) {
      const userData: User = {
        id: res.user.id || res.session?.userId || 'unknown',
        email: res.user.email,
        name: res.user.name,
        avatar: res.user.image,
        emailVerified: res.user.emailVerified
      }
      user.value = userData
      storeUser(userData)

      const token = res.session?.token || res.token || res.accessToken
      if (token) {
        storeToken(token)
        session.value = { token }
      }
    }

    return res
  }

  async function signOut() {
    const authUrl = getAuthUrl()
    try {
      await fetch(`${authUrl}/sign-out`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
    } catch {
      // Ignore signout errors
    }

    user.value = null
    session.value = null
    clearStorage()

    // Reset Data API client to clear any cached auth state
    try {
      const { resetDataApiClient } = await import('./useDataApi')
      resetDataApiClient()
    } catch {
      // Ignore if module not available
    }

    // Redirect to root domain login (or local /auth/login in dev)
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    if (host === 'app.charmventory.com' || host === 'database.charmventory.com') {
      window.location.href = 'https://charmventory.com/auth/login'
    } else {
      navigateTo('/auth/login')
    }
  }

  function getAuthHeaders(): Record<string, string> {
    // For localhost without HTTPS, cookies won't work
    // Send token as Authorization header as fallback
    const token = getStoredToken()
    if (token) {
      return { 'Authorization': `Bearer ${token}` }
    }
    return {}
  }

  // Get the JWT for Data API (useful for debugging)
  function getJwt(): string | null {
    return getStoredJwt()
  }

  // Refresh JWT by calling get-session (JWT expires in 15 min)
  async function refreshJwt(): Promise<string | null> {
    const authUrl = getAuthUrl()
    if (!authUrl) return null

    const headers: Record<string, string> = {}
    const storedToken = getStoredToken()
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`
    }

    try {
      const response = await fetch(`${authUrl}/get-session`, {
        credentials: 'include',
        headers
      })

      const jwt = response.headers.get('set-auth-jwt')
      if (jwt) {
        storeJwt(jwt)
        return jwt
      }
    } catch (e) {
      console.error('Failed to refresh JWT:', e)
    }
    return null
  }

  // Initialize from localStorage on client side
  if (typeof window !== 'undefined' && !user.value) {
    const storedUser = getStoredUser()
    if (storedUser) {
      user.value = storedUser
    }
  }

  // Alias for backward compatibility
  const logout = signOut

  return {
    user,
    session,
    loading,
    isAuthenticated,
    checkSession,
    signUp,
    signIn,
    signOut,
    logout,
    getAuthHeaders,
    getJwt,
    refreshJwt,
  }
}
