const MAX_IMAGE_DIMENSION = 2048
const JPEG_QUALITY = 0.85

// Compress image using Canvas API
async function compressImage(file: File): Promise<Blob> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Skip GIFs (preserve animation) and SVGs
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Calculate new dimensions (preserve aspect ratio)
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_IMAGE_DIMENSION)
          width = MAX_IMAGE_DIMENSION
        } else {
          width = Math.round((width / height) * MAX_IMAGE_DIMENSION)
          height = MAX_IMAGE_DIMENSION
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file) // Fallback to original
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob (JPEG for photos, PNG for transparency)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const quality = outputType === 'image/jpeg' ? JPEG_QUALITY : undefined

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob)
          } else {
            resolve(file) // Use original if compression made it larger
          }
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // Fallback to original on error
    }

    img.src = url
  })
}

export function useUpload() {
  async function uploadFile(file: File, folder: string = 'items'): Promise<string> {
    // Compress image before upload
    const processedFile = await compressImage(file)
    const isCompressed = processedFile !== file
    const contentType = isCompressed && file.type !== 'image/png' ? 'image/jpeg' : file.type
    const extension = contentType === 'image/jpeg' ? '.jpg' : file.name.substring(file.name.lastIndexOf('.'))
    const filename = file.name.replace(/\.[^.]+$/, '') + extension

    // Get presigned URL
    const { uploadUrl, publicUrl } = await $fetch('/api/upload/presigned', {
      method: 'POST',
      credentials: 'include',
      body: {
        filename,
        contentType,
        folder
      }
    }) as { uploadUrl: string; publicUrl: string }

    // Upload to R2
    await fetch(uploadUrl, {
      method: 'PUT',
      body: processedFile,
      headers: {
        'Content-Type': contentType
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
