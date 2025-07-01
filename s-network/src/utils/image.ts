export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return "/default-avatar.svg"; // fallback image

  // Normalize slashes (fix Windows-style backslashes)
  let normalized = path.replace(/\\/g, "/");

  // Remove duplicated "uploads/" at the beginning if it appears more than once
  normalized = normalized.replace(/^\/?uploads\/+/, "uploads/");

  // Ensure the path does not start with a leading slash
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  return `${backendUrl}/${normalized}`;
};

// Enhanced avatar URL handler with better fallback logic
export const getAvatarUrl = (avatar: string | null | undefined): string => {
  if (!avatar) return "/default-avatar.svg";

  // Handle full URLs (already formatted)
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  // Handle default avatar
  if (
    avatar === "/default-avatar.svg" ||
    avatar === "default-avatar.svg" ||
    avatar === "/default-avatar.png" ||
    avatar === "default-avatar.png"
  ) {
    return "/default-avatar.svg";
  }

  // Handle placeholder avatars
  if (avatar === "avatar_placeholder.jpg" || avatar.includes("placeholder")) {
    return "/default-avatar.svg";
  }

  // Use getImageUrl for relative paths
  return getImageUrl(avatar);
};

// Generate initials from name for avatar fallback
export const getInitials = (
  firstName?: string,
  lastName?: string,
  fullName?: string
): string => {
  if (fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return (
        nameParts[0][0] + nameParts[nameParts.length - 1][0]
      ).toUpperCase();
    }
    return fullName.charAt(0).toUpperCase();
  }

  if (firstName && lastName) {
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }

  return "?";
};

// Generate a consistent color for a user based on their name
export const getAvatarColor = (name: string): string => {
  if (!name) return "from-gray-400 to-gray-500";

  const colors = [
    "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600",
    "from-green-400 to-green-600",
    "from-red-400 to-red-600",
    "from-indigo-400 to-indigo-600",
    "from-pink-400 to-pink-600",
    "from-yellow-400 to-yellow-600",
    "from-teal-400 to-teal-600",
    "from-orange-400 to-orange-600",
    "from-cyan-400 to-cyan-600",
  ];

  // Generate consistent color based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

// Updated version that handles both old and new calling styles
export const createAvatarFallback = (
  nameOrElement: string | HTMLImageElement,
  fallbackText?: string,
  textSizeClass?: string
) => {
  // If used in the old DOM manipulation way
  if (
    typeof nameOrElement !== "string" &&
    nameOrElement instanceof HTMLImageElement
  ) {
    if (!fallbackText) return null;

    nameOrElement.onerror = null;
    nameOrElement.style.display = "none";

    const fallbackDiv = document.createElement("div");
    fallbackDiv.className = `flex items-center justify-center bg-gray-300 text-white font-bold ${
      textSizeClass || "text-base"
    }`;
    fallbackDiv.style.width = nameOrElement.width + "px";
    fallbackDiv.style.height = nameOrElement.height + "px";
    fallbackDiv.textContent = fallbackText;

    const parent = nameOrElement.parentElement;
    if (parent) {
      parent.appendChild(fallbackDiv);
    }
    return;
  }

  // New way - just return initials for JSX rendering
  const name =
    typeof nameOrElement === "string" ? nameOrElement : fallbackText || "";
  if (!name) return null;

  // Get initials from name (up to 2 characters)
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials;
};

// Validate if an image URL is accessible/valid
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;

  // Check for common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  if (imageExtensions.test(url)) return true;

  // Check for data URLs
  if (url.startsWith("data:image/")) return true;

  // For other URLs, assume they might be valid (backend will handle validation)
  return true;
};
