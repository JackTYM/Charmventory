import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

export interface UploadResult {
  key: string
  url: string
}

/**
 * Upload a file to R2
 */
export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  )

  return {
    key,
    url: `${PUBLIC_URL}/${key}`,
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  )
}

/**
 * Generate a presigned URL for uploading (client-side uploads)
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Get presigned upload URL with public URL (for client-side uploads)
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const uploadUrl = await getUploadPresignedUrl(key, contentType, expiresIn)
  const publicUrl = getPublicUrl(key)

  return { uploadUrl, publicUrl }
}

/**
 * Generate a presigned URL for downloading (private files)
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Generate a unique key for an image
 */
export function generateImageKey(
  userId: string,
  folder: 'items' | 'wishlist' | 'posts' | 'avatars',
  filename: string
): string {
  const timestamp = Date.now()
  const ext = filename.split('.').pop() || 'jpg'
  const sanitizedName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .substring(0, 50)

  return `${folder}/${userId}/${timestamp}-${sanitizedName}.${ext}`
}

/**
 * Get public URL for a key
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`
}
