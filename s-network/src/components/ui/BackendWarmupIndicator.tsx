"use client";

import React from 'react';
import { useLoading } from '@/context/LoadingContext';

export function BackendWarmupIndicator() {
  const { isBackendWarming, isBackendReady } = useLoading();

  if (!isBackendWarming && isBackendReady) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 text-center shadow-lg">
      <div className="flex items-center justify-center space-x-3">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        <span className="text-sm font-medium">
          {isBackendWarming ? 'Connecting to server...' : 'Starting up...'}
        </span>
      </div>
      <div className="text-xs mt-1 opacity-90">
        This may take a moment on the first visit
      </div>
    </div>
  );
}

export default BackendWarmupIndicator;