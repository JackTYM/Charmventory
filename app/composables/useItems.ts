import { ref } from 'vue'
import { useDataApi, type DbItem, type DbItemImage } from './useDataApi'
import { useAuth } from './useAuth'

interface ItemImage {
  id: string
  url: string
  category: string
  caption?: string
  sortOrder?: number
}

interface Item {
  id: string
  type: string
  name: string
  brand: string
  itemNumber?: string
  collection?: string
  description?: string
  materials?: string[]
  color?: string
  originalPrice?: number
  pricePaid?: number
  currentValue?: number
  condition: string
  rarity: number
  isLimited: boolean
  isForSale: boolean
  isForTrade: boolean
  images: ItemImage[]
  createdAt: string
}

// Transform database row to frontend format
function transformItem(row: DbItem, images: DbItemImage[] = []): Item {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    brand: row.brand || 'Pandora',
    itemNumber: row.item_number || undefined,
    collection: row.collection || undefined,
    description: row.description || undefined,
    materials: row.materials ? JSON.parse(row.materials) : [],
    color: row.color || undefined,
    originalPrice: row.original_price ? parseFloat(row.original_price) : undefined,
    pricePaid: row.price_paid ? parseFloat(row.price_paid) : undefined,
    currentValue: row.current_value ? parseFloat(row.current_value) : undefined,
    condition: row.condition || 'new',
    rarity: row.rarity || 1,
    isLimited: row.is_limited || false,
    isForSale: row.is_for_sale || false,
    isForTrade: row.is_for_trade || false,
    images: images.map(img => ({
      id: img.id,
      url: img.url,
      category: img.category || 'item',
      caption: img.caption || undefined,
      sortOrder: img.sort_order || 0,
    })),
    createdAt: row.created_at,
  }
}

// Transform frontend format to database row
function toDbItem(data: Partial<Item>): Partial<DbItem> {
  const row: Partial<DbItem> = {}

  if (data.type !== undefined) row.type = data.type
  if (data.name !== undefined) row.name = data.name
  if (data.brand !== undefined) row.brand = data.brand
  if (data.itemNumber !== undefined) row.item_number = data.itemNumber
  if (data.collection !== undefined) row.collection = data.collection
  if (data.description !== undefined) row.description = data.description
  if (data.materials !== undefined) row.materials = JSON.stringify(data.materials)
  if (data.color !== undefined) row.color = data.color
  if (data.originalPrice !== undefined) row.original_price = data.originalPrice?.toString()
  if (data.pricePaid !== undefined) row.price_paid = data.pricePaid?.toString()
  if (data.currentValue !== undefined) row.current_value = data.currentValue?.toString()
  if (data.condition !== undefined) row.condition = data.condition
  if (data.rarity !== undefined) row.rarity = data.rarity
  if (data.isLimited !== undefined) row.is_limited = data.isLimited
  if (data.isForSale !== undefined) row.is_for_sale = data.isForSale
  if (data.isForTrade !== undefined) row.is_for_trade = data.isForTrade

  return row
}

const items = ref<Item[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useItems() {
  const { from } = useDataApi()
  const { user } = useAuth()

  async function fetchItems() {
    loading.value = true
    error.value = null

    try {
      // Fetch items - explicitly filter by current user to avoid admin RLS showing all items
      const { data: itemsData, error: itemsError } = await from('items')
        .select('*')
        .eq('user_id', user.value?.id)
        .order('created_at', { ascending: false })

      if (itemsError) throw new Error(itemsError.message)
      if (!itemsData) {
        items.value = []
        return
      }

      // Fetch images for all items
      const itemIds = (itemsData as DbItem[]).map(i => i.id)
      let imagesData: DbItemImage[] = []

      if (itemIds.length > 0) {
        const { data: imgs, error: imgError } = await from('item_images')
          .select('*')
          .in('item_id', itemIds)

        if (!imgError && imgs) {
          imagesData = imgs as DbItemImage[]
        }
      }

      // Group images by item_id
      const imagesByItem = new Map<string, DbItemImage[]>()
      for (const img of imagesData) {
        const existing = imagesByItem.get(img.item_id) || []
        existing.push(img)
        imagesByItem.set(img.item_id, existing)
      }

      // Transform items with their images
      items.value = (itemsData as DbItem[]).map(item =>
        transformItem(item, imagesByItem.get(item.id) || [])
      )
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch items'
    } finally {
      loading.value = false
    }
  }

  async function createItem(data: Partial<Item>) {
    loading.value = true
    error.value = null

    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to create items')
      }

      const dbData = {
        ...toDbItem(data),
        user_id: user.value.id,
      }

      const { data: result, error: createError } = await from('items')
        .insert(dbData)
        .select()
        .single()

      if (createError) throw new Error(createError.message)

      const newItem = transformItem(result as DbItem, [])
      items.value.unshift(newItem)
      return newItem
    } catch (e: any) {
      error.value = e.message || 'Failed to create item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateItem(id: string, data: Partial<Item>) {
    loading.value = true
    error.value = null

    try {
      const dbData = toDbItem(data)

      const { data: result, error: updateError } = await from('items')
        .update(dbData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)

      const index = items.value.findIndex(i => i.id === id)
      if (index !== -1) {
        const existingImages = items.value[index].images
        items.value[index] = transformItem(result as DbItem, existingImages.map(img => ({
          id: img.id,
          item_id: id,
          url: img.url,
          category: img.category,
          caption: img.caption,
          sort_order: img.sortOrder,
          created_at: '',
        })))
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to update item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteItem(id: string) {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await from('items')
        .delete()
        .eq('id', id)

      if (deleteError) throw new Error(deleteError.message)

      items.value = items.value.filter(i => i.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete item'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addImage(itemId: string, url: string, category: string = 'item') {
    try {
      const { data: result, error: insertError } = await from('item_images')
        .insert({ item_id: itemId, url, category })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const item = items.value.find(i => i.id === itemId)
      if (item) {
        if (!item.images) {
          item.images = []
        }
        const img = result as DbItemImage
        item.images.push({
          id: img.id,
          url: img.url,
          category: img.category || 'item',
          caption: img.caption || undefined,
          sortOrder: img.sort_order || 0,
        })
      }
      return result
    } catch (e: any) {
      error.value = e.message || 'Failed to add image'
      throw e
    }
  }

  async function deleteImage(imageId: string, itemId: string) {
    try {
      const { error: deleteError } = await from('item_images')
        .delete()
        .eq('id', imageId)

      if (deleteError) throw new Error(deleteError.message)

      const item = items.value.find(i => i.id === itemId)
      if (item) {
        item.images = item.images.filter(img => img.id !== imageId)
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete image'
      throw e
    }
  }

  return {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    addImage,
    deleteImage,
  }
}
