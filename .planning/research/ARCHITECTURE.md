# Architecture Research

**Domain:** Chrome Extension (Manifest V3)
**Researched:** 2026-02-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Popup   │  │  Options │  │  Side    │  │ Content  │        │
│  │  (HTML)  │  │  Page    │  │  Panel   │  │  Script  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                         │                                        │
│                         │ chrome.runtime.sendMessage()          │
│                         │ chrome.runtime.onMessage               │
│                         ↓                                        │
├─────────────────────────────────────────────────────────────────┤
│                    SERVICE WORKER (BACKGROUND)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Event handler (chrome.runtime.onInstalled, etc.)      │   │
│  │  • Orchestrates API calls, alarms, message routing       │   │
│  │  • NO DOM ACCESS (use Offscreen API if needed)           │   │
│  │  • Terminates after 30s inactivity or 5min work          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         │ chrome.alarms                          │
│                         │ chrome.storage                         │
│                         │ fetch() (with host_permissions)        │
│                         ↓                                        │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL INTEGRATIONS                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐     │
│  │  Adzuna   │  │  JSearch  │  │  Claude   │  │ Offscreen│     │
│  │    API    │  │    API    │  │    API    │  │   Doc    │     │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                       PERSISTENCE LAYER                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ chrome.    │  │ chrome.    │  │ IndexedDB  │                │
│  │ storage.   │  │ storage.   │  │  (large    │                │
│  │ local      │  │ sync       │  │   data)    │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Service Worker** | Event coordination, API orchestration, alarm scheduling, message routing | background.js - event-driven, terminates when idle |
| **Popup UI** | Primary user interface for dashboard, job cards, filtering | popup.html/js - React/Vue/vanilla JS with chrome.storage listeners |
| **Content Script** | (Optional) Inject UI or scrape web pages | Runs in page context, limited API access, message passing to service worker |
| **Options Page** | Settings configuration (API keys, preferences, resume) | options.html/js - standalone page, uses chrome.storage for persistence |
| **Offscreen Document** | DOM operations (PDF parsing, DOCX processing) when service worker lacks DOM | Hidden HTML page created via chrome.offscreen API, destroyed after use |
| **chrome.storage.local** | Primary data store (jobs, application tracking, settings) | 10MB limit (unlimited with permission), async API, survives extension reloads |
| **chrome.storage.sync** | User preferences synced across devices | ~100KB limit, 8KB per item, use for small settings only |
| **chrome.alarms** | Scheduled tasks (daily job fetching) | Persists across browser restarts, wakes service worker, minimum 1-minute intervals |

## Recommended Project Structure

```
job-digest-extension/
├── manifest.json              # Extension configuration (V3)
├── background/                # Service Worker
│   ├── service-worker.js      # Main event handler
│   ├── api/                   # API integration layer
│   │   ├── adzuna.js          # Adzuna API client
│   │   ├── jsearch.js         # JSearch API client
│   │   └── claude.js          # Claude API client
│   ├── scheduler.js           # chrome.alarms management
│   └── storage-manager.js     # chrome.storage abstraction
├── popup/                     # Main UI
│   ├── popup.html
│   ├── popup.js               # UI logic
│   ├── components/            # UI components
│   │   ├── job-card.js
│   │   ├── filters.js
│   │   └── export-button.js
│   └── styles/
│       └── popup.css
├── options/                   # Settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── offscreen/                 # DOM-dependent tasks
│   ├── offscreen.html
│   └── parsers/
│       ├── pdf-parser.js      # PDF.js for resume parsing
│       └── docx-parser.js     # Mammoth.js for DOCX parsing
├── shared/                    # Shared utilities
│   ├── storage.js             # Storage helpers
│   ├── constants.js           # Shared constants
│   └── utils.js               # Common functions
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── _locales/                  # (Optional) Internationalization
    └── en/
        └── messages.json
```

### Structure Rationale

- **background/**: Service worker is the orchestration layer. Separating API clients and scheduler logic keeps the main service-worker.js clean and testable.
- **popup/**: All UI code isolated. Component-based structure enables reusability and easier maintenance. Uses message passing to service worker for data operations.
- **offscreen/**: Only created when DOM access needed (PDF/DOCX parsing). Destroyed immediately after use to conserve resources.
- **shared/**: Code used by multiple contexts (popup, service worker, options). Avoids duplication and ensures consistency.
- **No src/ wrapper**: Extension root should contain manifest.json directly. Build tools can compile into this structure.

## Architectural Patterns

### Pattern 1: Message-Based Architecture

**What:** All communication between extension components uses chrome.runtime messaging APIs.

**When to use:** Always. Required for popup ↔ service worker, content scripts ↔ service worker, and options ↔ service worker communication.

**Trade-offs:**
- **Pros:** Decoupled components, clear boundaries, security model enforced by Chrome
- **Cons:** Asynchronous complexity, 64MB message size limit, requires error handling for dead receivers

**Example:**
```typescript
// In popup.js - Request jobs from service worker
const getJobs = async (filters) => {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_JOBS',
    payload: { filters }
  });
  return response.jobs;
};

// In service-worker.js - Handle job requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_JOBS') {
    chrome.storage.local.get(['jobs'], (result) => {
      const filtered = filterJobs(result.jobs, message.payload.filters);
      sendResponse({ jobs: filtered });
    });
    return true; // Indicates async response
  }
});
```

### Pattern 2: Storage Event-Driven UI Updates

**What:** UI components subscribe to chrome.storage.onChanged events to reactively update when data changes.

**When to use:** When multiple UI surfaces (popup, options, side panel) need to stay in sync with storage updates.

**Trade-offs:**
- **Pros:** Reactive updates, no polling, works across extension contexts
- **Cons:** Can trigger unnecessary re-renders, requires careful change filtering

**Example:**
```typescript
// In popup.js - Listen for job updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.jobs) {
    const newJobs = changes.jobs.newValue;
    renderJobCards(newJobs);
  }
});

// In service-worker.js - Update storage (triggers listeners)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'daily-job-fetch') {
    const jobs = await fetchJobsFromAPIs();
    await chrome.storage.local.set({ jobs }); // Popup auto-updates
  }
});
```

### Pattern 3: Offscreen Document for DOM Operations

**What:** Create a hidden offscreen document to perform DOM-dependent tasks (PDF parsing, DOCX processing) that service workers cannot do.

**When to use:** When you need DOM APIs, DOMParser, Blob URLs, or libraries requiring browser environment (PDF.js, Mammoth.js).

**Trade-offs:**
- **Pros:** Enables DOM operations without visible UI, isolated context
- **Cons:** API overhead, must manage document lifecycle, Chrome 109+ only

**Example:**
```typescript
// In service-worker.js - Create offscreen document for parsing
async function parseResumePDF(arrayBuffer) {
  // Create offscreen document if needed
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['BLOBS', 'DOM_PARSER'],
    justification: 'Parse PDF resume using PDF.js'
  });

  // Send data to offscreen document
  const response = await chrome.runtime.sendMessage({
    type: 'PARSE_PDF',
    payload: { arrayBuffer }
  });

  // Clean up offscreen document
  await chrome.offscreen.closeDocument();

  return response.text;
}

// In offscreen/parsers/pdf-parser.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARSE_PDF') {
    // Use PDF.js (requires DOM)
    pdfjsLib.getDocument(message.payload.arrayBuffer).promise.then(pdf => {
      // Extract text...
      sendResponse({ text: extractedText });
    });
    return true;
  }
});
```

### Pattern 4: Service Worker State Resurrection

**What:** Service workers terminate after 30s inactivity. All state must be persisted and restored on each wake-up.

**When to use:** Always in Manifest V3. Never rely on global variables persisting.

**Trade-offs:**
- **Pros:** Forces stateless design, resource efficient, aligned with web platform
- **Cons:** Requires careful state management, can't use long-running connections easily

**Example:**
```typescript
// ANTI-PATTERN - Global state lost on termination
let cachedJobs = []; // ❌ Will be lost when service worker terminates

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GET_JOBS') {
    // cachedJobs is [] after service worker restarts!
    sendResponse({ jobs: cachedJobs });
  }
});

// CORRECT PATTERN - Persist and restore state
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_JOBS') {
    chrome.storage.local.get(['jobs'], (result) => {
      sendResponse({ jobs: result.jobs || [] });
    });
    return true;
  }
});

// On service worker startup - restore alarms
chrome.runtime.onStartup.addListener(async () => {
  const alarm = await chrome.alarms.get('daily-job-fetch');
  if (!alarm) {
    chrome.alarms.create('daily-job-fetch', {
      periodInMinutes: 1440 // 24 hours
    });
  }
});
```

### Pattern 5: CORS Bypass with host_permissions

**What:** Service worker can make fetch() requests to any domain listed in manifest's host_permissions, bypassing CORS.

**When to use:** When calling external APIs (Adzuna, JSearch, Claude) from service worker.

**Trade-offs:**
- **Pros:** No CORS preflight, simpler than proxy servers, secure
- **Cons:** Requires user permission grant, limited to declared domains

**Example:**
```json
// In manifest.json
{
  "manifest_version": 3,
  "host_permissions": [
    "https://api.adzuna.com/*",
    "https://jsearch.p.rapidapi.com/*",
    "https://api.anthropic.com/*"
  ]
}
```

```typescript
// In service-worker.js - No CORS issues
async function fetchJobsFromAdzuna() {
  const response = await fetch('https://api.adzuna.com/v1/api/jobs/us/search', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return response.json(); // Works without CORS errors
}
```

## Data Flow

### Request Flow: Daily Job Fetch

```
chrome.alarms (daily trigger)
    ↓
Service Worker (onAlarm listener)
    ↓
API Clients (Adzuna, JSearch) ← fetch() with host_permissions
    ↓
Claude API (score jobs based on resume)
    ↓
chrome.storage.local.set({ jobs })
    ↓
chrome.storage.onChanged event
    ↓
Popup UI (if open) updates reactively
```

### Request Flow: User Action (Generate Cover Letter)

```
Popup UI (user clicks "Generate Cover Letter")
    ↓
chrome.runtime.sendMessage({ type: 'GENERATE_COVER_LETTER', jobId })
    ↓
Service Worker (onMessage listener)
    ↓
Retrieve job + resume from chrome.storage.local
    ↓
Claude API (generate cover letter)
    ↓
sendResponse({ coverLetter })
    ↓
Popup UI (display cover letter)
```

### State Management Flow

```
chrome.storage.local (source of truth)
    ↓ (read on mount)
Popup UI renders initial state
    ↓ (user interaction)
chrome.runtime.sendMessage (to service worker)
    ↓
Service Worker processes request
    ↓
chrome.storage.local.set (update state)
    ↓
chrome.storage.onChanged (broadcast)
    ↓
All listening UI contexts update
```

### Key Data Flows

1. **Scheduled Job Fetching:** chrome.alarms triggers service worker → API calls → storage update → UI notification (if open)
2. **User-Initiated Actions:** Popup sends message → service worker processes → responds directly or updates storage → UI updates
3. **Resume Parsing:** User uploads file in options → service worker creates offscreen doc → offscreen parses PDF/DOCX → storage update
4. **Export to CSV:** Popup requests → service worker retrieves from storage → generates CSV blob → downloads via chrome.downloads API

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-1k jobs** | chrome.storage.local sufficient, render all jobs in popup, no pagination needed |
| **1k-10k jobs** | Switch to IndexedDB for jobs, implement virtual scrolling, add search indexing |
| **10k+ jobs** | Consider compressing old jobs, implement archive strategy, lazy-load job details |

### Scaling Priorities

1. **First bottleneck: Storage size (10MB chrome.storage.local limit)**
   - **Fix:** Migrate to IndexedDB for unlimited storage, keep only metadata in chrome.storage.local for quick access

2. **Second bottleneck: Popup render performance with many jobs**
   - **Fix:** Implement virtual scrolling (only render visible jobs), add pagination or infinite scroll, defer heavy computations

3. **Third bottleneck: API rate limits**
   - **Fix:** Cache job listings, implement exponential backoff, batch requests, respect API quotas in chrome.storage

## Anti-Patterns

### Anti-Pattern 1: Using Global Variables for State

**What people do:** Store application state in global variables in service worker

**Why it's wrong:** Service workers terminate after 30s inactivity. All global state is lost. Extension becomes unreliable.

**Do this instead:** Use chrome.storage.local or chrome.storage.session for all persistent state. Treat service worker as stateless.

### Anti-Pattern 2: Making API Calls from Content Scripts or Popup

**What people do:** Call external APIs directly from popup or content scripts

**Why it's wrong:** CORS restrictions block requests. Content Security Policy violations. Exposes API keys in less secure contexts.

**Do this instead:** Always route API calls through service worker. Use message passing. Service worker has host_permissions to bypass CORS.

### Anti-Pattern 3: Keeping Service Worker Alive Artificially

**What people do:** Use setInterval, WebSocket pings, or repeated chrome API calls to prevent service worker termination

**Why it's wrong:** Defeats Manifest V3's resource efficiency goals. Chrome may kill extensions that abuse this. Creates battery drain.

**Do this instead:** Design for intermittent execution. Use chrome.alarms for scheduling. Accept service worker termination as normal.

### Anti-Pattern 4: Using localStorage Instead of chrome.storage

**What people do:** Use browser's localStorage API for extension data

**Why it's wrong:** Service workers don't have DOM access, so localStorage doesn't exist there. Data isn't synced across extension contexts. No change events.

**Do this instead:** Always use chrome.storage.local or chrome.storage.sync. They work across all extension contexts and provide onChanged events.

### Anti-Pattern 5: Not Handling Message Receiver Death

**What people do:** Assume chrome.runtime.sendMessage always succeeds

**Why it's wrong:** If service worker is terminated or popup closed, sendMessage fails silently. Users see frozen UI.

**Do this instead:** Wrap sendMessage in try-catch. Handle chrome.runtime.lastError. Provide fallback UI states.

```typescript
// WRONG
chrome.runtime.sendMessage({ type: 'GET_JOBS' }, (response) => {
  renderJobs(response.jobs); // Fails silently if service worker dead
});

// CORRECT
try {
  const response = await chrome.runtime.sendMessage({ type: 'GET_JOBS' });
  if (chrome.runtime.lastError) {
    console.error('Service worker not responding:', chrome.runtime.lastError);
    showErrorUI('Unable to load jobs. Try refreshing.');
    return;
  }
  renderJobs(response.jobs);
} catch (error) {
  showErrorUI('Extension error. Please reload.');
}
```

### Anti-Pattern 6: Synchronous chrome.storage API Usage

**What people do:** Treat chrome.storage like synchronous localStorage

**Why it's wrong:** chrome.storage is asynchronous. Code that expects immediate values will break.

**Do this instead:** Use async/await or Promises. Handle storage reads before rendering.

```typescript
// WRONG
let jobs;
chrome.storage.local.get(['jobs'], (result) => {
  jobs = result.jobs;
});
renderJobs(jobs); // jobs is undefined! Async hasn't completed

// CORRECT
const { jobs } = await chrome.storage.local.get(['jobs']);
renderJobs(jobs || []);
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Adzuna API** | Service worker fetch() with API key in headers | Requires host_permissions for api.adzuna.com, rate limits apply |
| **JSearch API** | Service worker fetch() via RapidAPI headers | Requires host_permissions for jsearch.p.rapidapi.com, quota-based pricing |
| **Claude API** | Service worker fetch() with Anthropic API key | Requires host_permissions for api.anthropic.com, pay-per-token |
| **PDF.js** | Offscreen document (needs DOM) | Bundle library in extension, use chrome.offscreen for parsing |
| **Mammoth.js** | Offscreen document (needs DOM for DOCX → HTML) | Bundle library, use chrome.offscreen for parsing |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Popup ↔ Service Worker** | chrome.runtime.sendMessage (one-time requests) | Service worker must return true for async responses |
| **Options ↔ Service Worker** | chrome.runtime.sendMessage + chrome.storage | Options directly writes to storage, service worker listens to onChanged |
| **Service Worker ↔ Offscreen Doc** | chrome.runtime.sendMessage | Create offscreen doc, send message, close after response |
| **All Contexts ↔ Storage** | chrome.storage.local.get/set + onChanged | Storage is shared state, onChanged broadcasts updates |
| **Service Worker ↔ Alarms** | chrome.alarms.create + onAlarm listener | Alarms persist across browser restarts, wake service worker |

## Build Order Implications

Based on architectural dependencies, suggested build order:

### Phase 1: Foundation (No Dependencies)
- manifest.json configuration
- chrome.storage abstractions (shared/storage.js)
- Service worker skeleton (background/service-worker.js)
- Basic popup shell (popup/popup.html)

**Rationale:** These have no dependencies and establish communication infrastructure.

### Phase 2: Storage & Scheduling (Depends on Foundation)
- chrome.storage.local schema for jobs
- chrome.alarms setup for daily fetching
- Service worker alarm listeners

**Rationale:** Scheduling requires service worker. Storage schema needed before API integration.

### Phase 3: API Integration (Depends on Storage)
- Adzuna API client (background/api/adzuna.js)
- JSearch API client (background/api/jsearch.js)
- Job fetching orchestration in service worker
- Storage writes for fetched jobs

**Rationale:** APIs write to storage, so storage must exist first.

### Phase 4: AI Scoring (Depends on API + Storage)
- Claude API client (background/api/claude.js)
- Resume storage and retrieval
- Job scoring logic
- Offscreen document for PDF parsing (if needed)

**Rationale:** Scoring requires jobs to exist and resume to be stored.

### Phase 5: UI Display (Depends on Storage)
- Popup job card rendering
- Filtering and sorting
- chrome.storage.onChanged listeners for reactive updates

**Rationale:** UI reads from storage, so storage schema must be stable.

### Phase 6: Advanced Features (Depends on All Previous)
- Cover letter generation
- Recruiter message generation
- Application tracking (mark as applied)
- Export to CSV

**Rationale:** These features compose all previous layers.

### Phase 7: Polish (Independent)
- Options page for settings
- Error handling and retry logic
- Notifications for new high-scoring jobs
- Performance optimization

**Rationale:** Can be built incrementally without blocking core functionality.

## Sources

**Official Chrome Extension Documentation (HIGH confidence):**
- [Chrome Extension Manifest V3 Architecture Overview](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)
- [Service Workers in Manifest V3](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [chrome.offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [chrome.alarms API Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms)

**Community Resources (MEDIUM confidence, verified with official docs):**
- [Chrome Extension Development: The Complete System Architecture Guide for 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [Understanding Chrome Extensions: A Developer's Guide to Manifest V3](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l)
- [Deep Dive into Chrome Extensions: From Lifecycle to Dataflow](https://sriniously.xyz/blog/chrome-extension)
- [Chrome Extension File Structure: A Developer's Complete Guide (2025)](https://www.extensionradar.com/blog/chrome-extension-file-structure)
- [How to Fix CORS Policy Error in Chrome Extension Background Script](https://www.codestudy.net/blog/access-to-fetch-has-been-blocked-by-cors-policy-chrome-extension-error/)
- [Deep Dive into Chrome Alarm API](https://dev.to/scriptjsh/deep-dive-into-chrome-alarm-api-scheduling-timed-events-in-chrome-extensions-2glc)
- [How to Create Offscreen Documents in Chrome Extensions](https://dev.to/notearthian/how-to-create-offscreen-documents-in-chrome-extensions-a-complete-guide-3ke2)

---
*Architecture research for: Chrome Extension (Manifest V3)*
*Researched: 2026-02-05*
