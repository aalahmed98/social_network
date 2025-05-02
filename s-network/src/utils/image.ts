/**
 * Utility functions for handling images in the application
 */

/**
 * Converts a relative or absolute image path to a complete URL
 * @param path - The image path from the API
 * @returns The complete URL to the image
 */
export const getImageUrl = (path: string | undefined | null): string => {
  if (!path) return "";

  // If it's already a full URL, return it as is
  if (path.startsWith("http")) return path;

  // Get the backend URL from environment or use default
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  // Make sure we don't double up on slashes
  if (path.startsWith("/")) {
    return `${backendUrl}${path}`;
  }

  return `${backendUrl}/${path}`;
};

/**
 * Creates a fallback for when an avatar image fails to load
 * @param element - The image element that failed to load
 * @param initial - The initial character to display (usually first letter of name)
 * @param size - Optional CSS class for font size (default: 'text-sm')
 */
export const createAvatarFallback = (
  element: HTMLImageElement,
  initial: string = "?",
  size: string = "text-sm"
): void => {
  // Hide the failed image
  element.style.display = "none";

  // Get the parent container
  const parent = element.parentElement;
  if (!parent) return;

  // Create and append the fallback element
  const fallback = document.createElement("div");
  fallback.className = `w-full h-full flex items-center justify-center ${size} font-bold text-white bg-gradient-to-br from-blue-500 to-indigo-600`;
  fallback.innerText = initial || "?";
  parent.appendChild(fallback);
};
