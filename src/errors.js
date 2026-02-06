/**
 * Custom error class for API-related errors
 */
export class ApiError extends Error {
  constructor(message, { status, service, retryable, originalError } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;         // HTTP status code
    this.service = service;       // 'claude' | 'adzuna' | 'jsearch'
    this.retryable = retryable;   // boolean - should we retry?
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of successful function call
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Determine if error is retryable
      const shouldRetry = isRetryable(error);

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay
      let delay;

      // Check for Retry-After header (for 429 responses)
      if (error.status === 429 && error.retryAfter) {
        delay = error.retryAfter * 1000; // Convert to milliseconds
      } else {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 500; // 0-500ms random jitter
        delay = Math.min(exponentialDelay + jitter, maxDelay);
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} True if should retry
 */
function isRetryable(error) {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // ApiError with explicit retryable flag
  if (error instanceof ApiError) {
    return error.retryable === true;
  }

  // HTTP status-based logic
  if (error.status) {
    // Rate limiting - retryable
    if (error.status === 429) {
      return true;
    }

    // Server errors - retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Client errors (except 429) - not retryable
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  // Default: not retryable
  return false;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get user-friendly error message
 * @param {Error} error - Error to translate
 * @returns {string} User-friendly message
 */
export function getUserMessage(error) {
  // ApiError with service context
  if (error instanceof ApiError) {
    const service = error.service || 'the service';

    // Authentication/authorization errors
    if (error.status === 401 || error.status === 403) {
      return `Invalid API key. Please check your ${service} API key in Settings.`;
    }

    // Rate limiting
    if (error.status === 429) {
      return `Rate limit reached for ${service}. Will retry automatically.`;
    }

    // Server errors
    if (error.status >= 500 && error.status < 600) {
      return `${service} is temporarily unavailable. Please try again later.`;
    }
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection.';
  }

  // Generic fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Create ApiError from fetch Response
 * @param {Response} response - Fetch response object
 * @param {string} service - Service name ('claude' | 'adzuna' | 'jsearch')
 * @returns {Promise<ApiError>} ApiError instance
 */
export async function createApiError(response, service) {
  const status = response.status;
  let message = `${service} API error: ${status}`;

  // Try to parse error message from response body
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      message = data.error?.message || data.message || message;
    } else {
      const text = await response.text();
      if (text) {
        message = text.substring(0, 200); // Limit error message length
      }
    }
  } catch (parseError) {
    // Ignore parse errors, use default message
  }

  // Determine retryability
  let retryable = false;
  if (status === 429 || (status >= 500 && status < 600)) {
    retryable = true;
  }

  // Check for Retry-After header
  const retryAfter = response.headers.get('Retry-After');
  const error = new ApiError(message, {
    status,
    service,
    retryable,
    originalError: null
  });

  // Add Retry-After to error if present
  if (retryAfter) {
    error.retryAfter = parseInt(retryAfter, 10);
  }

  return error;
}
