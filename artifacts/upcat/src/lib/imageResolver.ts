/**
 * Resolves image URLs to correct paths based on the app's base path.
 * Works for both development (base "/") and production (base "/JUPCAT/").
 */
export function resolveImageUrl(url: string | undefined): string {
  if (!url) return "";

  const trimmed = url.trim();
  if (trimmed === "" || trimmed === "diagram") return "";

  // Absolute URL → keep as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Base URL from Vite (includes trailing slash)
  const basePath = import.meta.env.BASE_URL || "/";

  // Remove leading slash to avoid double slashes
  const cleanUrl = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;

  return `${basePath}${cleanUrl}`;
}

/**
 * Returns a relative image path for storing in quiz data.
 * Given a public folder image path, returns the relative URL.
 */
export function getImageRelativePath(filename: string): string {
  // Images stored in public/images/ → referenced as "images/filename"
  return `images/${filename}`;
}

/**
 * Checks whether a question actually has a valid displayable image.
 * Filters out placeholder strings like "diagram" or empty values.
 */
export function hasImage(imageUrl: string | undefined): boolean {
  if (!imageUrl) return false;
  const trimmed = imageUrl.trim();
  if (trimmed === "" || trimmed === "diagram" || trimmed === "(optional)" || trimmed.startsWith("// optional")) return false;
  return true;
}
