import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  APIError, 
  getErrorMessage, 
  shouldRedirectToLogin, 
  logError 
} from '@/utils/errorHandling';

interface UseErrorHandlerOptions {
  redirectOnUnauthorized?: boolean;
  showErrorNotification?: boolean;
  logErrors?: boolean;
}

interface ErrorHandlerResult {
  handleError: (error: Error, context?: Record<string, any>) => void;
  getDisplayMessage: (error: Error) => string;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}): ErrorHandlerResult => {
  const {
    redirectOnUnauthorized = true,
    showErrorNotification = true,
    logErrors = true,
  } = options;

  const router = useRouter();

  const handleError = useCallback((error: Error, context?: Record<string, any>) => {
    // Log the error if enabled
    if (logErrors) {
      logError(error, context);
    }

    // Handle specific error types
    const apiError = error as APIError;

    // Redirect to login for unauthorized access
    if (redirectOnUnauthorized && shouldRedirectToLogin(apiError)) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    // Show error notification (you can integrate with your notification system)
    if (showErrorNotification) {
      // This would integrate with your notification context/system
      console.warn('Error notification:', getErrorMessage(apiError));
    }
  }, [router, redirectOnUnauthorized, showErrorNotification, logErrors]);

  const getDisplayMessage = useCallback((error: Error): string => {
    return getErrorMessage(error as APIError);
  }, []);

  return {
    handleError,
    getDisplayMessage,
  };
};

// Hook specifically for API calls
export const useApiErrorHandler = () => {
  return useErrorHandler({
    redirectOnUnauthorized: true,
    showErrorNotification: true,
    logErrors: true,
  });
}; 