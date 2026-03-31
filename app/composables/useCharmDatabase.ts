import { ref } from 'vue'
import { createClient } from '@neondatabase/neon-js'

interface CharmImage {
  id: string
  url: string
  image_type: string
  caption?: string
}

interface CharmSighting {
  id: string
  catalog_name?: string
  year?: number
  season?: string
  region?: string
  extracted_name?: string
  extracted_price?: number
  extracted_currency?: string
  image_url?: string
  source_url?: string
}

interface Charm {
  style_id: string
  name: string
  brand: string
  collection?: string
  type: string
  release_date?: string
  discontinue_date?: string
  catalogue_season?: string
  original_price?: number
  currency?: string
  region?: string
  materials?: string
  colors?: string
  description?: string
  is_limited: boolean
  is_country_exclusive: boolean
  exclusive_country?: string
  is_retired: boolean
  verified: boolean
  created_at: string
}

interface CatalogPage {
  id: string
  catalog_name: string
  year: number
  season?: string
  region?: string
  page_number?: number
  image_url: string
  approved: boolean
  created_at: string
}

// Singleton client instance
let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (typeof window === 'undefined') return null

  if (!client) {
    const config = useRuntimeConfig()

    if (!config.public.neonAuthUrl || !config.public.neonDataApiUrl) {
      console.warn('Neon Auth URL or Data API URL not configured')
      return null
    }

    client = createClient({
      auth: {
        url: config.public.neonAuthUrl,
        allowAnonymous: true, // Enable anonymous access for public data
      },
      dataApi: {
        url: config.public.neonDataApiUrl,
      },
    })
  }

  return client
}

const charms = ref<Charm[]>([])
const charmsTotal = ref(0)
const catalogPages = ref<CatalogPage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useCharmDatabase() {
  async function searchCharms(options: {
    search?: string
    collection?: string
    type?: string
    year?: string
    region?: string
    source?: string
    isLimited?: boolean
    isRetired?: boolean
    offset?: number
    limit?: number
  } = {}) {
    loading.value = true
    error.value = null

    try {
      const db = getClient()
      if (!db) throw new Error('Database client not available')

      const limit = options.limit || 50
      const offset = options.offset || 0

      // If filtering by source, query sightings directly
      if (options.source) {
        let query = db
          .from('charm_sightings')
          .select('style_id, image_url, extracted_name, extracted_price, extracted_currency', { count: 'exact' })
          .eq('scraped_by', options.source)
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit * 3 - 1)

        const { data: sightings, error: queryError, count: sightingsCount } = await query
        if (queryError) throw queryError

        // Dedupe by style_id
        const seen = new Set<string>()
        const deduped = (sightings || []).filter((s: any) => {
          if (seen.has(s.style_id)) return false
          seen.add(s.style_id)
          return true
        }).slice(0, limit)

        const transformedData = deduped.map((s: any) => ({
          styleId: s.style_id,
          name: s.extracted_name || s.style_id,
          brand: 'Pandora',
          collection: null,
          type: 'charm',
          originalPrice: s.extracted_price ? parseFloat(String(s.extracted_price)) : null,
          currency: s.extracted_currency || 'USD',
          primaryImage: s.image_url,
          isLimited: false,
          isCountryExclusive: false,
          isRetired: false,
          verified: false,
          createdAt: null,
        }))

        if (options.offset && options.offset > 0) {
          charms.value = [...charms.value, ...transformedData]
        } else {
          charms.value = transformedData
        }
        charmsTotal.value = sightingsCount || 0
        return charms.value
      }

      // Default: use charm_browse view (excludes archive.org, pre-joined)
      let query = db
        .from('charm_browse')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,style_id.ilike.%${options.search}%`)
      }
      if (options.collection) {
        query = query.eq('collection', options.collection)
      }
      if (options.type) {
        query = query.eq('type', options.type)
      }
      if (options.isLimited) {
        query = query.eq('is_limited', true)
      }
      if (options.isRetired) {
        query = query.eq('is_retired', true)
      }

      const { data, error: queryError, count } = await query
      if (queryError) throw queryError

      const transformedData = (data || []).map((charm: any) => ({
        styleId: charm.style_id,
        name: charm.name,
        brand: charm.brand || 'Pandora',
        collection: charm.collection,
        type: charm.type,
        releaseDate: charm.release_date,
        discontinueDate: charm.discontinue_date,
        catalogueSeason: charm.catalogue_season,
        originalPrice: charm.original_price ? parseFloat(String(charm.original_price)) : null,
        currency: charm.currency || 'USD',
        region: charm.region,
          materials: charm.materials ? (typeof charm.materials === 'string' ? JSON.parse(charm.materials) : charm.materials) : [],
          colors: charm.colors ? (typeof charm.colors === 'string' ? JSON.parse(charm.colors) : charm.colors) : [],
          description: charm.description,
          isLimited: charm.is_limited || false,
          isCountryExclusive: charm.is_country_exclusive || false,
          exclusiveCountry: charm.exclusive_country,
          isRetired: charm.is_retired || false,
          verified: charm.verified || false,
          createdAt: charm.created_at,
          primaryImage: charm.primary_image,
      }))

      // If offset > 0, append to existing charms (load more)
      if (options.offset && options.offset > 0) {
        charms.value = [...charms.value, ...transformedData]
      } else {
        charms.value = transformedData
      }
      charmsTotal.value = count || 0

      return charms.value
    } catch (e: any) {
      error.value = e.message || 'Failed to search charms'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getCharm(styleId: string) {
    loading.value = true
    error.value = null

    try {
      const db = getClient()
      if (!db) throw new Error('Database client not available')

      // Get charm
      const { data: charmData, error: charmError } = await db
        .from('charm_database')
        .select('*')
        .eq('style_id', styleId)
        .single()

      if (charmError) throw charmError
      if (!charmData) throw new Error('Charm not found')

      // Get images
      const { data: images } = await db
        .from('charm_images')
        .select('id, url, image_type, caption')
        .eq('style_id', styleId)

      // Get sightings
      const { data: sightings } = await db
        .from('charm_sightings')
        .select('id, catalog_name, year, season, region, extracted_name, extracted_price, extracted_currency, image_url, source_url')
        .eq('style_id', styleId)
        .order('year', { ascending: false })

      return {
        styleId: charmData.style_id,
        name: charmData.name,
        brand: charmData.brand || 'Pandora',
        collection: charmData.collection,
        type: charmData.type,
        releaseDate: charmData.release_date,
        discontinueDate: charmData.discontinue_date,
        catalogueSeason: charmData.catalogue_season,
        originalPrice: charmData.original_price ? parseFloat(String(charmData.original_price)) : null,
        currency: charmData.currency || 'USD',
        region: charmData.region,
        materials: charmData.materials ? (typeof charmData.materials === 'string' ? JSON.parse(charmData.materials) : charmData.materials) : [],
        colors: charmData.colors ? (typeof charmData.colors === 'string' ? JSON.parse(charmData.colors) : charmData.colors) : [],
        description: charmData.description,
        isLimited: charmData.is_limited || false,
        isCountryExclusive: charmData.is_country_exclusive || false,
        exclusiveCountry: charmData.exclusive_country,
        isRetired: charmData.is_retired || false,
        verified: charmData.verified || false,
        createdAt: charmData.created_at,
        images: (images || []).map((img: CharmImage) => ({
          id: img.id,
          url: img.url,
          imageType: img.image_type || 'official',
          caption: img.caption,
        })),
        sightings: (sightings || []).map((s: CharmSighting) => ({
          id: s.id,
          catalogName: s.catalog_name,
          year: s.year,
          season: s.season,
          region: s.region,
          name: s.extracted_name,
          price: s.extracted_price ? parseFloat(String(s.extracted_price)) : null,
          currency: s.extracted_currency || 'USD',
          imageUrl: s.image_url,
          sourceUrl: s.source_url,
        })),
        primaryImage: (sightings || []).find((s: CharmSighting) => s.image_url)?.image_url || (images || [])[0]?.url || null,
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to get charm'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function submitContribution(data: {
    styleId: string
    contributionType: 'new_charm' | 'edit_field' | 'add_image'
    field?: string
    oldValue?: string
    newValue?: string
    imageUrl?: string
    notes?: string
    charmData?: Record<string, any>
  }) {
    loading.value = true
    error.value = null

    try {
      // Contributions require auth - use server endpoint
      const response = await $fetch('/api/database/charm-contributions', {
        method: 'POST',
        body: data,
      })
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to submit contribution'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchCatalogPages(options: {
    year?: number
    season?: string
    region?: string
  } = {}) {
    loading.value = true
    error.value = null

    try {
      const db = getClient()
      if (!db) throw new Error('Database client not available')

      let query = db
        .from('catalog_pages')
        .select('id, catalog_name, year, season, region, page_number, image_url, approved, created_at')
        .eq('approved', true)
        .order('year', { ascending: false })
        .order('page_number', { ascending: true })

      if (options.year) {
        query = query.eq('year', options.year)
      }
      if (options.season) {
        query = query.eq('season', options.season)
      }
      if (options.region) {
        query = query.eq('region', options.region)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      catalogPages.value = (data || []).map((page: CatalogPage) => ({
        id: page.id,
        catalogName: page.catalog_name,
        year: page.year,
        season: page.season,
        region: page.region,
        pageNumber: page.page_number,
        imageUrl: page.image_url,
        approved: page.approved,
        createdAt: page.created_at,
      }))

      return catalogPages.value
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch catalog pages'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function uploadCatalogPage(data: {
    catalogName: string
    year: number
    season?: string
    region?: string
    pageNumber?: number
    imageUrl: string
  }) {
    loading.value = true
    error.value = null

    try {
      // Upload requires auth - use server endpoint
      const response = await $fetch('/api/catalog-pages', {
        method: 'POST',
        body: data,
      })
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to upload catalog page'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getSources() {
    try {
      // Use server endpoint for aggregation (GROUP BY)
      const response = await $fetch<{ data: Array<{ id: string; name: string; count: number }> }>('/api/database/sources')
      return response.data
    } catch (e) {
      console.error('Failed to get sources:', e)
      return []
    }
  }

  return {
    charms,
    charmsTotal,
    catalogPages,
    loading,
    error,
    searchCharms,
    getCharm,
    submitContribution,
    fetchCatalogPages,
    uploadCatalogPage,
    getSources,
  }
}

// Reset client (useful for testing or re-initialization)
export function resetCharmDatabaseClient() {
  client = null
}
