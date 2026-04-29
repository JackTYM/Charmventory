import { useDataApi, type DbUser } from './useDataApi'

export interface AdminUserWithStats extends DbUser {
  item_count: number
  post_count: number
}

export type UserSortField = 'created_at' | 'updated_at' | 'name' | 'item_count' | 'post_count'

export function useAdminData() {
  const { from } = useDataApi()

  async function fetchUsers(sortBy: UserSortField = 'created_at', sortOrder: 'asc' | 'desc' = 'desc') {
    // Fetch all users
    const { data: users, error: usersError } = await from('users')
      .select('*')

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    if (!users || users.length === 0) {
      return { users: [], total: 0 }
    }

    // Fetch item counts per user
    const { data: items } = await from('items')
      .select('user_id')

    // Fetch post counts per user
    const { data: posts } = await from('posts')
      .select('user_id')

    // Calculate counts
    const itemCounts: Record<string, number> = {}
    const postCounts: Record<string, number> = {}

    items?.forEach((item: { user_id: string }) => {
      itemCounts[item.user_id] = (itemCounts[item.user_id] || 0) + 1
    })

    posts?.forEach((post: { user_id: string }) => {
      postCounts[post.user_id] = (postCounts[post.user_id] || 0) + 1
    })

    // Combine data
    const usersWithStats: AdminUserWithStats[] = users.map((user: DbUser) => ({
      ...user,
      item_count: itemCounts[user.id] || 0,
      post_count: postCounts[user.id] || 0,
    }))

    // Sort
    usersWithStats.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'item_count':
          comparison = a.item_count - b.item_count
          break
        case 'post_count':
          comparison = a.post_count - b.post_count
          break
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
        case 'created_at':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return {
      users: usersWithStats,
      total: usersWithStats.length,
    }
  }

  return {
    fetchUsers,
  }
}
