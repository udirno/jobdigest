import { storage, STORAGE_KEYS } from './storage.js';
import { ApiError, getUserMessage, createApiError } from './errors.js';
import { keepAlive } from './keep-alive.js';

/**
 * Service worker lifecycle management
 * Handles: install, startup, alarms, messages, state recovery
 */

// =============================================================================
// Installation
// =============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('JobDigest installed/updated');

  // Initialize storage on first install
  if (details.reason === 'install') {
    const today = new Date().toISOString().split('T')[0];

    // Set defaults
    await storage.setApiKeys({
      claude: '',
      adzuna: { appId: '', appKey: '' },
      jsearch: ''
    });

    await storage.setOnboarding({
      completed: false,
      completedAt: null
    });

    await storage.set(STORAGE_KEYS.DAILY_STATS, {
      date: today,
      jobsFetched: 0
    });

    console.log('Default storage initialized');
  }

  // Create daily alarm (fires every 24 hours)
  chrome.alarms.create('daily-job-fetch', {
    periodInMinutes: 1440 // 24 hours
  });

  console.log('Daily job fetch alarm created');
});

// =============================================================================
// Startup
// =============================================================================

chrome.runtime.onStartup.addListener(async () => {
  console.log('JobDigest service worker started');

  // Check for batch progress recovery
  const batchProgress = await storage.getBatchProgress();
  if (batchProgress.inProgress === true) {
    console.log('Recovering batch progress from previous session', batchProgress);
    // Actual recovery logic will be added in Phase 3 when batch processing is implemented
  }

  // Verify daily alarm exists (Chrome may clear alarms)
  const alarm = await chrome.alarms.get('daily-job-fetch');
  if (!alarm) {
    console.warn('Daily alarm missing, recreating...');
    chrome.alarms.create('daily-job-fetch', {
      periodInMinutes: 1440
    });
  }
});

// =============================================================================
// Alarms
// =============================================================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'daily-job-fetch') {
    console.log('Daily job fetch alarm fired');
    // Actual fetch will be wired in Phase 3
  } else if (alarm.name.startsWith('keepalive-')) {
    // Ignore keep-alive pings (handled by keep-alive.js)
  } else {
    console.warn('Unknown alarm:', alarm.name);
  }
});

// =============================================================================
// Message handling
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages asynchronously
  handleMessage(message, sender).then(sendResponse).catch(error => {
    console.error('Message handler error:', error);
    sendResponse({ error: getUserMessage(error) });
  });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message, sender) {
  const { type } = message;

  switch (type) {
    case 'GET_ONBOARDING_STATUS': {
      const status = await storage.getOnboarding();
      return status;
    }

    case 'CHECK_DAILY_CAP': {
      const cap = await checkDailyCap();
      return { remaining: cap.remaining, limit: 100 };
    }

    case 'TEST_API_CONNECTION': {
      const { service, credentials } = message;
      return await testApiConnection(service, credentials);
    }

    default:
      console.warn('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Check daily cap for job fetching
 * @returns {Promise<Object>} { allowed: boolean, remaining: number }
 */
async function checkDailyCap() {
  const dailyStats = await storage.getDailyStats();
  const jobsFetched = dailyStats.jobsFetched || 0;

  if (jobsFetched >= 100) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: 100 - jobsFetched };
}

/**
 * Test API connection with lightweight call
 * @param {string} service - 'claude' | 'adzuna' | 'jsearch'
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} { success: boolean, message?: string }
 */
async function testApiConnection(service, credentials) {
  try {
    switch (service) {
      case 'claude': {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': credentials.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        });

        if (!response.ok) {
          const error = await createApiError(response, 'claude');
          throw error;
        }

        return { success: true };
      }

      case 'adzuna': {
        const { appId, appKey } = credentials;
        const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=1`;
        const response = await fetch(url);

        if (!response.ok) {
          const error = await createApiError(response, 'adzuna');
          throw error;
        }

        return { success: true };
      }

      case 'jsearch': {
        const response = await fetch('https://jsearch.p.rapidapi.com/search?query=test&num_pages=1', {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': credentials.apiKey,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          const error = await createApiError(response, 'jsearch');
          throw error;
        }

        return { success: true };
      }

      default:
        throw new Error(`Unknown service: ${service}`);
    }
  } catch (error) {
    console.error(`API test failed for ${service}:`, error);
    return {
      success: false,
      message: getUserMessage(error)
    };
  }
}
