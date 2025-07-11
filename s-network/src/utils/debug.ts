// Debug utilities for troubleshooting backend connectivity and image serving

export const checkBackendConnection = async (): Promise<{
  isConnected: boolean;
  status: number | null;
  error?: string;
}> => {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    if (process.env.NODE_ENV === 'development') {
    console.log(`Checking backend connection to: ${backendUrl}`);
  }
    
    const response = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      credentials: 'include',
    });
    
    return {
      isConnected: response.ok,
      status: response.status,
    };
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return {
      isConnected: false,
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const checkImageEndpoint = async (): Promise<{
  isAvailable: boolean;
  status: number | null;
  error?: string;
}> => {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const testUrl = `${backendUrl}/uploads/`;
    if (process.env.NODE_ENV === 'development') {
    console.log(`Checking image endpoint: ${testUrl}`);
  }
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
    });
    
    return {
      isAvailable: response.status !== 404,
      status: response.status,
    };
  } catch (error) {
    console.error('Image endpoint check failed:', error);
    return {
      isAvailable: false,
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const debugImageUrl = (imagePath: string | null | undefined) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  
  console.group(`🖼️ Image Debug for: ${imagePath}`);
  if (process.env.NODE_ENV === 'development') {
    console.log('Backend URL:', backendUrl);
    console.log('Raw image path:', imagePath);
  }
  
  if (!imagePath) {
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ No image path provided - will use default avatar');
    }
    console.groupEnd();
    return;
  }
  
  // Normalize the path
  let normalized = imagePath.replace(/\\/g, "/");
  normalized = normalized.replace(/^\/?uploads\/+/, "uploads/");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  
  const finalUrl = `${backendUrl}/${normalized}`;
  if (process.env.NODE_ENV === 'development') {
    console.log('Normalized path:', normalized);
    console.log('Final URL:', finalUrl);
  }
  
  // Test the URL
  fetch(finalUrl, { method: 'HEAD' })
    .then(response => {
      if (response.ok) {
        if (process.env.NODE_ENV === 'development') {
        console.log('✅ Image URL is accessible');
      }
      } else {
        if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Image URL returned ${response.status} - ${response.statusText}`);
      }
      }
    })
    .catch(error => {
      if (process.env.NODE_ENV === 'development') {
      console.log('❌ Image URL failed to load:', error.message);
    }
    })
    .finally(() => {
      console.groupEnd();
    });
};

// Run basic diagnostics
export const runImageDiagnostics = async () => {
  console.group('🔍 Image System Diagnostics');
  
  const backendCheck = await checkBackendConnection();
    if (process.env.NODE_ENV === 'development') {
    console.log('Backend connection:', backendCheck);
  }

  const imageCheck = await checkImageEndpoint();
  if (process.env.NODE_ENV === 'development') {
    console.log('Image endpoint:', imageCheck);
  }
  
  if (!backendCheck.isConnected) {
    console.warn('⚠️ Backend is not responding. Make sure your backend server is running on port 8080.');
  }
  
  if (!imageCheck.isAvailable) {
    console.warn('⚠️ Image uploads directory is not accessible. Check if your backend serves static files from /uploads/');
  }
  
  console.groupEnd();
};

// Auto-run diagnostics in development
if (process.env.NODE_ENV === 'development') {
  // Run diagnostics after a short delay to avoid initial load issues
  setTimeout(runImageDiagnostics, 2000);
} 