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

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  return `${backendUrl}/${normalized}`;
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
