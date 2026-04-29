import { ref } from 'vue'
import { useDataApi, type DbWishlistItem, type DbWishlistLink, type DbWishlistImage } from './useDataApi'
import { useAuth } from './useAuth'

interface WishlistLink {
  id: string
  url: string
  screenshotUrl?: string
  price?: number
  notes?: string
}

interface WishlistImage {
  id: string
  url: string
  caption?: string
}

interface WishlistItem {
  id: string
  name: string
  itemNumber?: string
  collection?: string
  materials?: string
  estimatedPrice?: number
  priority: 'high' | 'medium' | 'low'
  quantityWanted: number
  notes?: string
  links: WishlistLink[]
  images: WishlistImage[]
  createdAt: string
}

// Transform database row to frontend format
function transformWishlistItem(
  row: DbWishlistItem,
  links: DbWishlistLink[] = [],
  images: DbWishlistImage[] = []
): WishlistItem {
  return {
    id: row.id,
    name: row.name,
    itemNumber: row.item_number || undefined,
    collection: row.collection || undefined,
    materials: row.materials || undefined,
    estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price) : undefined,
    priority: (row.priority as 'high' | 'medium' | 'low') || 'medium',
    quantityWanted: row.quantity_wanted || 1,
    notes: row.notes || undefined,
    links: links.map(l => ({
      id: l.id,
      url: l.url,
      screenshotUrl: l.screenshot_url || undefined,
      price: l.price ? parseFloat(l.price) : undefined,
      notes: l.notes || undefined,
    })),
    images: images.map(img => ({
      id: img.id,
      url: img.url,
      caption: img.caption || undefined,
    })),
    createdAt: row.created_at,
  }
}

const wishlistItems = ref<WishlistItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useWishlist() {
  const { from } = useDataApi()
  const { user } = useAuth()

  async function fetchWishlist() {
    loading.value = true
    error.value = null

    try {
      // Fetch wishlist items - explicitly filter by current user to avoid admin RLS showing all items
      const { data: itemsData, error: itemsError } = await from('wishlist_items')
        .select('*')
        .eq('user_id', user.value?.id)
        .order('created_at', { ascending: false })

      if (itemsError) throw new Error(itemsError.message)
      if (!itemsData) {
        wishlistItems.value = []
        return
      }

      const itemIds = (itemsData as DbWishlistItem[]).map(i => i.id)
      let linksData: DbWishlistLink[] = []
      let imagesData: DbWishlistImage[] = []

      if (itemIds.length > 0) {
        // Fetch links and images in parallel
        const [linksResult, imagesResult] = await Promise.all([
          from('wishlist_links').select('*').in('wishlist_item_id', itemIds),
          from('wishlist_images').select('*').in('wishlist_item_id', itemIds),
        ])

        if (!linksResult.error && linksResult.data) {
          linksData = linksResult.data as DbWishlistLink[]
        }
        if (!imagesResult.error && imagesResult.data) {
          imagesData = imagesResult.data as DbWishlistImage[]
        }
      }

      // Group by item
      const linksByItem = new Map<string, DbWishlistLink[]>()
      const imagesByItem = new Map<string, DbWishlistImage[]>()

      for (const link of linksData) {
        const existing = linksByItem.get(link.wishlist_item_id) || []
        existing.push(link)
        linksByItem.set(link.wishlist_item_id, existing)
      }

      for (const img of imagesData) {
        const existing = imagesByItem.get(img.wishlist_item_id) || []
        existing.push(img)
        imagesByItem.set(img.wishlist_item_id, existing)
      }

      wishlistItems.value = (itemsData as DbWishlistItem[]).map(item =>
        transformWishlistItem(
          item,
          linksByItem.get(item.id) || [],
          imagesByItem.get(item.id) || []
        )
      )
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch wishlist'
    } finally {
      loading.value = false
    }
  }

  async function fetchWishlistItem(id: string) {
    loading.value = true
    error.value = null

    try {
      const { data: item, error: itemError } = await from('wishlist_items')
        .select('*')
        .eq('id', id)
        .single()

      if (itemError) throw new Error(itemError.message)

      // Fetch links and images
      const [linksResult, imagesResult] = await Promise.all([
        from('wishlist_links').select('*').eq('wishlist_item_id', id),
        from('wishlist_images').select('*').eq('wishlist_item_id', id),
      ])

      return transformWishlistItem(
        item as DbWishlistItem,
        (linksResult.data || []) as DbWishlistLink[],
        (imagesResult.data || []) as DbWishlistImage[]
      )
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch wishlist item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createWishlistItem(data: Partial<WishlistItem>) {
    loading.value = true
    error.value = null

    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to create wishlist items')
      }

      const dbData: Partial<DbWishlistItem> = {
        user_id: user.value.id,
        name: data.name!,
        item_number: data.itemNumber,
        collection: data.collection,
        materials: data.materials,
        estimated_price: data.estimatedPrice?.toString(),
        priority: data.priority,
        quantity_wanted: data.quantityWanted,
        notes: data.notes,
      }

      const { data: result, error: createError } = await from('wishlist_items')
        .insert(dbData)
        .select()
        .single()

      if (createError) throw new Error(createError.message)

      const newItem = transformWishlistItem(result as DbWishlistItem, [], [])
      wishlistItems.value.unshift(newItem)
      return newItem
    } catch (e: any) {
      error.value = e.message || 'Failed to create wishlist item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateWishlistItem(id: string, data: Partial<WishlistItem>) {
    loading.value = true
    error.value = null

    try {
      const dbData: Partial<DbWishlistItem> = {}
      if (data.name !== undefined) dbData.name = data.name
      if (data.itemNumber !== undefined) dbData.item_number = data.itemNumber
      if (data.collection !== undefined) dbData.collection = data.collection
      if (data.materials !== undefined) dbData.materials = data.materials
      if (data.estimatedPrice !== undefined) dbData.estimated_price = data.estimatedPrice?.toString()
      if (data.priority !== undefined) dbData.priority = data.priority
      if (data.quantityWanted !== undefined) dbData.quantity_wanted = data.quantityWanted
      if (data.notes !== undefined) dbData.notes = data.notes

      const { data: result, error: updateError } = await from('wishlist_items')
        .update(dbData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)

      const index = wishlistItems.value.findIndex(i => i.id === id)
      if (index !== -1) {
        const existingLinks = wishlistItems.value[index].links
        const existingImages = wishlistItems.value[index].images
        wishlistItems.value[index] = {
          ...transformWishlistItem(result as DbWishlistItem, [], []),
          links: existingLinks,
          images: existingImages,
        }
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to update wishlist item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteWishlistItem(id: string) {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await from('wishlist_items')
        .delete()
        .eq('id', id)

      if (deleteError) throw new Error(deleteError.message)

      wishlistItems.value = wishlistItems.value.filter(i => i.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete wishlist item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addLink(itemId: string, url: string, notes?: string) {
    try {
      const { data: result, error: insertError } = await from('wishlist_links')
        .insert({ wishlist_item_id: itemId, url, notes })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const item = wishlistItems.value.find(i => i.id === itemId)
      if (item) {
        const link = result as DbWishlistLink
        item.links.push({
          id: link.id,
          url: link.url,
          screenshotUrl: link.screenshot_url || undefined,
          price: link.price ? parseFloat(link.price) : undefined,
          notes: link.notes || undefined,
        })
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to add link'
      throw e
    }
  }

  async function deleteLink(linkId: string, itemId: string) {
    try {
      const { error: deleteError } = await from('wishlist_links')
        .delete()
        .eq('id', linkId)

      if (deleteError) throw new Error(deleteError.message)

      const item = wishlistItems.value.find(i => i.id === itemId)
      if (item) {
        item.links = item.links.filter(l => l.id !== linkId)
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete link'
      throw e
    }
  }

  async function addImage(itemId: string, url: string, caption?: string) {
    try {
      const { data: result, error: insertError } = await from('wishlist_images')
        .insert({ wishlist_item_id: itemId, url, caption })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const item = wishlistItems.value.find(i => i.id === itemId)
      if (item) {
        const img = result as DbWishlistImage
        item.images.push({
          id: img.id,
          url: img.url,
          caption: img.caption || undefined,
        })
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to add image'
      throw e
    }
  }

  return {
    wishlistItems,
    loading,
    error,
    fetchWishlist,
    fetchWishlistItem,
    createWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    addLink,
    deleteLink,
    addImage,
  }
}
