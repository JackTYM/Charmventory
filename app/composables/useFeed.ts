import { ref } from 'vue'
import { useDataApi, type DbPost, type DbPostImage, type DbUser } from './useDataApi'
import { useAuth } from './useAuth'

interface PostImage {
  id: string
  url: string
  caption?: string
}

interface PostItemTag {
  id: string
  itemNumber: string
}

interface PostUser {
  id: string
  name?: string
  avatar?: string
}

interface Post {
  id: string
  userId: string
  user: PostUser
  content?: string
  postType?: string
  images: PostImage[]
  itemTags: PostItemTag[]
  createdAt: string
}

const posts = ref<Post[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const hasMore = ref(true)

export function useFeed() {
  const { from } = useDataApi()

  async function fetchPosts(options: {
    offset?: number
    limit?: number
    postType?: string
    itemNumber?: string
    userId?: string
  } = {}) {
    loading.value = true
    error.value = null

    try {
      const limit = options.limit || 20
      const offset = options.offset || 0

      // Build query - fetch posts with images and tags (no FK join for users)
      let query = from('posts')
        .select('*, post_images(*), post_item_tags(*)')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (options.postType) {
        query = query.eq('post_type', options.postType)
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId)
      }

      const { data, error: queryError } = await query

      if (queryError) throw new Error(queryError.message)

      // Get unique user IDs and fetch user data separately
      const userIds = [...new Set((data || []).map((row: any) => row.user_id))]
      const { data: usersData } = userIds.length > 0
        ? await from('users').select('id, name, avatar').in('id', userIds)
        : { data: [] }

      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))

      const newPosts: Post[] = (data || []).map((row: any) => {
        const user = usersMap.get(row.user_id)
        return {
          id: row.id,
          userId: row.user_id,
          user: {
            id: user?.id || row.user_id,
            name: user?.name,
            avatar: user?.avatar,
          },
          content: row.content || undefined,
          postType: row.post_type || undefined,
          images: (row.post_images || []).map((img: any) => ({
            id: img.id,
            url: img.url,
            caption: img.caption || undefined,
          })),
          itemTags: (row.post_item_tags || []).map((tag: any) => ({
            id: tag.id,
            itemNumber: tag.item_number,
          })),
          createdAt: row.created_at,
        }
      })

      // Filter by itemNumber if specified (post-filter since it's in related table)
      let filteredPosts = newPosts
      if (options.itemNumber) {
        filteredPosts = newPosts.filter(p =>
          p.itemTags.some(t => t.itemNumber === options.itemNumber)
        )
      }

      if (options.offset) {
        posts.value.push(...filteredPosts)
      } else {
        posts.value = filteredPosts
      }

      hasMore.value = newPosts.length === limit
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch posts'
    } finally {
      loading.value = false
    }
  }

  async function createPost(data: {
    content?: string
    postType?: string
    imageUrls?: string[]
    itemTags?: string[]
  }) {
    loading.value = true
    error.value = null

    try {
      const { user } = useAuth()
      if (!user.value?.id) {
        throw new Error('Must be logged in to create posts')
      }

      // Create the post
      const { data: postResult, error: postError } = await from('posts')
        .insert({
          user_id: user.value.id,
          content: data.content,
          post_type: data.postType,
        })
        .select()
        .single()

      if (postError) throw new Error(postError.message)

      const postId = (postResult as DbPost).id

      // Add images
      if (data.imageUrls?.length) {
        const { error: imgError } = await from('post_images')
          .insert(data.imageUrls.map((url, i) => ({
            post_id: postId,
            url,
            sort_order: i,
          })))

        if (imgError) throw new Error(imgError.message)
      }

      // Add item tags
      if (data.itemTags?.length) {
        const { error: tagError } = await from('post_item_tags')
          .insert(data.itemTags.map(itemNumber => ({
            post_id: postId,
            item_number: itemNumber,
          })))

        if (tagError) throw new Error(tagError.message)
      }

      // Fetch the complete post with relations
      const { data: fullPost, error: fetchError } = await from('posts')
        .select('*, post_images(*), post_item_tags(*)')
        .eq('id', postId)
        .single()

      if (fetchError) throw new Error(fetchError.message)

      const row = fullPost as any

      // Fetch user data separately
      const { data: userData } = await from('users')
        .select('id, name, avatar')
        .eq('id', row.user_id)
        .single()

      const newPost: Post = {
        id: row.id,
        userId: row.user_id,
        user: {
          id: userData?.id || row.user_id,
          name: userData?.name,
          avatar: userData?.avatar,
        },
        content: row.content || undefined,
        postType: row.post_type || undefined,
        images: (row.post_images || []).map((img: any) => ({
          id: img.id,
          url: img.url,
          caption: img.caption || undefined,
        })),
        itemTags: (row.post_item_tags || []).map((tag: any) => ({
          id: tag.id,
          itemNumber: tag.item_number,
        })),
        createdAt: row.created_at,
      }

      posts.value.unshift(newPost)
      return newPost
    } catch (e: any) {
      error.value = e.message || 'Failed to create post'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePost(id: string) {
    try {
      const { error: deleteError } = await from('posts')
        .delete()
        .eq('id', id)

      if (deleteError) throw new Error(deleteError.message)

      posts.value = posts.value.filter(p => p.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete post'
      throw e
    }
  }

  function clearPosts() {
    posts.value = []
    hasMore.value = true
  }

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchPosts,
    createPost,
    deletePost,
    clearPosts,
  }
}
