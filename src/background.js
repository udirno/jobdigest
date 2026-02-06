import { storage, STORAGE_KEYS } from './storage.js';
import { ApiError, getUserMessage, createApiError } from './errors.js';
import { keepAlive } from './keep-alive.js';
import { scheduleDailyFetch, verifyAlarmExists, getNextFetchTime } from './scheduler.js';
import { runJobFetch, resumeJobFetch } from './job-fetcher.js';

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

    // Initialize default settings
    const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await storage.set(STORAGE_KEYS.SETTINGS, {
      fetchHour: 6,
      fetchMinute: 0,
      timezone: defaultTimezone,
      searchKeywords: [],
      location: '',
      salaryMin: null,
      datePosted: 'all',
      employmentType: 'FULLTIME',
      remoteOnly: false
    });

    console.log('Default storage initialized');
  }

  // Schedule daily fetch with user's preferred time (defaults to 6:00 AM local)
  await scheduleDailyFetch();

  console.log('Daily job fetch alarm created');
});

// =============================================================================
// Startup
// =============================================================================

chrome.runtime.onStartup.addListener(async () => {
  console.log('JobDigest service worker started');

  // Verify daily alarm exists (Chrome may clear alarms on restart)
  const alarmStatus = await verifyAlarmExists();
  if (!alarmStatus.exists) {
    console.log('Daily alarm was recreated');
  }

  // Check for in-progress batch recovery
  const batchProgress = await storage.getBatchProgress();
  if (batchProgress.inProgress === true) {
    console.log('Recovering in-progress fetch from stage:', batchProgress.stage || 'unknown');
    try {
      const result = await resumeJobFetch();
      console.log('Fetch recovery complete:', result);
    } catch (error) {
      console.error('Fetch recovery failed:', error);
      // Clear stuck progress to prevent infinite recovery loop
      await storage.clearBatchProgress();
    }
  }
});

// =============================================================================
// Alarms
// =============================================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-job-fetch') {
    console.log('Daily job fetch alarm fired');

    // Smart catch-up: detect missed alarms after device sleep
    const now = Date.now();
    const delayMinutes = (now - alarm.scheduledTime) / 1000 / 60;

    if (delayMinutes > 120) {
      // Missed by more than 2 hours (likely device was asleep)
      console.warn(`Alarm missed by ${delayMinutes.toFixed(0)} minutes`);

      // Skip if already fetched today
      const dailyStats = await storage.getDailyStats();
      if (dailyStats.jobsFetched > 0) {
        console.log('Already fetched jobs today, skipping catch-up fetch');
        return;
      }
      console.log('No jobs fetched today, proceeding with catch-up fetch');
    }

    // Run the fetch pipeline
    try {
      const result = await runJobFetch({ manual: false });
      console.log('Daily fetch complete:', result);
    } catch (error) {
      console.error('Daily fetch failed:', error);
    }
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

    case 'TRIGGER_FETCH': {
      // Manual fetch triggered by user
      console.log('Manual fetch triggered by user');
      const result = await runJobFetch({ manual: true });
      return result;
    }

    case 'GET_FETCH_STATUS': {
      // Return current fetch state for UI
      const batchProgress = await storage.getBatchProgress();
      const dailyStats = await storage.getDailyStats();
      const fetchHistory = await storage.getFetchHistory();
      const nextFetch = await getNextFetchTime();

      return {
        inProgress: batchProgress.inProgress,
        currentStage: batchProgress.stage || null,
        dailyStats: {
          jobsFetched: dailyStats.jobsFetched,
          remaining: Math.max(0, 100 - dailyStats.jobsFetched),
          date: dailyStats.date
        },
        nextFetchTime: nextFetch ? nextFetch.toISOString() : null,
        recentHistory: fetchHistory.slice(-5) // Last 5 fetch entries
      };
    }

    case 'GET_NEXT_FETCH_TIME': {
      const nextTime = await getNextFetchTime();
      return { nextFetchTime: nextTime ? nextTime.toISOString() : null };
    }

    case 'UPDATE_FETCH_SCHEDULE': {
      // User changed fetch time in settings
      const { hour, minute } = message;
      await scheduleDailyFetch(hour, minute);
      const nextTime = await getNextFetchTime();
      return { success: true, nextFetchTime: nextTime ? nextTime.toISOString() : null };
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
