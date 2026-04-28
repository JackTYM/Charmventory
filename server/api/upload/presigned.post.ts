import { getUserFromRequest } from '../../utils/auth'
import { getPresignedUploadUrl } from '../../utils/r2'

const ALLOWED_ANONYMOUS_CONTENT_TYPES = ['application/pdf']
const ALLOWED_ANONYMOUS_FOLDERS = ['catalogs', 'contributions']

export default defineEventHandler(async (event) => {
  const user = await getUserFromRequest(event)
  const body = await readBody(event)

  if (!body.filename || !body.contentType) {
    throw createError({ statusCode: 400, message: 'Filename and content type required' })
  }

  const folder = body.folder || 'items'

  // Anonymous uploads only allowed for specific content types and folders
  if (!user) {
    if (!ALLOWED_ANONYMOUS_CONTENT_TYPES.includes(body.contentType)) {
      throw createError({ statusCode: 401, message: 'Authentication required for this file type' })
    }
    if (!ALLOWED_ANONYMOUS_FOLDERS.includes(folder)) {
      throw createError({ statusCode: 401, message: 'Authentication required for this upload location' })
    }
  }

  // Generate unique key
  const ext = body.filename.split('.').pop()
  const prefix = user ? user.id : 'anonymous'
  const key = `${prefix}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, body.contentType)

  return { uploadUrl, publicUrl, key }
})
