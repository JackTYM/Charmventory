import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let _r2Client: S3Client | null = null
let _bucketName: string = ''
let _publicUrl: string = ''

function getR2Config() {
  if (!_r2Client) {
    const config = useRuntimeConfig()
    if (!config.r2Endpoint || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
      throw new Error('R2 configuration incomplete')
    }
    _r2Client = new S3Client({
      region: 'auto',
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    })
    _bucketName = config.r2BucketName
    _publicUrl = config.r2PublicUrl
  }
  return { client: _r2Client, bucketName: _bucketName, publicUrl: _publicUrl }
}

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
  const { client, bucketName, publicUrl } = getR2Config()
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  )

  return {
    key,
    url: `${publicUrl}/${key}`,
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const { client, bucketName } = getR2Config()
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
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
  const { client, bucketName } = getR2Config()
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn })
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
  const pubUrl = getPublicUrl(key)

  return { uploadUrl, publicUrl: pubUrl }
}

/**
 * Generate a presigned URL for downloading (private files)
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const { client, bucketName } = getR2Config()
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn })
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
  const { publicUrl } = getR2Config()
  return `${publicUrl}/${key}`
}
