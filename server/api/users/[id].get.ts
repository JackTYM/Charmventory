import { db } from '~/server/db'
import { users, profilePrivacy, items, posts } from '~/server/db/schema'
import { eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'User ID required' })
  }

  // Try to find user by slug first, then by ID
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      bio: users.bio,
      socialLinks: users.socialLinks,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.slug, id))
    .limit(1)

  // If not found by slug, try by ID
  const userData = user || (await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      bio: users.bio,
      socialLinks: users.socialLinks,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1))[0]

  if (!userData) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Get privacy settings
  const [privacy] = await db
    .select()
    .from(profilePrivacy)
    .where(eq(profilePrivacy.userId, userData.id))
    .limit(1)

  // Get counts
  const [itemCount] = await db
    .select({ count: count() })
    .from(items)
    .where(eq(items.userId, userData.id))

  const [postCount] = await db
    .select({ count: count() })
    .from(posts)
    .where(eq(posts.userId, userData.id))

  return {
    ...userData,
    privacy: {
      collection: privacy?.collectionPublic ?? true,
      wishlist: privacy?.wishlistPublic ?? false,
      forSale: privacy?.forSalePublic ?? true,
    },
    itemCount: itemCount?.count ?? 0,
    postCount: postCount?.count ?? 0,
  }
})
