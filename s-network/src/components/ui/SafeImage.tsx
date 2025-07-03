"use client";

import React, { useState } from "react";
import { getImageUrl } from "@/utils/image";

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  onError?: () => void;
  onLoad?: () => void;
  style?: React.CSSProperties;
  fallbackComponent?: React.ReactNode;
}

export default function SafeImage({
  src,
  alt,
  className = "",
  fallbackSrc = "/default-avatar.svg",
  onError,
  onLoad,
  style,
  fallbackComponent,
}: SafeImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate the image URL
  const imageUrl = src ? getImageUrl(src) : null;

  const handleError = () => {
    console.warn(`Failed to load image: ${imageUrl}`);
    setImageError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  // If no src provided or error occurred, show fallback
  if (!imageUrl || imageError) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }
    
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        className={className}
        style={style}
      />
    );
  }

  return (
    <div className="relative">
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        style={style}
        onError={handleError}
        onLoad={handleLoad}
      />
      {isLoading && (
        <div className={`absolute inset-0 bg-gray-200 animate-pulse ${className}`} />
      )}
    </div>
  );
} 