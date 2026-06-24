/**
 * Returns the base URL for the API server.
 * In production (Replit), API is at the same origin under /api.
 * In local dev (when running separately), API might be at localhost:8080.
 */
export function getApiUrl(): string {
  // In Replit, the API server is proxied at the same origin
  if (typeof window !== "undefined" && window.location.host.includes("replit")) {
    return `${window.location.origin}/api`;
  }
  // Fallback for dev
  return import.meta.env.VITE_API_URL || "http://localhost:8080/api";
}
