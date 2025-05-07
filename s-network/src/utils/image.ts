export const getImageUrl = (path: string): string => {
  if (!path) return "";

  // Normalize slashes (fix Windows-style backslashes)
  let normalized = path.replace(/\\/g, "/");

  // Remove duplicated "uploads/" at the beginning if it appears more than once
  normalized = normalized.replace(/^\/?uploads\/+/, "uploads/");

  // Ensure the path does not start with a leading slash
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  return `${backendUrl}/${normalized}`;
};

export const createAvatarFallback = (
  imgElement: HTMLImageElement,
  fallbackText: string,
  textSizeClass: string = "text-base"
) => {
  imgElement.onerror = null;
  imgElement.style.display = "none";

  const fallbackDiv = document.createElement("div");
  fallbackDiv.className = `flex items-center justify-center bg-gray-300 text-white font-bold ${textSizeClass}`;
  fallbackDiv.style.width = imgElement.width + "px";
  fallbackDiv.style.height = imgElement.height + "px";
  fallbackDiv.textContent = fallbackText;

  const parent = imgElement.parentElement;
  if (parent) {
    parent.appendChild(fallbackDiv);
  }
};
