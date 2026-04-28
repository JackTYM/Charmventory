import { resetDataApiClient } from './useDataApi'

interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  emailVerified?: boolean
}

const USER_KEY = 'charmventory_user'

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const loading = useState('auth-loading', () => true)

  const isAuthenticated = computed(() => {
    if (user.value) return true
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

  function clearStorage() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(USER_KEY)
  }

  async function checkSession() {
    loading.value = true

    const storedUser = getStoredUser()
    if (storedUser) {
      user.value = storedUser
    }

    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      })

      const res = await response.json()

      if (res.user) {
        user.value = res.user
        storeUser(res.user)
      } else {
        user.value = null
        clearStorage()
      }
    } catch {
    } finally {
      loading.value = false
    }

    return user.value
  }

  async function signUp(email: string, password: string, name: string) {
    // Reset Data API client to ensure fresh JWT is used
    resetDataApiClient()

    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })

    const res = await response.json()

    if (!response.ok) {
      throw { data: { message: res.message || 'Sign up failed' } }
    }

    if (res.user) {
      user.value = res.user
      storeUser(res.user)
    }

    return res
  }

  async function signIn(email: string, password: string) {
    // Reset Data API client to ensure fresh JWT is used
    resetDataApiClient()

    const response = await fetch('/api/auth/sign-in', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const res = await response.json()

    if (!response.ok) {
      throw { data: { message: res.message || 'Sign in failed' } }
    }

    if (res.user) {
      user.value = res.user
      storeUser(res.user)
    }

    return res
  }

  async function signOut() {
    user.value = null
    clearStorage()
    resetDataApiClient()

    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      // Continue with logout even if API call fails
    }

    window.location.href = '/auth/login'
  }

  if (typeof window !== 'undefined' && !user.value) {
    const storedUser = getStoredUser()
    if (storedUser) {
      user.value = storedUser
    }
  }

  const logout = signOut

  return {
    user,
    loading,
    isAuthenticated,
    checkSession,
    signUp,
    signIn,
    signOut,
    logout,
  }
}
