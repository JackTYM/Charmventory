import { ref } from 'vue'
import { useDataApi, type DbSeller, type DbSellerReview, type DbUserSellerList } from './useDataApi'
import { useAuth } from './useAuth'

interface SellerReview {
  id: string
  userId: string
  isVouch: boolean
  message?: string
}

interface Seller {
  id: string
  name: string
  sourceType?: string
  platform: string
  url?: string
  vouchCount?: number
  warnCount?: number
  reviews?: SellerReview[]
  createdBy?: string
  createdAt: string
}

interface UserSellerList {
  id: string
  sellerId: string
  listType: 'preferred' | 'do_not_buy'
  notes?: string
  seller?: Seller
}

function transformSeller(row: DbSeller, reviews: DbSellerReview[] = []): Seller {
  const sellerReviews = reviews.filter(r => r.seller_id === row.id)
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type || undefined,
    platform: row.platform || 'other',
    url: row.url || undefined,
    vouchCount: sellerReviews.filter(r => r.is_vouch).length,
    warnCount: sellerReviews.filter(r => !r.is_vouch).length,
    reviews: sellerReviews.map(r => ({
      id: r.id,
      userId: r.user_id,
      isVouch: r.is_vouch,
      message: r.message || undefined,
    })),
    createdBy: (row as any).created_by || undefined,
    createdAt: row.created_at,
  }
}

const sellers = ref<Seller[]>([])
const userLists = ref<{ preferred: UserSellerList[]; doNotBuy: UserSellerList[] }>({
  preferred: [],
  doNotBuy: [],
})
const loading = ref(false)
const error = ref<string | null>(null)

export function useSellers() {
  const { from } = useDataApi()

  async function fetchSellers() {
    loading.value = true
    error.value = null

    try {
      // Fetch sellers
      const { data: sellersData, error: sellersError } = await from('sellers')
        .select('*')
        .order('created_at', { ascending: false })

      if (sellersError) throw new Error(sellersError.message)

      // Fetch all reviews
      const { data: reviewsData, error: reviewsError } = await from('seller_reviews')
        .select('*')

      if (reviewsError) throw new Error(reviewsError.message)

      sellers.value = (sellersData as DbSeller[] || []).map(s =>
        transformSeller(s, reviewsData as DbSellerReview[] || [])
      )
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch sellers'
    } finally {
      loading.value = false
    }
  }

  async function fetchUserLists() {
    loading.value = true
    error.value = null

    try {
      // Fetch user lists without join to avoid ambiguity
      const { data, error: queryError } = await from('user_seller_lists')
        .select('*')

      if (queryError) throw new Error(queryError.message)
      if (!data || data.length === 0) {
        userLists.value = { preferred: [], doNotBuy: [] }
        return
      }

      // Fetch sellers separately
      const sellerIds = [...new Set((data as any[]).map(row => row.seller_id))]
      const { data: sellersData } = await from('sellers')
        .select('*')
        .in('id', sellerIds)

      const sellersMap = new Map((sellersData || []).map((s: any) => [s.id, s]))

      const lists = (data as any[]).map((row: any) => {
        const seller = sellersMap.get(row.seller_id)
        return {
          id: row.id,
          sellerId: row.seller_id,
          listType: row.list_type as 'preferred' | 'do_not_buy',
          notes: row.notes || undefined,
          seller: seller ? {
            id: seller.id,
            name: seller.name,
            sourceType: seller.source_type,
            platform: seller.platform || 'other',
            url: seller.url,
            createdAt: seller.created_at,
          } : undefined,
        }
      })

      userLists.value = {
        preferred: lists.filter((l: UserSellerList) => l.listType === 'preferred'),
        doNotBuy: lists.filter((l: UserSellerList) => l.listType === 'do_not_buy'),
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch seller lists'
    } finally {
      loading.value = false
    }
  }

  async function createSeller(data: { name: string; sourceType?: string; platform: string; url?: string }) {
    loading.value = true
    error.value = null

    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to create seller')
      }

      const { data: result, error: insertError } = await from('sellers')
        .insert({
          name: data.name,
          source_type: data.sourceType,
          platform: data.platform,
          url: data.url,
          created_by: user.value.id,
        })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      const newSeller = transformSeller(result as DbSeller)
      if (!sellers.value.find(s => s.id === newSeller.id)) {
        sellers.value.unshift(newSeller)
      }
      return newSeller
    } catch (e: any) {
      error.value = e.message || 'Failed to create seller'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteSeller(sellerId: string) {
    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to delete seller')
      }

      const { error: deleteError } = await from('sellers')
        .delete()
        .eq('id', sellerId)
        .eq('created_by', user.value.id)

      if (deleteError) throw new Error(deleteError.message)

      sellers.value = sellers.value.filter(s => s.id !== sellerId)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete seller'
      throw e
    }
  }

  async function addToList(sellerId: string, listType: 'preferred' | 'do_not_buy', notes?: string) {
    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to add to list')
      }

      // Insert the list entry
      const { data: result, error: insertError } = await from('user_seller_lists')
        .insert({
          user_id: user.value.id,
          seller_id: sellerId,
          list_type: listType,
          notes,
        })
        .select('*')
        .single()

      if (insertError) throw new Error(insertError.message)

      // Fetch seller data separately to avoid join ambiguity
      const { data: sellerData } = await from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single()

      const row = result as any
      const newEntry: UserSellerList = {
        id: row.id,
        sellerId: row.seller_id,
        listType: row.list_type,
        notes: row.notes || undefined,
        seller: sellerData ? {
          id: sellerData.id,
          name: sellerData.name,
          sourceType: sellerData.source_type,
          platform: sellerData.platform || 'other',
          url: sellerData.url,
          createdAt: sellerData.created_at,
        } : undefined,
      }

      if (listType === 'preferred') {
        userLists.value.preferred.push(newEntry)
      } else {
        userLists.value.doNotBuy.push(newEntry)
      }
      return newEntry
    } catch (e: any) {
      error.value = e.message || 'Failed to add to list'
      throw e
    }
  }

  async function removeFromList(sellerId: string) {
    try {
      const { error: deleteError } = await from('user_seller_lists')
        .delete()
        .eq('seller_id', sellerId)

      if (deleteError) throw new Error(deleteError.message)

      userLists.value.preferred = userLists.value.preferred.filter(l => l.sellerId !== sellerId)
      userLists.value.doNotBuy = userLists.value.doNotBuy.filter(l => l.sellerId !== sellerId)
    } catch (e: any) {
      error.value = e.message || 'Failed to remove from list'
      throw e
    }
  }

  async function setReview(sellerId: string, isVouch: boolean, message?: string) {
    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to review')
      }

      const seller = sellers.value.find(s => s.id === sellerId)
      const existingReview = seller?.reviews?.find(r => r.userId === user.value?.id)

      if (existingReview) {
        const { error: updateError } = await from('seller_reviews')
          .update({ is_vouch: isVouch, message: message || null })
          .eq('id', existingReview.id)

        if (updateError) throw new Error(updateError.message)

        if (seller) {
          const wasVouch = existingReview.isVouch
          if (wasVouch !== isVouch) {
            if (isVouch) {
              seller.vouchCount = (seller.vouchCount || 0) + 1
              seller.warnCount = Math.max(0, (seller.warnCount || 0) - 1)
            } else {
              seller.warnCount = (seller.warnCount || 0) + 1
              seller.vouchCount = Math.max(0, (seller.vouchCount || 0) - 1)
            }
          }
          existingReview.isVouch = isVouch
          existingReview.message = message
        }
      } else {
        const { data: result, error: insertError } = await from('seller_reviews')
          .insert({
            user_id: user.value.id,
            seller_id: sellerId,
            is_vouch: isVouch,
            message,
          })
          .select()
          .single()

        if (insertError) throw new Error(insertError.message)

        if (seller) {
          if (isVouch) {
            seller.vouchCount = (seller.vouchCount || 0) + 1
          } else {
            seller.warnCount = (seller.warnCount || 0) + 1
          }
          seller.reviews = seller.reviews || []
          seller.reviews.push({
            id: (result as any).id,
            userId: user.value.id,
            isVouch,
            message,
          })
        }
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to set review'
      throw e
    }
  }

  async function removeReview(sellerId: string) {
    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to remove review')
      }

      const seller = sellers.value.find(s => s.id === sellerId)
      const existingReview = seller?.reviews?.find(r => r.userId === user.value?.id)

      const { error: deleteError } = await from('seller_reviews')
        .delete()
        .eq('seller_id', sellerId)
        .eq('user_id', user.value.id)

      if (deleteError) throw new Error(deleteError.message)

      if (seller && existingReview) {
        if (existingReview.isVouch) {
          seller.vouchCount = Math.max(0, (seller.vouchCount || 0) - 1)
        } else {
          seller.warnCount = Math.max(0, (seller.warnCount || 0) - 1)
        }
        seller.reviews = seller.reviews?.filter(r => r.userId !== user.value?.id)
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to remove review'
      throw e
    }
  }

  return {
    sellers,
    userLists,
    loading,
    error,
    fetchSellers,
    fetchUserLists,
    createSeller,
    deleteSeller,
    addToList,
    removeFromList,
    reviewSeller: setReview,
    removeReview,
  }
}
