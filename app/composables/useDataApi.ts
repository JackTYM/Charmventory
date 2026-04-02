import { NeonPostgrestClient } from '@neondatabase/postgrest-js'

function getJwtFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )auth_jwt=([^;]+)/)
  return match?.[1] ?? null
}

// Create authenticated fetch wrapper
function createAuthenticatedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const jwt = getJwtFromCookie()
    console.log('[DataAPI] Making request, JWT present:', !!jwt, 'JWT length:', jwt?.length)

    if (!jwt) {
      console.error('[DataAPI] No JWT found in localStorage - user needs to re-authenticate')
      throw new Error('Not authenticated - no JWT found. Please log in again.')
    }

    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${jwt}`)

    console.log('[DataAPI] Request URL:', input.toString())

    return fetch(input, {
      ...init,
      headers,
    })
  }
}

// Singleton client instance
let client: NeonPostgrestClient | null = null

export function useDataApi() {
  const config = useRuntimeConfig()

  // Initialize client lazily
  if (typeof window !== 'undefined' && !client) {
    client = new NeonPostgrestClient({
      dataApiUrl: config.public.neonDataApiUrl,
      options: {
        global: {
          fetch: createAuthenticatedFetch(),
        },
      },
    })
  }

  // For SSR, return a placeholder that will error if used
  if (!client) {
    return {
      client: null as any,
      from: (_table: string) => {
        throw new Error('Data API not available on server side')
      },
      rpc: (_fn: string, _params?: Record<string, unknown>) => {
        throw new Error('Data API not available on server side')
      },
    }
  }

  return {
    client,
    // Shorthand for common operations
    from: (table: string) => client!.from(table),
    rpc: (fn: string, params?: Record<string, unknown>) => client!.rpc(fn, params),
  }
}

// Reset client (call after sign out to clear any cached state)
export function resetDataApiClient() {
  client = null
}

// Type helpers for common tables
export interface DbItem {
  id: string
  user_id: string
  type: string
  name: string
  brand?: string
  item_number?: string
  collection?: string
  description?: string
  materials?: string
  color?: string
  collaboration?: string
  catalogue_release?: string
  hallmark_visible?: string
  original_price?: string
  price_paid?: string
  current_value?: string
  amount_on_hand?: number
  condition?: string
  damage_notes?: string
  rarity?: number
  is_limited?: boolean
  is_country_exclusive?: boolean
  country_exclusive?: string
  is_gift_with_purchase?: boolean
  is_numbered_gwp?: boolean
  gwp_number?: string
  weight_grams?: string
  size?: string
  is_authentic?: string
  authentication_status?: string
  authenticated_by?: string
  source?: string
  source_name?: string
  date_purchased?: string
  warranty_end?: string
  warranty_contact?: string
  care_plan_end?: string
  care_plan_years?: number
  notes?: string
  custom_metadata?: string
  is_for_sale?: boolean
  is_for_trade?: boolean
  asking_price?: string
  created_at: string
  updated_at: string
}

export interface DbItemImage {
  id: string
  item_id: string
  url: string
  category?: string
  caption?: string
  sort_order?: number
  created_at: string
}

export interface DbWishlistItem {
  id: string
  user_id: string
  name: string
  item_number?: string
  collection?: string
  materials?: string
  estimated_price?: string
  priority?: string
  quantity_wanted?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface DbWishlistLink {
  id: string
  wishlist_item_id: string
  url: string
  screenshot_url?: string
  price?: string
  notes?: string
  created_at: string
}

export interface DbWishlistImage {
  id: string
  wishlist_item_id: string
  url: string
  caption?: string
  created_at: string
}

export interface DbSeller {
  id: string
  name: string
  source_type?: string
  platform?: string
  url?: string
  created_at: string
}

export interface DbSellerReview {
  id: string
  seller_id: string
  user_id: string
  is_vouch: boolean
  message?: string
  created_at: string
}

export interface DbUserSellerList {
  id: string
  user_id: string
  seller_id: string
  list_type: string
  notes?: string
  created_at: string
}

export interface DbPost {
  id: string
  user_id: string
  content?: string
  post_type?: string
  created_at: string
  updated_at: string
}

export interface DbPostImage {
  id: string
  post_id: string
  url: string
  caption?: string
  sort_order?: number
  created_at: string
}

export interface DbUser {
  id: string
  email: string
  name?: string
  slug?: string
  avatar?: string
  bio?: string
  social_links?: string
  created_at: string
  updated_at: string
}
