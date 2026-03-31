import { useAuth } from './useAuth'

export function useUpload() {
  const { getAuthHeaders } = useAuth()

  async function uploadFile(file: File, folder: string = 'items'): Promise<string> {
    // Get presigned URL
    const { uploadUrl, publicUrl } = await $fetch('/api/upload/presigned', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: {
        filename: file.name,
        contentType: file.type,
        folder
      }
    }) as { uploadUrl: string; publicUrl: string }

    // Upload to R2
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })

    return publicUrl
  }

  // Alias for backwards compatibility
  const uploadImage = uploadFile

  return {
    uploadFile,
    uploadImage
  }
}
