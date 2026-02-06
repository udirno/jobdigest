# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** Chrome Extension Manifest V3 Development
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API Key Validation**
- Validate API keys when user clicks Save/Continue button (not immediately on paste)
- If validation fails: save the invalid key anyway, show error on first actual API call (don't block onboarding)
- Provide individual "Test Connection" button for each API (Claude, Adzuna, JSearch)
- Validation response shows simple success/failure only (green check or red X, no quota/account details)

**Storage Schema Design**
- Job data structured as object map indexed by job ID: `{jobId1: {job}, jobId2: {job}}` for fast lookup
- No schema version field initially — add versioning only when migration becomes necessary
- Metadata storage strategy (resume, settings, API keys): Claude's discretion
- Generated content storage with jobs (cover letters, messages): Claude's discretion

### Claude's Discretion

- Onboarding flow UI/UX (multi-step wizard vs single form)
- Error messaging detail level and retry suggestions
- How to structure metadata (resume, settings, API keys) in chrome.storage
- How to store generated content (embedded in job object vs separate storage)
- Service worker keep-alive implementation patterns
- Storage abstraction layer design
- CORS permission manifest configuration

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Summary

Chrome extension Manifest V3 development uses service workers instead of background pages, requiring careful lifecycle management and storage-first architecture patterns. Extensions must use `chrome.storage.local` for persistence (as localStorage is inaccessible to service workers), declare permissions explicitly in manifest.json, and handle service worker termination gracefully (30-second idle timeout).

For vanilla JavaScript extensions without bundlers, the architecture is straightforward: manifest.json declares capabilities, background.js (service worker) handles extension logic and events, popup.html/popup.js provides user interface, and chrome.storage APIs persist state. All JavaScript must be in separate files (no inline scripts) due to Content Security Policy restrictions.

The three API integrations (Claude, Adzuna, JSearch) each require different authentication patterns: Claude uses API key in Authorization header, Adzuna uses app_id/app_key as query parameters, and JSearch uses RapidAPI bearer token. Extensions must request appropriate host_permissions for API domains to avoid CORS errors.

**Primary recommendation:** Build storage-first architecture with chrome.storage.local as source of truth, design for service worker termination (no global state), and save progress after each batch operation to survive unexpected shutdowns.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Manifest V3 | v3 (mandatory) | Extension configuration and capabilities declaration | Required for all new Chrome extensions as of 2022, V2 deprecated |
| chrome.storage API | Native | Extension data persistence | Only storage API accessible to service workers, survives cache clearing |
| chrome.runtime API | Native | Lifecycle events, message passing | Core extension communication and event handling |
| Service Workers | Native | Background script execution | Replaces persistent background pages in MV3, event-driven model |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrome.alarms API | Native | Scheduled tasks | Periodic operations (must use 30+ second intervals in Chrome 120+) |
| chrome.action API | Native | Extension icon, popup, badge | User interface controls and visual indicators |
| IndexedDB | Native | Structured data storage | Large datasets, complex queries (alternative to chrome.storage) |
| fetch API | Native | HTTP requests to external APIs | API calls (requires host_permissions in manifest) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS | React/Vue framework | Frameworks add bundle size and build complexity; vanilla JS sufficient for simple extensions |
| chrome.storage.local | IndexedDB | IndexedDB for complex queries/large data; chrome.storage simpler API for key-value storage |
| unlimitedStorage | Default 10MB quota | Request unlimitedStorage only if needed; triggers permission warning during install |

**Installation:**
```bash
# No npm packages required for vanilla JS Chrome extension
# All APIs are native browser APIs
```

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── manifest.json           # Extension configuration and permissions
├── background.js           # Service worker (event handlers, business logic)
├── popup.html              # Extension popup UI structure
├── popup.js                # Popup UI logic (separate file required by CSP)
├── popup.css               # Popup styling
├── storage.js              # Storage abstraction layer (optional)
└── icons/                  # Extension icons (16x16, 48x48, 128x128)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Pattern 1: Manifest V3 Configuration

**What:** Core manifest.json structure declaring extension capabilities and permissions

**When to use:** Every Chrome extension requires manifest.json at root

**Example:**
```json
// Source: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
{
  "manifest_version": 3,
  "name": "Job Digest Extension",
  "version": "1.0.0",
  "description": "AI-powered job application tracker",

  "permissions": [
    "storage",
    "unlimitedStorage"
  ],

  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.adzuna.com/*",
    "https://jsearch.p.rapidapi.com/*"
  ],

  "background": {
    "service_worker": "background.js"
  },

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Pattern 2: Service Worker Event Handling

**What:** Event-driven service worker responding to extension lifecycle and user actions

**When to use:** All background logic in Manifest V3 extensions

**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
// background.js

// Installation event - one-time initialization
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install - set up initial state
    await chrome.storage.local.set({
      apiKeys: {
        claude: '',
        adzuna: { appId: '', appKey: '' },
        jsearch: ''
      },
      jobs: {},
      settings: {
        dailyJobCap: 100
      }
    });

    // Open onboarding flow
    chrome.action.openPopup();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'validateApiKey') {
    validateApiKey(message.provider, message.key)
      .then(result => sendResponse({ success: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function validateApiKey(provider, key) {
  // Validation logic
  // Note: Service worker may terminate during long operations
  // Use chrome.storage to persist state before async calls
}
```

### Pattern 3: Storage-First Architecture

**What:** Treat chrome.storage.local as source of truth, never rely on global variables

**When to use:** All state management in Manifest V3 (service workers terminate after 30s idle)

**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

// BAD - Global variables lost on service worker termination
let jobs = {};

async function addJob(jobData) {
  jobs[jobData.id] = jobData; // LOST when worker terminates!
}

// GOOD - Storage-first approach
async function addJob(jobData) {
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  jobs[jobData.id] = jobData;
  await chrome.storage.local.set({ jobs });
}

async function getJob(jobId) {
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  return jobs[jobId];
}

// Listen to storage changes across contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.apiKeys) {
    console.log('API keys updated:', changes.apiKeys.newValue);
  }
});
```

### Pattern 4: API Request Error Handling with Exponential Backoff

**What:** Retry failed API requests with exponentially increasing delays

**When to use:** All external API calls, especially for rate limit (429) responses

**Example:**
```javascript
// Source: https://betterstack.com/community/guides/monitoring/exponential-backoff/

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return await response.json();
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

        await sleep(delay);
        continue;
      }

      // Other errors - don't retry
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      lastError = error;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Pattern 5: Onboarding Flow on First Install

**What:** Guide users through API key configuration when extension first installs

**When to use:** chrome.runtime.onInstalled with reason === 'install'

**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/runtime

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initialize storage
    await chrome.storage.local.set({
      onboardingComplete: false,
      apiKeys: {
        claude: '',
        adzuna: { appId: '', appKey: '' },
        jsearch: ''
      }
    });

    // Open popup for onboarding
    chrome.action.openPopup();
  }
});

// In popup.js, check onboarding status
chrome.storage.local.get('onboardingComplete').then(({ onboardingComplete }) => {
  if (!onboardingComplete) {
    showOnboardingWizard();
  } else {
    showMainInterface();
  }
});
```

### Pattern 6: Keep-Alive for Long Operations

**What:** Prevent service worker termination during long API operations

**When to use:** Operations exceeding 30 seconds (AI requests, batch processing)

**Example:**
```javascript
// Source: https://developer.chrome.com/blog/longer-esw-lifetimes

// Strategy 1: Use chrome.alarms for periodic tasks
chrome.alarms.create('processJobs', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'processJobs') {
    processJobBatch();
  }
});

// Strategy 2: Reset idle timer with extension API calls
async function longRunningOperation() {
  // Break into chunks, save progress between each
  for (let i = 0; i < totalJobs; i += batchSize) {
    await processBatch(i, i + batchSize);

    // Save progress to storage - this resets the 30s idle timer
    await chrome.storage.local.set({ processedCount: i + batchSize });
  }
}

// Strategy 3: Use chrome.runtime messaging to keep alive
// (Only for enterprise/education managed devices - avoid in consumer extensions)
```

### Anti-Patterns to Avoid

- **Using localStorage instead of chrome.storage**: localStorage not accessible to service workers, data lost on browser history clear
- **Storing state in global variables**: Service workers terminate after 30s idle, losing all global state
- **Inline JavaScript in HTML**: Content Security Policy blocks inline scripts; all JS must be in separate files
- **Hardcoding API keys in source code**: Major security vulnerability - recent breaches exposed millions of users
- **Adding 'unsafe-eval' to CSP**: Chrome extensions cannot use eval() or new Function() for security reasons
- **Requesting broad permissions unnecessarily**: Triggers scary install warnings; use minimal permissions needed
- **Ignoring service worker termination**: Design for resilience - assume worker can shut down at any time

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API retry logic | Custom setTimeout loops | Exponential backoff pattern with jitter | Handles rate limits, thundering herd, backpressure correctly |
| Permission requests | Manual manifest editing | Chrome's permission APIs + proper manifest declarations | Type-safe, runtime validation, install-time warnings |
| Message passing | Custom event system | chrome.runtime.sendMessage/onMessage | Built-in, works across contexts (service worker, popup, content scripts) |
| Storage abstraction | Custom wrapper | chrome.storage API directly with async/await | Native, battle-tested, handles quota limits correctly |
| CSP configuration | Custom security headers | Default MV3 CSP (script-src 'self') | Chrome enforces minimum CSP; custom configs often weaker |

**Key insight:** Chrome's extension APIs are designed for the service worker lifecycle model. Custom solutions that work in traditional web apps fail in extensions (e.g., localStorage not accessible to service workers, global state lost on termination).

## Common Pitfalls

### Pitfall 1: Service Worker Termination Losing State

**What goes wrong:** Extension loses critical state (jobs being processed, API call progress) when service worker terminates after 30 seconds of inactivity.

**Why it happens:** Developers assume service workers behave like persistent background pages from Manifest V2, storing state in global variables.

**How to avoid:**
- Use chrome.storage.local as single source of truth
- Save progress after each batch operation
- Never rely on global variables surviving between events
- Break long operations into chunks with storage saves between

**Warning signs:**
- "Jobs disappear after a few minutes"
- "API calls fail to complete"
- "Extension state resets randomly"

### Pitfall 2: CORS Errors from Missing host_permissions

**What goes wrong:** API calls fail with CORS errors despite fetch() working in regular web pages.

**Why it happens:** Extensions must explicitly request host_permissions in manifest.json for each external API domain.

**How to avoid:**
- Add all API domains to "host_permissions" array in manifest.json
- Use exact domain patterns: `"https://api.example.com/*"`
- Test API calls immediately after manifest changes

**Warning signs:**
- Console errors: "Access to fetch blocked by CORS policy"
- fetch() returns network errors despite API being available
- Works in browser console but fails in extension

### Pitfall 3: Inline JavaScript Blocked by CSP

**What goes wrong:** Extension refuses to load with "Refused to execute inline script" error.

**Why it happens:** Manifest V3 enforces strict Content Security Policy that blocks all inline JavaScript.

**How to avoid:**
- Move all JavaScript to separate .js files
- Link JS files with `<script src="popup.js"></script>`
- Never use onclick="..." inline event handlers
- Use addEventListener() in external JS file instead

**Warning signs:**
- Extension loads but UI doesn't respond to clicks
- Console error: "Refused to execute inline script"
- onclick/onsubmit handlers not working

### Pitfall 4: API Keys Exposed in Client-Side Code

**What goes wrong:** API keys hardcoded in extension source code are easily extracted by users, leading to unauthorized usage and quota theft.

**Why it happens:** Extensions are distributed as .crx files that users can unpack and inspect. Recent breaches (Trust Wallet, Dec 2024) stole $7-8.5M due to exposed keys.

**How to avoid:**
- Never hardcode API keys in source code
- Require users to provide their own API keys
- Store keys in chrome.storage.local (encrypted if possible)
- For sensitive operations, use server-side proxy with backend API key storage

**Warning signs:**
- API keys visible in extension source files
- Keys committed to version control
- Chrome Web Store rejection for security violations

### Pitfall 5: Exceeding Storage Quotas

**What goes wrong:** chrome.storage.local hits 10MB limit, causing set() operations to silently fail or throw quota errors.

**Why it happens:** Default storage quota is 10MB; extensions storing many jobs or large data structures exceed this.

**How to avoid:**
- Request "unlimitedStorage" permission in manifest.json
- Monitor storage usage with chrome.storage.local.getBytesInUse()
- Implement data cleanup/archival for old jobs
- Store only essential data; avoid redundant copies

**Warning signs:**
- Jobs mysteriously not saving
- Console errors: "QUOTA_BYTES quota exceeded"
- Storage operations fail after extension used for a while

### Pitfall 6: Missing Error Handling for API Validation

**What goes wrong:** Extension crashes or hangs when API validation requests fail (network timeout, invalid key, API down).

**Why it happens:** Developers test with valid keys and working network, don't handle edge cases.

**How to avoid:**
- Wrap all API calls in try/catch blocks
- Set request timeouts (30s max to avoid service worker termination)
- Show user-friendly error messages, not raw exceptions
- Save invalid keys anyway (per user requirement), show error on first real use

**Warning signs:**
- Extension stops responding during API key validation
- No error message when API is unreachable
- Validation never completes if network is slow

### Pitfall 7: Not Testing Service Worker Lifecycle

**What goes wrong:** Extension works perfectly during development but fails in production because service worker termination isn't tested.

**Why it happens:** During active development, service worker stays alive with debugger attached (Chrome 118+ feature).

**How to avoid:**
- Test with closed DevTools to simulate real termination behavior
- Use chrome://extensions/ → "Inspect views: service worker" → close after 30s
- Verify state persistence by manually terminating worker
- Test "resume from middle" scenarios (e.g., processing batch 3 of 10 jobs)

**Warning signs:**
- Works fine in development, breaks for users
- State resets only for users, not during debugging
- Long operations never complete in production

## Code Examples

Verified patterns from official sources:

### API Key Validation (Claude Anthropic)

```javascript
// Source: https://docs.anthropic.com/ + https://developer.chrome.com/docs/extensions/

async function validateClaudeApiKey(apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
    });

    // Valid key returns 200
    // Invalid key returns 401
    return response.ok;

  } catch (error) {
    console.error('Claude API validation failed:', error);
    return false;
  }
}
```

### API Key Validation (Adzuna)

```javascript
// Source: https://developer.adzuna.com/overview

async function validateAdzunaApiKey(appId, appKey) {
  try {
    // Minimal API call to verify credentials
    const response = await fetch(
      `https://api.adzuna.com/v1/api/jobs/us/search/1?` +
      `app_id=${encodeURIComponent(appId)}&` +
      `app_key=${encodeURIComponent(appKey)}&` +
      `results_per_page=1`
    );

    return response.ok;

  } catch (error) {
    console.error('Adzuna API validation failed:', error);
    return false;
  }
}
```

### API Key Validation (JSearch via RapidAPI)

```javascript
// Source: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

async function validateJSearchApiKey(apiKey) {
  try {
    const response = await fetch(
      'https://jsearch.p.rapidapi.com/search?' +
      'query=test&page=1&num_pages=1',
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
      }
    );

    return response.ok;

  } catch (error) {
    console.error('JSearch API validation failed:', error);
    return false;
  }
}
```

### Storage Abstraction Layer

```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/storage

class StorageManager {
  async getApiKeys() {
    const { apiKeys } = await chrome.storage.local.get('apiKeys');
    return apiKeys || {
      claude: '',
      adzuna: { appId: '', appKey: '' },
      jsearch: ''
    };
  }

  async setApiKeys(apiKeys) {
    await chrome.storage.local.set({ apiKeys });
  }

  async getJobs() {
    const { jobs } = await chrome.storage.local.get('jobs');
    return jobs || {};
  }

  async setJob(jobId, jobData) {
    const jobs = await this.getJobs();
    jobs[jobId] = jobData;
    await chrome.storage.local.set({ jobs });
  }

  async getJob(jobId) {
    const jobs = await this.getJobs();
    return jobs[jobId];
  }

  async getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    return settings || {
      dailyJobCap: 100,
      processedToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0]
    };
  }

  async updateSettings(updates) {
    const settings = await this.getSettings();
    await chrome.storage.local.set({
      settings: { ...settings, ...updates }
    });
  }

  // Monitor storage usage
  async getStorageUsage() {
    const bytes = await chrome.storage.local.getBytesInUse(null);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return { bytes, mb };
  }
}

// Usage
const storage = new StorageManager();
await storage.setJob('job-123', { title: 'Software Engineer', ... });
const job = await storage.getJob('job-123');
```

### Popup UI with External JavaScript

```html
<!-- popup.html -->
<!-- Source: https://developer.chrome.com/docs/extensions/develop/ui/add-popup -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Job Digest Extension</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="onboarding" style="display: none;">
    <h2>Welcome to Job Digest</h2>
    <p>Configure your API keys to get started:</p>

    <div class="api-config">
      <label>Claude API Key:</label>
      <input type="password" id="claude-key" placeholder="sk-ant-...">
      <button id="test-claude">Test Connection</button>
      <span id="claude-status"></span>
    </div>

    <div class="api-config">
      <label>Adzuna App ID:</label>
      <input type="text" id="adzuna-id" placeholder="Your App ID">
      <label>Adzuna App Key:</label>
      <input type="password" id="adzuna-key" placeholder="Your App Key">
      <button id="test-adzuna">Test Connection</button>
      <span id="adzuna-status"></span>
    </div>

    <div class="api-config">
      <label>JSearch API Key:</label>
      <input type="password" id="jsearch-key" placeholder="RapidAPI Key">
      <button id="test-jsearch">Test Connection</button>
      <span id="jsearch-status"></span>
    </div>

    <button id="save-keys">Save & Continue</button>
  </div>

  <div id="main-interface" style="display: none;">
    <h2>Job Digest</h2>
    <div id="job-list"></div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

```javascript
// popup.js
// Source: https://developer.chrome.com/docs/extensions/develop/ui/add-popup

// Check onboarding status
chrome.storage.local.get('onboardingComplete').then(({ onboardingComplete }) => {
  if (!onboardingComplete) {
    document.getElementById('onboarding').style.display = 'block';
  } else {
    document.getElementById('main-interface').style.display = 'block';
    loadJobs();
  }
});

// Test Claude connection
document.getElementById('test-claude').addEventListener('click', async () => {
  const apiKey = document.getElementById('claude-key').value;
  const status = document.getElementById('claude-status');

  status.textContent = 'Testing...';

  const result = await chrome.runtime.sendMessage({
    action: 'validateApiKey',
    provider: 'claude',
    key: apiKey
  });

  status.textContent = result.success ? '✓ Valid' : '✗ Invalid';
  status.className = result.success ? 'success' : 'error';
});

// Save API keys
document.getElementById('save-keys').addEventListener('click', async () => {
  const apiKeys = {
    claude: document.getElementById('claude-key').value,
    adzuna: {
      appId: document.getElementById('adzuna-id').value,
      appKey: document.getElementById('adzuna-key').value
    },
    jsearch: document.getElementById('jsearch-key').value
  };

  await chrome.storage.local.set({
    apiKeys,
    onboardingComplete: true
  });

  // Switch to main interface
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('main-interface').style.display = 'block';
  loadJobs();
});

async function loadJobs() {
  const { jobs } = await chrome.storage.local.get('jobs');
  // Render jobs...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 | Manifest V3 | 2022 (mandatory 2024) | Background pages → service workers; requires storage-first architecture |
| Persistent background pages | Event-driven service workers | MV3 release | Must design for 30s termination; no global state |
| webRequest blocking | declarativeNetRequest | MV3 release | Network filtering moved to declarative rules |
| Remote code execution | Bundled code only | MV3 release | All code must be in extension package |
| localStorage | chrome.storage.local | MV3 (service workers) | localStorage unavailable to service workers |
| chrome.storage 5MB quota | 10MB quota (unlimited with permission) | Chrome 113 | More storage available, but still need unlimitedStorage for large datasets |
| Minimum alarm interval: any | Minimum 30 seconds | Chrome 120 | Cannot use alarms for sub-second polling |

**Deprecated/outdated:**
- **Manifest V2**: Deprecated 2022, extensions removed from store 2024
- **chrome.extension API**: Replaced by chrome.runtime
- **Background pages**: Use service workers instead
- **webRequestBlocking permission**: Use declarativeNetRequest instead
- **window and DOM globals in service workers**: Not available; use offscreen documents if needed

## Open Questions

Things that couldn't be fully resolved:

1. **User-provided API key security**
   - What we know: Storing API keys in chrome.storage.local is standard practice for extensions requiring user keys
   - What's unclear: Best practice for encryption at rest (chrome.storage is not encrypted by default)
   - Recommendation: Store keys as-is in chrome.storage.local (standard practice), document that users should use keys with minimal permissions/quota limits

2. **Optimal storage structure for generated content**
   - What we know: Job data uses object map `{jobId: {job}}` for fast lookup
   - What's unclear: Whether to embed generated content (cover letters, messages) in job object or separate storage key
   - Recommendation: Embed in job object initially for simplicity; refactor to separate storage only if job objects become too large (>100KB each)

3. **Service worker keep-alive for long AI operations**
   - What we know: Service workers terminate after 30s idle; chrome.storage calls reset timer
   - What's unclear: Whether Claude API calls taking 10-20 seconds need explicit keep-alive pattern
   - Recommendation: Save progress after each Claude API call to reset timer; if single calls exceed 20s, break into chunks with intermediate storage saves

4. **Error message detail level**
   - What we know: User wants "user-friendly error messages" with retry suggestions
   - What's unclear: Exact level of technical detail desired (show HTTP status codes? API error messages verbatim?)
   - Recommendation: Show simplified messages ("Unable to connect to Claude API. Check your API key and internet connection.") with technical details in console for debugging

## Sources

### Primary (HIGH confidence)

- [Chrome Extensions Manifest V3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) - Core MV3 concepts and migration guide
- [Extension Service Workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers) - Service worker architecture and patterns
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Termination, keep-alive, persistence
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage quotas, APIs, best practices
- [chrome.runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime) - Lifecycle events and message passing
- [Declare Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) - Permission types and declaration
- [Match Patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns) - Host permissions for API calls
- [Add Popup](https://developer.chrome.com/docs/extensions/develop/ui/add-popup) - Popup UI patterns
- [Known Issues MV3](https://developer.chrome.com/docs/extensions/develop/migrate/known-issues) - Migration pitfalls
- [activeTab Permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) - Temporary tab access patterns
- [Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) - CSP restrictions and configuration

### Secondary (MEDIUM confidence)

- [Longer Extension Service Worker Lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) - Chrome 114-120 improvements
- [How to Handle API Rate Limits](https://apistatuscheck.com/blog/how-to-handle-api-rate-limits) - Exponential backoff patterns
- [Mastering Exponential Backoff](https://betterstack.com/community/guides/monitoring/exponential-backoff/) - Retry strategies
- [Adzuna API Overview](https://developer.adzuna.com/overview) - Authentication patterns
- [JSearch API on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) - RapidAPI authentication
- [How to Get Your Claude API Key](https://gloobia.com/claude-api-key-guide-2026/) - Claude API setup
- [Chrome Extension Best Practices (GitHub)](https://github.com/dipankar/chrome-extension-best-practices) - Community patterns
- [User Onboarding UX Patterns](https://www.appcues.com/blog/user-onboarding-ui-ux-patterns) - Onboarding flow design

### Tertiary (LOW confidence)

- [Chrome Extensions Vulnerability Exposes API Keys](https://cyberpress.org/chrome-extensions-vulnerability/) - Security concerns (WebSearch only)
- [How to Secure API Keys in Chrome Extension](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19) - Community recommendations (not official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Chrome documentation, native APIs, mandatory MV3
- Architecture: HIGH - Verified patterns from official docs, widely adopted service worker model
- Pitfalls: HIGH - Based on official "Known Issues" docs and recent Chrome updates
- API validation: MEDIUM - Verified authentication methods from API docs, but testing patterns are standard practices
- Onboarding UX: LOW - General UX patterns, not extension-specific official guidance

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - Chrome extension platform is stable)

**Notes:**
- Chrome 120 (Nov 2023) introduced significant service worker lifetime improvements - research reflects current state
- Manifest V3 is mandatory for all new extensions; V2 fully deprecated
- User constraints from CONTEXT.md strongly influence storage schema and validation flow - planner must honor these decisions
