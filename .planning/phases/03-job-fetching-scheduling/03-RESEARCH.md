# Phase 3: Job Fetching & Scheduling - Research

**Researched:** 2026-02-05
**Domain:** Chrome Extension job fetching automation with chrome.alarms, Adzuna API, JSearch API
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 implements automated daily job fetching from Adzuna and JSearch APIs using chrome.alarms for scheduling, with adaptive distribution logic to optimize API selection based on job quality. The research reveals Chrome Extension MV3 patterns for reliable scheduling, batch processing with checkpoints for service worker resilience, and comprehensive API integration requirements.

**Key findings:**
- chrome.alarms provides reliable daily scheduling but requires manual alarm verification on startup due to limited persistence guarantees
- Service workers terminate after 30 seconds of inactivity, requiring checkpoint-based batch processing for multi-step fetches
- Both Adzuna and JSearch APIs support rich filtering (location, salary, date posted) with generous free tiers (Adzuna ~1000/month, JSearch 500/month)
- Browser timezone detection via Intl.DateTimeFormat().resolvedOptions().timeZone provides IANA timezone strings for accurate scheduling
- Adaptive distribution requires per-API quality metrics storage and recalibration logic to optimize 100-job daily allocation

**Primary recommendation:** Use chrome.alarms with `when` parameter for precise daily scheduling, store batch progress in chrome.storage.local for service worker restart recovery, and implement keep-alive during multi-API fetch sequences to prevent mid-operation termination.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Adaptive distribution**: Split the 100-job daily cap between Adzuna and JSearch based on which API delivers better matches
- **Bootstrap approach**: "Gather first" — on each fetch, get 25 jobs from each API, score them, then allocate remaining 50 jobs based on quality results
- **User-configurable time with timezone support**: Users can set their preferred fetch time (not fixed at 6 AM PST)

### Claude's Discretion
- Exact quality metric for adaptive distribution (average score vs high-value job count vs hybrid approach)
- Recalibration frequency for the adaptive algorithm
- Timezone handling strategy (auto-detect browser timezone, explicit timezone setting, or hybrid approach)
- Missed alarm behavior (fetch on wakeup, skip missed, or smart catch-up based on calendar day)
- Fetch history visibility (current status only, recent history, or detailed logs)
- Manual "Fetch Jobs Now" button placement and behavior (assumed in settings panel, respects daily cap)
- Search query configuration UI (keywords, location, salary) — defer detailed design to planning phase

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for Chrome Extension job fetching and scheduling:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chrome.alarms | MV3 API | Daily scheduling at specific times | Only reliable scheduling mechanism in MV3 service workers; setTimeout/setInterval unreliable |
| chrome.storage.local | MV3 API | Persistent state and checkpoint storage | Only persistence mechanism available in service workers; survives restarts |
| Intl.DateTimeFormat | ES6+ | Browser timezone detection | Native browser API for IANA timezone strings; no dependencies |
| fetch API | Native | HTTP requests to Adzuna/JSearch APIs | Native, no dependencies; works in service workers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| keep-alive.js | Phase 1 | Service worker lifetime extension | During multi-step fetch operations (25+25+scoring+50) to prevent 30s timeout |
| errors.js | Phase 1 | API error handling with retry | For Adzuna/JSearch API calls with exponential backoff |
| storage.js | Phase 1 | Storage abstraction layer | All persistence operations (getDailyStats, getBatchProgress, saveJobs) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chrome.alarms | Web Workers + setTimeout | Web Workers not available in extension service workers; setTimeout cleared on termination |
| Intl API | Manual timezone offset calculation | Offset doesn't account for DST; IANA timezone strings more reliable |
| Direct chrome.storage.local | storage.js abstraction | Lose daily stats auto-reset logic, batch progress helpers; reinvent existing infrastructure |

**Installation:**
No external dependencies required — all APIs are native to Chrome Extension MV3 or already implemented in Phase 1.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── job-fetcher.js           # Main orchestrator for daily fetch
├── api/
│   ├── adzuna.js            # Adzuna API client
│   └── jsearch.js           # JSearch API client
├── scheduler.js             # Alarm creation, verification, time calculation
├── adaptive-distribution.js # Quality tracking and API allocation logic
└── storage.js               # (Phase 1) Extended with new keys
```

### Pattern 1: Daily Alarm Scheduling with Timezone Support
**What:** Calculate next occurrence of user's preferred time in their local timezone, convert to UTC milliseconds, create chrome.alarms with `when` parameter
**When to use:** For any time-based scheduling in Chrome Extensions (daily, weekly, specific time)
**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
async function scheduleNextFetch(userPreferredHour = 6) {
  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Calculate next occurrence of preferred hour in user's timezone
  const now = new Date();
  const nextFetch = new Date();
  nextFetch.setHours(userPreferredHour, 0, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (nextFetch <= now) {
    nextFetch.setDate(nextFetch.getDate() + 1);
  }

  // Create alarm with periodInMinutes for daily recurrence
  await chrome.alarms.create('daily-job-fetch', {
    when: nextFetch.getTime(), // milliseconds since epoch
    periodInMinutes: 1440       // 24 hours
  });
}
```

### Pattern 2: Alarm Persistence Verification
**What:** Check alarm existence on service worker startup and recreate if missing
**When to use:** Every chrome.runtime.onStartup and chrome.runtime.onInstalled event
**Example:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
chrome.runtime.onStartup.addListener(async () => {
  const alarm = await chrome.alarms.get('daily-job-fetch');

  if (!alarm) {
    console.warn('Daily fetch alarm missing, recreating...');
    await scheduleNextFetch(); // Recreate from stored user preferences
  }
});
```

### Pattern 3: Checkpoint-Based Batch Processing
**What:** Break fetch into stages, save progress after each stage, resume from last checkpoint on service worker restart
**When to use:** Any multi-step operation that might exceed 30 seconds or span multiple API calls
**Example:**
```javascript
// Source: Derived from Chrome Extension service worker best practices
async function fetchJobsWithCheckpoints() {
  const progress = await storage.getBatchProgress();

  // Resume from checkpoint
  switch (progress.stage) {
    case 'initial':
    case 'adzuna-bootstrap':
      await storage.setBatchProgress({ stage: 'adzuna-bootstrap', inProgress: true });
      const adzunaBootstrap = await fetchAdzunaJobs(25);
      await storage.saveJobs(adzunaBootstrap);
      // Fall through to next stage

    case 'jsearch-bootstrap':
      await storage.setBatchProgress({ stage: 'jsearch-bootstrap', inProgress: true });
      const jsearchBootstrap = await fetchJSearchJobs(25);
      await storage.saveJobs(jsearchBootstrap);
      // Fall through to next stage

    case 'scoring':
      await storage.setBatchProgress({ stage: 'scoring', inProgress: true });
      const scores = await scoreJobs(/* jobs from storage */);
      await storage.saveJobScores(scores);
      // Fall through to next stage

    case 'adaptive-allocation':
      await storage.setBatchProgress({ stage: 'adaptive-allocation', inProgress: true });
      const allocation = calculateAdaptiveAllocation(scores); // { adzuna: 30, jsearch: 20 }

      // Fetch remaining jobs based on allocation
      const remaining = await fetchRemainingJobs(allocation);
      await storage.saveJobs(remaining);

      // Complete
      await storage.clearBatchProgress();
      break;
  }
}
```

### Pattern 4: Keep-Alive During Long Operations
**What:** Use keep-alive.js during multi-step fetches to prevent service worker termination
**When to use:** Operations spanning multiple async calls that collectively exceed 30 seconds
**Example:**
```javascript
// Source: Phase 1 keep-alive.js implementation
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-job-fetch') {
    // Wrap entire fetch sequence in keep-alive
    await keepAlive.withKeepAlive('job-fetch', async () => {
      await fetchJobsWithCheckpoints();
    });
  }
});
```

### Pattern 5: Adaptive Distribution Storage Schema
**What:** Track per-API quality metrics to optimize future allocations
**When to use:** Any system learning from quality feedback to optimize resource allocation
**Example:**
```javascript
// Storage schema for adaptive distribution
const STORAGE_KEYS = {
  // ... existing keys from Phase 1
  ADAPTIVE_METRICS: 'adaptiveMetrics' // { adzuna: {...}, jsearch: {...}, lastCalibration: ISO date }
};

// Metrics structure
const adaptiveMetrics = {
  adzuna: {
    totalFetched: 150,        // Total jobs fetched historically
    totalScored: 150,         // Total jobs scored
    averageScore: 67.3,       // Mean score of all jobs
    highValueCount: 23,       // Jobs with score >= 80
    lastAllocation: 55,       // Jobs allocated in most recent fetch
    recentWindow: [           // Rolling window of recent fetch quality
      { date: '2026-02-04', avgScore: 65.2, highValueCount: 4, jobCount: 25 },
      { date: '2026-02-03', avgScore: 69.1, highValueCount: 6, jobCount: 30 }
    ]
  },
  jsearch: {
    totalFetched: 100,
    totalScored: 100,
    averageScore: 72.8,
    highValueCount: 31,
    lastAllocation: 45,
    recentWindow: [
      { date: '2026-02-04', avgScore: 74.1, highValueCount: 7, jobCount: 25 },
      { date: '2026-02-03', avgScore: 71.5, highValueCount: 5, jobCount: 20 }
    ]
  },
  lastCalibration: '2026-02-04T06:00:00Z'
};
```

### Anti-Patterns to Avoid

- **Global variables for state**: Service worker terminates, losing all in-memory state. Always use chrome.storage.local
- **setTimeout/setInterval for scheduling**: Timers cleared on service worker termination. Use chrome.alarms exclusively
- **Fetching all 100 jobs sequentially**: Exceeds 30s timeout, worker terminates mid-operation. Use checkpoint batches
- **Ignoring chrome.runtime.lastError**: Silent failures prevent alarm creation/verification. Always check lastError or use Promises
- **Fixed timezone assumptions (6 AM PST)**: Users in different timezones get poor UX. Detect browser timezone or let user configure

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Daily scheduling | Custom setTimeout loop with persistence | chrome.alarms with `when` + `periodInMinutes` | Chrome manages alarm persistence, handles device sleep/wake, resets timer on missed alarms |
| Service worker keep-alive | Manual chrome.runtime.getPlatformInfo() polling | keep-alive.js from Phase 1 | Already tested dual mechanism (alarms + setTimeout); handles cleanup |
| API retry logic | Manual retry loops with delays | errors.js retryWithBackoff from Phase 1 | Handles exponential backoff, jitter, Retry-After headers, retryability logic |
| Batch progress tracking | Custom checkpoint flags | storage.js getBatchProgress/setBatchProgress | Auto-reset on completion, consistent schema across phases |
| Daily cap enforcement | Manual counters with date checks | storage.js getDailyStats with auto-reset | Automatically resets on date change, atomic increment operations |

**Key insight:** Chrome Extension MV3's service worker termination model requires specialized patterns (alarms, checkpoint storage) that differ from traditional web app architectures. Reinventing these patterns leads to reliability issues.

## Common Pitfalls

### Pitfall 1: Alarms Not Recreated After Browser Restart
**What goes wrong:** chrome.alarms persist "generally" but not guaranteed across browser restarts. Users experience missed fetches after restarting Chrome
**Why it happens:** Documentation states alarms "generally persist until an extension is updated" but doesn't guarantee persistence across browser restarts
**How to avoid:**
- Register chrome.runtime.onStartup listener to verify alarm existence
- Check alarm with chrome.alarms.get() on every service worker startup
- Recreate alarm if missing using stored user preferences
**Warning signs:**
- Alarm fires after extension update but not after Chrome restart
- Users report "fetch didn't run this morning" after system reboot

### Pitfall 2: Service Worker Termination Mid-Fetch
**What goes wrong:** Fetch sequence (25 Adzuna + 25 JSearch + scoring + remaining 50) exceeds 30 seconds, service worker terminates, partial jobs saved, daily cap wasted
**Why it happens:** Each API call (especially JSearch with 1-8s latency) plus scoring can exceed 30s aggregate time
**How to avoid:**
- Break fetch into stages with checkpoint storage between each stage
- Use keep-alive.js to extend service worker lifetime during fetch
- Resume from last checkpoint on service worker restart
- Store batch progress in chrome.storage.local, not memory
**Warning signs:**
- Some days only 50 jobs fetched instead of 100
- Batch progress shows inProgress: true on subsequent startups
- Console logs show "Service worker terminated" during fetch

### Pitfall 3: Timezone Drift with Fixed PST Scheduling
**What goes wrong:** User in EST sets alarm for "6 AM", alarm fires at 3 AM EST (6 AM PST) because timezone is hard-coded
**Why it happens:** Date.setHours(6) without timezone awareness uses local time, but storing/comparing times in UTC can cause confusion
**How to avoid:**
- Detect user timezone with Intl.DateTimeFormat().resolvedOptions().timeZone
- Store user's preferred time in user's timezone (e.g., "6:00" + "America/New_York")
- Calculate next occurrence in user's timezone, then convert to UTC milliseconds for chrome.alarms
- Test with users in multiple timezones, especially during DST transitions
**Warning signs:**
- User says "alarm fires at wrong time"
- Issues reported during DST transitions (spring forward, fall back)
- Alarm time correct on first schedule, wrong after browser restart

### Pitfall 4: Missed Alarms After Device Sleep Not Handled
**What goes wrong:** User's laptop sleeps overnight, alarm missed, wakes up with no jobs fetched
**Why it happens:** Chrome fires missed alarms once on wake but doesn't distinguish between "missed by 1 minute" vs "missed by 8 hours"
**How to avoid:**
- Implement missed alarm detection logic in chrome.alarms.onAlarm listener
- Check alarm.scheduledTime vs current time to detect delay
- Decide policy: always fetch on wake (could waste quota if multiple missed alarms) or skip if missed by > 2 hours
- Store last successful fetch date to prevent duplicate fetches
**Warning signs:**
- Users report "no jobs fetched" after laptop was closed overnight
- Multiple fetches triggered rapidly after wake from long sleep
- Daily cap exceeded due to catch-up fetches

### Pitfall 5: API Rate Limits Confused with Daily Cap
**What goes wrong:** Extension hits Adzuna rate limit (1000/month = ~33/day), stops fetching, but daily cap shows only 30 jobs fetched. User assumes extension broken
**Why it happens:** API rate limits (429 errors) are separate from application daily cap (100 jobs/day). Rate limit errors may occur mid-fetch
**How to avoid:**
- Handle 429 errors with retry logic (already in errors.js)
- Track per-API success/failure counts separately from daily cap
- Display API rate limit status to user in UI ("Adzuna: 890/1000 monthly calls used")
- Fail gracefully: if Adzuna rate-limited, continue with JSearch only
**Warning signs:**
- Daily cap shows 25-30 jobs but user expects 100
- Console shows 429 errors but UI shows no error message
- Works fine first few days of month, fails later

### Pitfall 6: Adaptive Metrics Not Reset on User Profile Change
**What goes wrong:** User changes resume from "software engineer" to "data scientist", adaptive metrics still favor APIs that were good for engineering jobs, now irrelevant
**Why it happens:** Adaptive metrics accumulate over time based on scoring history, but scoring quality changes when resume changes
**How to avoid:**
- Detect resume changes (compare uploadedAt timestamp or hash)
- Reset or decay adaptive metrics when resume changes significantly
- Implement "recent window" with rolling 7-day history to favor recent quality over old data
- Allow user to manually reset metrics ("Start fresh")
**Warning signs:**
- User says "jobs don't match my new resume"
- Adaptive metrics show high averageScore but user reports low-quality jobs
- API allocation heavily skewed (90/10) despite both APIs having good recent results

## Code Examples

Verified patterns from official sources and Chrome Extension best practices:

### Scheduling Daily Alarm with User Timezone
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
// Combined with Intl API for timezone detection
async function scheduleDailyFetch(userHour = 6, userMinute = 0) {
  // Get user's timezone (e.g., "America/New_York")
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Calculate next occurrence of user's preferred time
  const now = new Date();
  const nextFetch = new Date();
  nextFetch.setHours(userHour, userMinute, 0, 0);

  // If preferred time has passed today, schedule for tomorrow
  if (nextFetch <= now) {
    nextFetch.setDate(nextFetch.getDate() + 1);
  }

  // Create recurring alarm (fires daily)
  await chrome.alarms.create('daily-job-fetch', {
    when: nextFetch.getTime(),  // Milliseconds since epoch (UTC)
    periodInMinutes: 1440        // 24 hours = daily recurrence
  });

  console.log(`Scheduled daily fetch for ${nextFetch.toLocaleString()} (${userTimezone})`);
}
```

### Verifying Alarm on Startup
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
chrome.runtime.onStartup.addListener(async () => {
  // Check if alarm exists
  const alarm = await chrome.alarms.get('daily-job-fetch');

  if (!alarm) {
    console.warn('Daily fetch alarm missing after browser restart');

    // Retrieve user's preferred time from storage
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    const userHour = settings?.fetchHour ?? 6;
    const userMinute = settings?.fetchMinute ?? 0;

    // Recreate alarm
    await scheduleDailyFetch(userHour, userMinute);
  } else {
    console.log('Daily fetch alarm verified:', alarm);
  }
});

// Also verify on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    const userHour = settings?.fetchHour ?? 6;
    const userMinute = settings?.fetchMinute ?? 0;
    await scheduleDailyFetch(userHour, userMinute);
  }
});
```

### Handling Missed Alarms After Device Sleep
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'daily-job-fetch') return;

  // Detect missed alarm (scheduled time vs actual fire time)
  const now = Date.now();
  const scheduledTime = alarm.scheduledTime;
  const delayMinutes = (now - scheduledTime) / 1000 / 60;

  if (delayMinutes > 120) {
    // Missed by more than 2 hours (likely device was asleep)
    console.warn(`Alarm missed by ${delayMinutes.toFixed(0)} minutes`);

    // Policy decision: Skip if missed by > 2 hours and already fetched today
    const dailyStats = await storage.getDailyStats();
    if (dailyStats.jobsFetched > 0) {
      console.log('Already fetched jobs today, skipping catch-up');
      return;
    }
  }

  // Proceed with fetch
  await fetchJobsWithCheckpoints();
});
```

### Adzuna API Client
```javascript
// Source: https://developer.adzuna.com/docs/search
async function fetchAdzunaJobs(count, searchParams = {}) {
  const apiKeys = await storage.getApiKeys();
  const { appId, appKey } = apiKeys.adzuna;

  const {
    query = 'software engineer',
    location = 'San Francisco',
    salaryMin = 100000,
    resultsPerPage = 20,
    page = 1
  } = searchParams;

  // Adzuna API endpoint (US)
  const url = new URL('https://api.adzuna.com/v1/api/jobs/us/search/1');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', Math.min(count, resultsPerPage));
  url.searchParams.set('what', query);
  url.searchParams.set('where', location);
  url.searchParams.set('salary_min', salaryMin);
  url.searchParams.set('sort_by', 'salary'); // Or 'relevance', 'date'
  url.searchParams.set('content-type', 'application/json');

  // Use existing retry logic from Phase 1
  const response = await retryWithBackoff(async () => {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      throw await createApiError(res, 'adzuna');
    }

    return res.json();
  });

  // Transform Adzuna response to normalized job format
  return response.results.map(job => ({
    jobId: `adzuna-${job.id}`,
    source: 'adzuna',
    title: job.title,
    company: job.company?.display_name || 'Unknown',
    location: job.location?.display_name || location,
    salary: {
      min: job.salary_min,
      max: job.salary_max,
      predicted: job.salary_is_predicted
    },
    description: job.description,
    url: job.redirect_url,
    postedAt: job.created,
    contractType: job.contract_type,
    fetchedAt: new Date().toISOString()
  }));
}
```

### JSearch API Client
```javascript
// Source: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
async function fetchJSearchJobs(count, searchParams = {}) {
  const apiKeys = await storage.getApiKeys();
  const jSearchKey = apiKeys.jsearch;

  const {
    query = 'software engineer in San Francisco',
    page = 1,
    numPages = 1,
    datePosted = 'all', // 'all', 'today', '3days', 'week', 'month'
    remoteJobsOnly = false,
    employmentTypes = 'FULLTIME' // 'FULLTIME,PARTTIME,CONTRACTOR'
  } = searchParams;

  // JSearch API endpoint
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('page', page);
  url.searchParams.set('num_pages', numPages);
  url.searchParams.set('date_posted', datePosted);

  if (remoteJobsOnly) {
    url.searchParams.set('remote_jobs_only', 'true');
  }
  if (employmentTypes) {
    url.searchParams.set('employment_types', employmentTypes);
  }

  // Use existing retry logic from Phase 1
  const response = await retryWithBackoff(async () => {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': jSearchKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });

    if (!res.ok) {
      throw await createApiError(res, 'jsearch');
    }

    return res.json();
  });

  // Transform JSearch response to normalized job format
  return response.data.slice(0, count).map(job => ({
    jobId: `jsearch-${job.job_id}`,
    source: 'jsearch',
    title: job.job_title,
    company: job.employer_name,
    location: job.job_city && job.job_state
      ? `${job.job_city}, ${job.job_state}`
      : job.job_country,
    salary: {
      min: job.job_min_salary,
      max: job.job_max_salary,
      predicted: false
    },
    description: job.job_description,
    url: job.job_apply_link,
    postedAt: job.job_posted_at_datetime_utc,
    employmentType: job.job_employment_type,
    isRemote: job.job_is_remote,
    fetchedAt: new Date().toISOString()
  }));
}
```

### Adaptive Distribution Algorithm
```javascript
// Calculate API allocation based on quality metrics
async function calculateAdaptiveAllocation(bootstrapScores) {
  // bootstrapScores: { 'adzuna-123': 85, 'jsearch-456': 62, ... }

  // Separate by API
  const adzunaScores = Object.entries(bootstrapScores)
    .filter(([jobId]) => jobId.startsWith('adzuna-'))
    .map(([_, score]) => score);

  const jsearchScores = Object.entries(bootstrapScores)
    .filter(([jobId]) => jobId.startsWith('jsearch-'))
    .map(([_, score]) => score);

  // Calculate quality metrics (average score + high-value count)
  const adzunaAvg = adzunaScores.reduce((sum, s) => sum + s, 0) / adzunaScores.length;
  const adzunaHighValue = adzunaScores.filter(s => s >= 80).length;

  const jsearchAvg = jsearchScores.reduce((sum, s) => sum + s, 0) / jsearchScores.length;
  const jsearchHighValue = jsearchScores.filter(s => s >= 80).length;

  // Hybrid quality metric: 70% average score, 30% high-value percentage
  const adzunaQuality = (adzunaAvg * 0.7) + ((adzunaHighValue / 25) * 100 * 0.3);
  const jsearchQuality = (jsearchAvg * 0.7) + ((jsearchHighValue / 25) * 100 * 0.3);

  // Allocate remaining 50 jobs proportionally to quality
  const totalQuality = adzunaQuality + jsearchQuality;
  const adzunaAllocation = Math.round((adzunaQuality / totalQuality) * 50);
  const jsearchAllocation = 50 - adzunaAllocation;

  // Update adaptive metrics for future calibration
  const metrics = await storage.get(STORAGE_KEYS.ADAPTIVE_METRICS) || {
    adzuna: { recentWindow: [] },
    jsearch: { recentWindow: [] }
  };

  const today = new Date().toISOString().split('T')[0];

  // Update recent window (rolling 7 days)
  metrics.adzuna.recentWindow.push({
    date: today,
    avgScore: adzunaAvg,
    highValueCount: adzunaHighValue,
    jobCount: 25 + adzunaAllocation
  });
  metrics.adzuna.recentWindow = metrics.adzuna.recentWindow.slice(-7);

  metrics.jsearch.recentWindow.push({
    date: today,
    avgScore: jsearchAvg,
    highValueCount: jsearchHighValue,
    jobCount: 25 + jsearchAllocation
  });
  metrics.jsearch.recentWindow = metrics.jsearch.recentWindow.slice(-7);

  await storage.set(STORAGE_KEYS.ADAPTIVE_METRICS, metrics);

  return { adzuna: adzunaAllocation, jsearch: jsearchAllocation };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manifest V2 background pages with persistent scripts | Manifest V3 service workers with 30s termination | Chrome 88 (2021) | Requires checkpoint-based batch processing, chrome.alarms for scheduling |
| Date.getTimezoneOffset() for timezone handling | Intl.DateTimeFormat().resolvedOptions().timeZone | Chrome 24 (2013), widespread 2017+ | IANA timezone strings more accurate, handles DST automatically |
| chrome.alarms minimum 1 minute | chrome.alarms minimum 30 seconds | Chrome 120 (2023) | Better alignment with service worker 30s timeout for keep-alive patterns |
| chrome.storage.local 5 MB limit | chrome.storage.local 10 MB limit | Chrome 114 (2023) | More headroom for storing jobs; ~1000 jobs with metadata fits comfortably |

**Deprecated/outdated:**
- **Background pages (MV2)**: Removed in MV3, must use service workers
- **Persistent scripts**: Service workers terminate after 30s inactivity, no persistent execution
- **Web Storage API (localStorage)**: Not available in service workers, use chrome.storage.local
- **Fixed PST timezone assumptions**: Users expect timezone-aware scheduling

## Open Questions

Things that couldn't be fully resolved:

1. **Adzuna API Monthly Rate Limit**
   - What we know: Free tier described as "generous" but specific monthly limit not documented on public pages
   - What's unclear: Exact number of calls per month (community sources suggest ~1000/month, official docs don't specify)
   - Recommendation: Start with assumption of 1000/month (~33/day), implement rate limit tracking, document actual limit during Phase 4 testing

2. **JSearch API Response Time Variability**
   - What we know: Documentation states "1-8 seconds" response time depending on parameters
   - What's unclear: Which parameters cause 8s responses vs 1s? Does pagination affect latency?
   - Recommendation: Monitor actual latency during Phase 4, implement timeout of 10s, use keep-alive to prevent service worker termination

3. **Adaptive Distribution Recalibration Frequency**
   - What we know: Need to balance responsiveness (daily) vs stability (weekly/rolling window)
   - What's unclear: Optimal recalibration frequency for job matching quality (daily is reactive but noisy, weekly is stable but slow to adapt)
   - Recommendation: Implement rolling 7-day window with daily updates; recent data weighted more heavily; allows responsiveness without excessive noise

4. **Missed Alarm Catch-Up Policy**
   - What we know: Chrome fires missed alarms once on wake, but could be hours late
   - What's unclear: Should extension skip missed alarm if > 2 hours late? Or always fetch? What about multiple missed alarms?
   - Recommendation: Implement "smart catch-up": fetch if missed by < 2 hours AND no fetch today; skip if already fetched today or missed by > 2 hours

5. **Timezone Changes While Extension Running**
   - What we know: User could change system timezone or travel across timezones
   - What's unclear: Should alarm automatically adjust to new timezone? Or keep user's original preference?
   - Recommendation: Detect timezone changes on alarm fire, notify user with option to update schedule; don't auto-adjust without confirmation

## Sources

### Primary (HIGH confidence)
- [chrome.alarms API Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) - Official Chrome documentation on alarm scheduling, persistence, and limitations
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Official documentation on 30s/5min termination conditions, state persistence requirements
- [Adzuna API Search Documentation](https://developer.adzuna.com/docs/search) - Official API endpoint structure, parameters, response format
- [Intl.DateTimeFormat.prototype.resolvedOptions()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions) - Official MDN documentation on timezone detection
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) - Official documentation on storage limits (10 MB), quota management

### Secondary (MEDIUM confidence)
- [Deep Dive into Chrome Alarm API](https://dev.to/scriptjsh/deep-dive-into-chrome-alarm-api-scheduling-timed-events-in-chrome-extensions-2glc) - Community guide on daily alarm scheduling patterns with code examples
- [Building Persistent Chrome Extension using Manifest V3](https://rahulnegi20.medium.com/building-persistent-chrome-extension-using-manifest-v3-198000bf1db6) - Checkpoint recovery patterns for service worker termination
- [RapidAPI JSearch Documentation](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) - API endpoint, authentication headers (X-RapidAPI-Key, X-RapidAPI-Host), search parameters
- [How to Handle API Rate Limits Gracefully (2026 Guide)](https://apistatuscheck.com/blog/how-to-handle-api-rate-limits) - Rate limiting best practices, monitoring headers, retry strategies

### Tertiary (LOW confidence)
- [JSearch API free tier 500 requests](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch/pricing) - Pricing page (dynamic content, couldn't verify exact limit)
- [Adzuna API generous free tier](https://publicapis.io/adzuna-api) - Community description, not official documentation
- [Job Recommendation Quality Scoring](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1660548/full) - Academic research on adaptive algorithms for job matching

## Metadata

**Confidence breakdown:**
- chrome.alarms scheduling: HIGH - Official Chrome documentation with examples
- Service worker lifecycle: HIGH - Official Chrome documentation on termination conditions
- Adzuna API integration: MEDIUM-HIGH - Official docs for endpoint/parameters, unclear on exact rate limits
- JSearch API integration: MEDIUM - Authentication and endpoint verified via RapidAPI, some parameters inferred from examples
- Adaptive distribution: LOW-MEDIUM - Pattern derived from academic research and general recommendation system practices, needs validation in Phase 4
- Batch processing patterns: MEDIUM-HIGH - Derived from official Chrome service worker guidance and community implementations

**Research date:** 2026-02-05
**Valid until:** 30-45 days (Chrome Extension APIs stable; job API docs may change quarterly)
