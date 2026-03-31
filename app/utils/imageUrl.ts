/**
 * Get a properly formatted image URL
 * Returns the URL directly - client fetches images without proxy
 */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url
}
