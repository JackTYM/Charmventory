import { requireAuth } from '../../utils/auth'
import { getPresignedUploadUrl } from '../../utils/r2'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  if (!body.filename || !body.contentType) {
    throw createError({ statusCode: 400, message: 'Filename and content type required' })
  }

  // Generate unique key with user id prefix
  const ext = body.filename.split('.').pop()
  const key = `${user.id}/${body.folder || 'items'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, body.contentType)

  return { uploadUrl, publicUrl, key }
})
