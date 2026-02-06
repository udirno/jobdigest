# Pitfalls Research

**Domain:** Chrome Extension Manifest V3 (Job Automation with External APIs)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Service Worker Termination Mid-API-Call

**What goes wrong:**
Service workers terminate after 30 seconds of inactivity or if a single request takes longer than 5 minutes. For JobDigest, this is catastrophic: the extension fetches from multiple APIs (Adzuna, JSearch, Claude), processes job data, and calculates scores. If the service worker dies mid-operation, all in-progress work is lost, jobs are partially scored, or worse, the alarm fires but doesn't complete the daily job fetch.

**Why it happens:**
Developers assume background scripts run continuously (like Manifest V2 background pages). In MV3, service workers are event-driven and short-lived. A single `fetch()` to Claude API for scoring 50 jobs could easily exceed 5 minutes. The service worker won't wait.

**How to avoid:**
- **Chunk work into sub-5-minute batches**: Process jobs in batches of 10-15, saving progress to `chrome.storage.local` after each batch
- **Use extension APIs to reset timers**: Periodically call trivial extension APIs (like `chrome.storage.local.get()`) during long operations to reset the 30-second inactivity timer
- **Implement graceful recovery**: On service worker restart, check storage for incomplete batches and resume processing
- **Never rely on global variables**: All state must persist in `chrome.storage` because globals are lost on termination

**Warning signs:**
- Jobs appearing in dashboard with score=0 (scoring incomplete)
- Alarm fires but no new jobs appear (fetch didn't complete)
- Inconsistent job counts across days (some batches lost)
- `chrome.runtime.lastError` showing "Service worker terminated"

**Phase to address:**
**Phase 1 (Core Infrastructure)**: Implement batch processing architecture from day one. Build service worker lifecycle management as a core module, not an afterthought.

---

### Pitfall 2: Alarm Reliability Assumptions

**What goes wrong:**
`chrome.alarms` don't guarantee reliability. They may not fire while the device sleeps, won't wake the device, and "generally persist" but may be cleared on browser restart. For JobDigest's 6 AM daily fetch, this means jobs aren't fetched if:
- User's computer is asleep at 6 AM
- Browser restarted since alarm was set
- Alarm cleared unexpectedly by Chrome

Users wake up expecting new jobs, but the extension hasn't run. Trust in the product evaporates.

**Why it happens:**
Developers treat `chrome.alarms` like cron jobs, assuming "fire at 6 AM" means guaranteed execution. Chrome's alarm system is best-effort, not guaranteed.

**How to avoid:**
- **Verify alarm exists on every service worker startup**:
  ```javascript
  chrome.runtime.onStartup.addListener(async () => {
    const alarm = await chrome.alarms.get('daily-job-fetch');
    if (!alarm) {
      chrome.alarms.create('daily-job-fetch', {
        when: getNext6AM(),
        periodInMinutes: 1440 // 24 hours
      });
    }
  });
  ```
- **Implement "missed alarm" detection**: On alarm fire, check last-run timestamp in storage. If >25 hours since last run, run catch-up fetch
- **Provide manual trigger**: Always include a UI button for "Fetch Jobs Now" so users can manually trigger if automation fails
- **Store next expected run time**: If alarm doesn't fire within 1 hour of expected time, flag for manual intervention

**Warning signs:**
- Alarm count in `chrome.alarms.getAll()` returns empty after browser restart
- Last-run timestamp shows gaps >24 hours
- User reports "jobs didn't update overnight"
- Testing on laptop that sleeps overnight shows missed alarms

**Phase to address:**
**Phase 1 (Core Infrastructure)**: Build alarm verification and recovery into service worker initialization.
**Phase 2 (MVP Features)**: Add manual "Fetch Now" button and last-run timestamp UI.

---

### Pitfall 3: CORS Errors with External APIs

**What goes wrong:**
Attempting to `fetch()` external APIs (Adzuna, JSearch, Claude) from service worker or content scripts results in "Access to fetch has been blocked by CORS policy" errors. Extension cannot retrieve job data, rendering the entire product useless.

**Why it happens:**
Chrome extensions run in isolated contexts (e.g., `chrome-extension://abc123...`). When service workers fetch external APIs, browsers treat this as cross-origin requests. External APIs never whitelist the extension's origin in their CORS headers. Without explicit permissions, Chrome blocks the request.

**How to avoid:**
- **Declare all API domains in `host_permissions`** in manifest.json:
  ```json
  {
    "host_permissions": [
      "https://api.adzuna.com/*",
      "https://jsearch.p.rapidapi.com/*",
      "https://api.anthropic.com/*"
    ]
  }
  ```
- **Never fetch from content scripts for cross-origin data**: Content scripts are subject to the page's CSP and don't bypass CORS. Always fetch from service worker
- **Test permissions early**: Verify `host_permissions` work in Phase 0 (setup) before building full API integration

**Warning signs:**
- Network panel shows CORS preflight failures (OPTIONS requests)
- `fetch()` promises reject with CORS errors
- Extension works locally but fails when packaged/published
- API calls succeed in Postman but fail in extension

**Phase to address:**
**Phase 0 (Setup)**: Add all `host_permissions` to manifest during initial project setup. Test with a single API call to verify CORS bypass works before proceeding to full implementation.

---

### Pitfall 4: Global State Loss on Service Worker Restart

**What goes wrong:**
Storing job data, user preferences, or API rate limit counters in global variables (e.g., `let jobCache = []`) works during initial testing but fails unpredictably in production. When the service worker terminates (after 30 seconds inactivity), all global variables reset. Users lose in-progress work, rate limit tracking becomes inaccurate, and the extension appears buggy.

**Why it happens:**
Developers coming from Manifest V2 (persistent background pages) assume global variables persist. In MV3 service workers, globals only exist while the worker is active (30 seconds to 5 minutes). Service workers are designed to be stateless and event-driven.

**How to avoid:**
- **Never use global variables for state**: All state must persist in `chrome.storage.local`, `chrome.storage.session` (for temporary state), or IndexedDB
- **Initialize state from storage on every function call**:
  ```javascript
  async function processJobs() {
    const { jobs, lastFetch } = await chrome.storage.local.get(['jobs', 'lastFetch']);
    // Work with loaded state, not globals
  }
  ```
- **Use `chrome.storage.session` for ephemeral state**: Rate limit counters, temporary flags, etc. Session storage persists across service worker restarts but clears when browser closes
- **Validate state assumptions**: On service worker startup, check if critical state exists and handle missing data gracefully

**Warning signs:**
- Data disappears after extension sits idle
- Rate limit tracking fails (makes too many API calls after worker restart)
- User settings revert to defaults randomly
- Dashboard shows jobs, then becomes empty on reload

**Phase to address:**
**Phase 0 (Setup)**: Establish storage patterns from the start. Create utility functions (`saveState()`, `loadState()`) and enforce their use across all modules.

---

### Pitfall 5: Storage Quota Exceeded for Job Data

**What goes wrong:**
`chrome.storage.local` has a 10 MB default limit (measured as JSON stringification of keys + values). JobDigest stores daily job fetches, which could easily exceed this:
- 200 jobs/day × 7 days = 1400 jobs
- Each job: title, company, description, URL, score, timestamp ≈ 2-5 KB
- Total: 2.8-7 MB for one week of jobs

Add user resume, preferences, application tracking, and the extension hits the quota. `storage.local.set()` fails silently or rejects promises, job data isn't saved, and users lose their scored jobs.

**Why it happens:**
Developers underestimate data size. Job descriptions are often 500-1000 characters. Storing full API responses compounds the problem. Testing with small datasets (10-20 jobs) hides the issue until production.

**How to avoid:**
- **Request `unlimitedStorage` permission** in manifest.json:
  ```json
  {
    "permissions": ["storage", "alarms", "unlimitedStorage"]
  }
  ```
- **Store only essential data**: Don't store full API responses. Extract and save only needed fields (title, company, description, URL, score, timestamp)
- **Implement data retention policy**: Automatically delete jobs older than 30 days. Allow users to configure retention (7/14/30 days)
- **Monitor storage usage**: Periodically check `chrome.storage.local.getBytesInUse()` and warn users when approaching limits
- **Compress job descriptions**: Truncate descriptions to 500 chars or implement LZ-string compression for large text

**Warning signs:**
- `chrome.runtime.lastError`: "QUOTA_BYTES quota exceeded"
- Promises from `storage.local.set()` reject
- New jobs don't appear in dashboard despite successful fetch
- Storage usage grows linearly without bounds

**Phase to address:**
**Phase 0 (Setup)**: Add `unlimitedStorage` to manifest immediately.
**Phase 2 (MVP Features)**: Implement data retention policy and storage monitoring UI.

---

### Pitfall 6: Retry Logic Absence for API Rate Limits

**What goes wrong:**
External APIs (Adzuna, JSearch, Claude) have rate limits. Without retry logic, the extension makes requests, receives `429 Too Many Requests` errors, and fails silently. JobDigest doesn't fetch jobs, doesn't score them, and users see an empty dashboard with no error message.

**Why it happens:**
Developers test with low request volumes (1-10 jobs) and never hit rate limits. Production usage (fetching 200 jobs, scoring each with Claude API) immediately triggers rate limits. Without exponential backoff and retry logic, the extension gives up on first failure.

**How to avoid:**
- **Implement exponential backoff with jitter**:
  ```javascript
  async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await sleep(delay);
          continue;
        }
        return response;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  ```
- **Respect `Retry-After` headers**: APIs like Claude include this header indicating when to retry
- **Implement request queuing**: For batch operations (scoring 200 jobs), queue requests and process with delays to stay under rate limits
- **Store failed requests for retry**: If service worker terminates mid-retry, save failed requests to storage and resume on next startup

**Warning signs:**
- Network panel shows `429` responses
- API calls succeed initially, then start failing
- Jobs fetch but don't get scored (Claude API rate limited)
- Error logs show "Too Many Requests" but no retry attempts

**Phase to address:**
**Phase 1 (Core Infrastructure)**: Build retry logic into API client modules from the start. Make it a reusable utility function that all API calls use.

---

### Pitfall 7: Missing Error Handling for chrome.runtime.lastError

**What goes wrong:**
Many Chrome extension APIs use callback-based error handling via `chrome.runtime.lastError`. If this error isn't checked after API calls, errors fail silently. Storage writes fail, alarms aren't set, permissions aren't granted, but the code continues executing as if successful. Bugs become impossible to diagnose because there's no error message.

**Why it happens:**
Modern developers expect promise-based error handling (try/catch). Chrome's callback-based APIs require explicit `runtime.lastError` checks. Forgetting this check causes silent failures.

**How to avoid:**
- **Use promise wrappers for Chrome APIs**:
  ```javascript
  function promisify(fn) {
    return (...args) => new Promise((resolve, reject) => {
      fn(...args, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }
  ```
- **Always check `runtime.lastError` in callbacks**:
  ```javascript
  chrome.storage.local.set({ jobs }, () => {
    if (chrome.runtime.lastError) {
      console.error('Storage error:', chrome.runtime.lastError);
      // Handle error
    }
  });
  ```
- **Prefer `chrome.storage.local.set().then()` pattern**: Modern Chrome supports promise-based storage APIs, which propagate errors naturally
- **Log all errors**: Never swallow errors. Always log to console and consider storing critical errors for user-facing error reports

**Warning signs:**
- Features work in isolation but fail when combined
- "It worked yesterday" bugs that can't be reproduced
- No error messages despite obvious failures
- Console shows unchecked `runtime.lastError` warnings

**Phase to address:**
**Phase 0 (Setup)**: Create promise wrappers for all Chrome APIs and enforce their use via code review checklist.

---

### Pitfall 8: Debugging Blind Spots with Inactive Service Workers

**What goes wrong:**
`console.log()` statements in service workers are only visible when the service worker is active and DevTools is open. After 30 seconds of inactivity, the service worker terminates and logs are lost. Worse, only `console.error()` and `console.warning()` appear in the Extensions Management page. Regular `console.log()` messages are invisible unless DevTools is open, making production debugging nearly impossible.

**Why it happens:**
Developers debug with DevTools open, which keeps the service worker active. Production issues occur when the service worker is inactive, and there's no visibility into what happened.

**How to avoid:**
- **Use `console.error()` for important logs**: Only errors and warnings persist in Extensions Management page
- **Implement persistent logging**:
  ```javascript
  async function log(message, level = 'info') {
    console[level](message);
    const { logs = [] } = await chrome.storage.local.get('logs');
    logs.push({ message, level, timestamp: Date.now() });
    // Keep last 100 logs
    await chrome.storage.local.set({ logs: logs.slice(-100) });
  }
  ```
- **Create a debug panel**: Build a dedicated extension page showing logs from storage, allowing post-mortem debugging
- **Use chrome://inspect/#service-workers**: Access service worker logs even when inactive, but this requires user action

**Warning signs:**
- Cannot reproduce bugs that users report
- No logs visible after service worker goes inactive
- "It works when I test it" but fails for users
- Missing context for errors that occurred hours ago

**Phase to address:**
**Phase 1 (Core Infrastructure)**: Build persistent logging utility from the start.
**Phase 3 (Polish)**: Add debug panel UI showing stored logs.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing full API responses | Easier initial development | Quota exceeded, slow queries | Never - always extract and store only needed fields |
| Using `setTimeout` instead of `chrome.alarms` | Works in DevTools testing | Broken after service worker termination | Never - alarms persist across restarts, timers don't |
| Global variables for state | Faster to write | State loss on worker restart | Only for purely derived/computed values within single function scope |
| Skipping `unlimitedStorage` permission | One less permission to justify | Quota errors in production | Never for apps storing user data |
| Fetching all jobs at once | Simpler code | Service worker timeout, poor UX | Only for MVP prototype (≤10 jobs), never for production |
| No retry logic for APIs | Faster initial development | Silent failures on rate limits | Only during initial API integration testing, must add before production |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Adzuna API | Storing API key in content script (exposed to page) | Store in service worker only, content scripts send messages to service worker for API calls |
| JSearch (RapidAPI) | Forgetting `X-RapidAPI-Key` header | Always include required headers; use a wrapper function to ensure consistency |
| Claude API | Sending all 200 jobs in single request | Batch scoring in groups of 10-15 jobs per request to stay under context limits and avoid timeout |
| Chrome Storage | Assuming synchronous writes | Always await `storage.local.set()` promises before proceeding; writes are async |
| chrome.alarms | Creating alarm on every service worker start | Check if alarm exists before creating (`chrome.alarms.get()`) to avoid duplicate alarms with different schedules |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing all jobs in single storage key | Slow dashboard render, storage writes take seconds | Partition by date: `jobs-2026-02-05`, `jobs-2026-02-06` | >500 jobs (>1 MB single key) |
| Scoring all jobs sequentially | Service worker timeout, 5+ minute scoring time | Parallel batches: Score 10 jobs concurrently, then next batch | >50 jobs |
| Loading all jobs on dashboard open | Slow page load, browser freeze | Pagination: Load 20 jobs at a time, infinite scroll | >200 jobs |
| No indexes on job data | Slow filtering ("remote only"), slow search | Add indexed fields: `jobsByDate`, `jobsByScore`, `jobsByLocation` | >100 jobs |
| Calling Claude API for every job individually | Rate limits, slow scoring | Batch scoring: Send multiple job descriptions in single API call (up to context limit) | >20 jobs |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys in `chrome.storage.sync` | Keys sync to Google servers, potential exposure | Use `chrome.storage.local` only; consider encrypting keys |
| Including API keys in manifest.json | Keys visible in extension package, public exposure | Load keys from user input or secure server endpoint |
| Fetching APIs from content scripts | Keys exposed to host page via interception | Always call APIs from service worker, content scripts message service worker |
| No input validation on resume upload | XSS via malicious resume content | Sanitize all user input before storing or displaying |
| Trusting external API responses | Malicious job listings with XSS payloads | Sanitize job titles/descriptions before rendering in dashboard |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading indicator during fetch | User doesn't know if extension is working, clicks "Fetch" multiple times | Show loading spinner, disable button, display "Fetching 50/200 jobs..." |
| No error messages for API failures | Silent failure, user thinks no jobs match resume | Display clear error: "Failed to fetch jobs from Adzuna. Retrying in 30 seconds..." |
| Alarm fires but no notification | User doesn't know jobs were fetched overnight | Show browser notification: "JobDigest: 47 new jobs scored and ready" |
| Scores without explanation | User doesn't understand why job scored 73/100 | Show score breakdown: "+30 skills match, +20 location, +23 salary range" |
| No indication of last fetch time | User doesn't know if data is stale | Display "Last updated: 2 hours ago" with refresh button |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **API Integration:** Often missing retry logic with exponential backoff — verify `429` responses are handled gracefully
- [ ] **Alarm Setup:** Often missing persistence verification on startup — verify alarm exists after browser restart
- [ ] **Service Worker Lifecycle:** Often missing batch processing for long operations — verify fetch completes even after 30+ seconds
- [ ] **Storage Operations:** Often missing quota monitoring — verify storage doesn't silently fail when approaching 10 MB
- [ ] **Error Handling:** Often missing `chrome.runtime.lastError` checks — verify all Chrome API callbacks check for errors
- [ ] **CORS Prevention:** Often missing `host_permissions` for all API domains — verify fetch works from packaged extension, not just unpacked
- [ ] **State Management:** Often missing storage persistence for critical state — verify state survives service worker restart
- [ ] **Debug Visibility:** Often missing persistent logging for production issues — verify errors are logged to storage, not just console

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service worker timeout mid-fetch | MEDIUM | 1. Check storage for partial job data. 2. Resume from last saved batch. 3. Trigger manual "Resume Fetch" if >5 minutes passed |
| Alarm didn't fire overnight | LOW | 1. Detect missed alarm via timestamp gap. 2. Trigger immediate catch-up fetch. 3. Notify user: "Catching up on missed jobs" |
| Storage quota exceeded | HIGH | 1. Detect via `runtime.lastError`. 2. Prompt user to delete old jobs or reduce retention period. 3. Implement emergency cleanup (delete oldest 50%) |
| CORS errors blocking API | LOW | 1. Verify `host_permissions` in manifest. 2. If missing, add and publish update. 3. Provide fallback: manual CSV import until update published |
| Global state lost | MEDIUM | 1. Always reload state from storage on entry to any function. 2. Display warning: "Extension restarted, progress may be lost". 3. Implement idempotency (safe to re-run) |
| Rate limit exceeded | LOW | 1. Detect `429` response. 2. Queue requests for retry after `Retry-After` duration. 3. Display: "Rate limited. Retrying in 60 seconds..." |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service Worker Termination | Phase 1 (Core Infrastructure) | Test fetch with 200 jobs, verify completion after 5+ minutes |
| Alarm Reliability | Phase 1 (Core Infrastructure) | Restart browser, verify alarm re-registered, fires on schedule |
| CORS Errors | Phase 0 (Setup) | Package extension, load unpacked, verify API calls succeed |
| Global State Loss | Phase 0 (Setup) | Load extension, wait 35 seconds, verify state persists after worker restart |
| Storage Quota | Phase 0 (Setup) + Phase 2 (MVP) | Store 1000 jobs, verify no quota errors, storage monitoring shows usage |
| Missing Retry Logic | Phase 1 (Core Infrastructure) | Mock `429` response, verify exponential backoff retry with delays |
| runtime.lastError | Phase 0 (Setup) | Force storage error (invalid data), verify error caught and logged |
| Debugging Blind Spots | Phase 1 (Core Infrastructure) + Phase 3 (Polish) | Wait for service worker inactivity, verify logs persist in storage, accessible via debug panel |

---

## Sources

**Official Chrome Documentation (HIGH Confidence):**
- [The extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Service worker termination conditions
- [chrome.alarms API Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) - Alarm reliability and best practices
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage quotas and limits
- [Known issues when migrating to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/known-issues) - Platform gaps and limitations
- [Migrate to a service worker](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - Global variables to storage migration
- [Debug extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug) - Service worker debugging limitations

**Community Resources (MEDIUM Confidence):**
- [Longer extension service worker lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes) - Chrome 116+ lifecycle improvements
- [How to Fix CORS Errors in Chrome Extensions](https://www.codestudy.net/blog/access-to-fetch-has-been-blocked-by-cors-policy-chrome-extension-error/) - host_permissions solution
- [Chrome Extension Manifest V3 common mistakes](https://moldstud.com/articles/p-top-10-common-manifest-file-issues-for-chrome-extensions-and-how-to-fix-them) - Manifest file issues
- [How to Handle API Rate Limits Gracefully](https://apistatuscheck.com/blog/how-to-handle-api-rate-limits) - Exponential backoff strategies
- [State Storage in Chrome Extensions](https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices) - Storage best practices

**Developer Discussions (MEDIUM Confidence):**
- [MV3, (inactive) service workers, and alarms](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE) - Alarm reliability issues
- [Manifest V3: Debugging Extension Service worker is a pain](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3QAinUhCiPY) - Console.log limitations
- [It seems alarms is not working in V3](https://github.com/GoogleChrome/chrome-extensions-samples/issues/630) - Alarm persistence problems

---

*Pitfalls research for: Chrome Extension Manifest V3 (Job Automation)*
*Researched: 2026-02-05*
