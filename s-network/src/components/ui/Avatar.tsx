"use client";

import React, { useState } from "react";
import { getAvatarUrl, getInitials, getAvatarColor } from "@/utils/image";

interface AvatarProps {
  // User information
  avatar?: string | null;
  firstName?: string;
  lastName?: string;
  fullName?: string;

  // Display options
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;

  // Behavior
  onClick?: () => void;
  showOnlineStatus?: boolean;
  isOnline?: boolean;

  // Advanced options
  alt?: string;
  fallbackIcon?: React.ReactNode;
  priority?: boolean;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
  "2xl": "w-20 h-20 text-xl",
};

const ringClasses = {
  xs: "ring-1",
  sm: "ring-1",
  md: "ring-2",
  lg: "ring-2",
  xl: "ring-3",
  "2xl": "ring-3",
};

const statusClasses = {
  xs: "w-1.5 h-1.5 -bottom-0 -right-0",
  sm: "w-2 h-2 -bottom-0 -right-0",
  md: "w-2.5 h-2.5 -bottom-0.5 -right-0.5",
  lg: "w-3 h-3 -bottom-0.5 -right-0.5",
  xl: "w-4 h-4 -bottom-1 -right-1",
  "2xl": "w-5 h-5 -bottom-1 -right-1",
};

export default function Avatar({
  avatar,
  firstName,
  lastName,
  fullName,
  size = "md",
  className = "",
  onClick,
  showOnlineStatus = false,
  isOnline = false,
  alt,
  fallbackIcon,
  priority = false,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Generate display name for alt text and initials
  const displayName =
    fullName ||
    (firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || "User");
  const initials = getInitials(firstName, lastName, fullName);
  const avatarColor = getAvatarColor(displayName);
  const avatarUrl = getAvatarUrl(avatar);

  // Check if it's an external URL (from backend) or local asset
  const isExternalUrl = avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'));
  const isLocalAsset = avatarUrl && avatarUrl.startsWith('/');

  // Determine if we should show image or fallback
  const shouldShowImage =
    avatarUrl &&
    avatarUrl !== "/default-avatar.svg" &&
    avatarUrl !== "/default-avatar.png" &&
    !imageError;

  const baseClasses = `
    ${sizeClasses[size]} 
    rounded-full 
    overflow-hidden 
    flex-shrink-0
    relative
    ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
    ${ringClasses[size]} ring-white shadow-md
    ${className}
  `;

  const handleImageError = () => {
    console.warn(`Failed to load avatar image: ${avatarUrl}`);
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  return (
    <div className={baseClasses} onClick={onClick}>
      {shouldShowImage ? (
        <>
          {/* Use regular img tag for external URLs to avoid Next.js optimization issues */}
          <img
            src={avatarUrl}
            alt={alt || `${displayName}'s avatar`}
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            style={{
              display: imageError ? 'none' : 'block'
            }}
          />
          {(imageLoading || imageError) && (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-semibold ${imageLoading ? 'animate-pulse' : ''}`}
            >
              {initials}
            </div>
          )}
        </>
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-semibold`}
        >
          {fallbackIcon || initials}
        </div>
      )}

      {/* Online status indicator */}
      {showOnlineStatus && (
        <div
          className={`absolute ${statusClasses[size]} ${
            isOnline ? "bg-green-400" : "bg-gray-400"
          } border-2 border-white rounded-full`}
        />
      )}
    </div>
  );
}

// Specialized avatar components for common use cases
export function ChatAvatar(
  props: Omit<AvatarProps, "size"> & { size?: "sm" | "md" | "lg" }
) {
  return <Avatar {...props} size={props.size || "md"} />;
}

export function NotificationAvatar(props: Omit<AvatarProps, "size">) {
  return <Avatar {...props} size="md" />;
}

export function ProfileAvatar(
  props: Omit<AvatarProps, "size"> & { size?: "lg" | "xl" | "2xl" }
) {
  return <Avatar {...props} size={props.size || "xl"} />;
}

export function SearchAvatar(props: Omit<AvatarProps, "size">) {
  return <Avatar {...props} size="sm" />;
}
