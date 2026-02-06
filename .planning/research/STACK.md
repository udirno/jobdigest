# Stack Research

**Domain:** Chrome Extension (Manifest V3) - Job Search Automation
**Researched:** 2026-02-05
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Chrome Extension Manifest V3 | v3 | Extension platform | Current standard (Manifest V2 deprecated), uses service workers for better performance and security, required for Chrome Web Store submissions |
| Vanilla JavaScript (ES2022+) | Latest | Core language | No framework overhead, faster startup, smaller payload, better for simple extensions, modern APIs like Fetch and ES Modules make frameworks unnecessary for this use case |
| chrome.storage.local | Built-in API | Primary data persistence | Optimized for extensions, 10MB default limit (extensible with unlimitedStorage permission), survives browser restarts and cache clearing, async API doesn't block service worker |
| chrome.alarms | Built-in API | Scheduled job fetching | Native scheduling API, minimum 30s interval (Chrome 120+), persists across browser restarts, wakes service worker when alarm fires |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfjs-dist | 5.4.624+ | PDF parsing (resume upload) | For extracting text from PDF resumes; Mozilla-maintained, web standards-based, works in browser |
| mammoth.js | 1.8.0+ | DOCX parsing (resume upload) | For extracting text from Word resumes; converts .docx to clean HTML/text, browser-compatible |
| No HTTP library needed | N/A | API calls (Adzuna, JSearch, Claude) | Use native `fetch()` API - designed for service workers, async, preferred over XMLHttpRequest in Manifest V3 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Chrome DevTools | Extension debugging | Use chrome://extensions in developer mode, service worker inspector for background debugging |
| VS Code + ESLint | Code editing & linting | Standard JavaScript development setup, no special extension tooling required |
| Optional: Vite + @crxjs/vite-plugin | Build tooling (if needed) | Only if you need bundling/HMR; vanilla setup works without build step for simple extensions |

## Installation

```bash
# For PDF parsing
npm install pdfjs-dist

# For DOCX parsing
npm install mammoth

# No other runtime dependencies needed - use native Chrome APIs
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pdfjs-dist (5.4.624+) | unpdf (0.10.1+) | Use unpdf if you need serverless/Node.js compatibility or lighter bundle, but note it requires Promise.withResolvers polyfill for older environments |
| mammoth.js | officeParser (6.0.4+) | Use officeParser if you need rich AST with formatting metadata (not just text extraction), but note PDF extraction doesn't work in browser bundles |
| chrome.storage.local | IndexedDB | Use IndexedDB only if you need >10MB storage without requesting unlimitedStorage permission, or need complex querying. Warning: chrome.storage.local has corruption issues with high-frequency writes (every few seconds) |
| Vanilla JavaScript | React/Vue/Svelte | Use a framework only if building complex UI with state management needs; for this card-based dashboard, vanilla JS is sufficient and faster |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Manifest V2 | Deprecated, removed from Chrome Web Store in June 2024, security limitations | Manifest V3 |
| Background pages (persistent) | Not available in Manifest V3, replaced by service workers | Service workers (background.service_worker in manifest) |
| XMLHttpRequest | Synchronous operations block service workers, deprecated pattern | fetch() API (async, designed for service workers) |
| localStorage / sessionStorage | Synchronous API blocks service worker, 5-10MB limit, cleared with browsing data | chrome.storage.local (async, survives cache clear) |
| Global variables in service worker | Service worker shuts down after 30s idle, variables lost | chrome.storage API or IndexedDB for persistence |
| remotely-hosted code | Blocked by Manifest V3 CSP (Content Security Policy) | Bundle all code with extension |
| pdf-parse (npm) | Unmaintained, not designed for browser use | pdfjs-dist or unpdf |

## Addressing Technical Concerns

### 1. Service Worker Lifecycle (Stay Alive for API Calls)

**Issue:** Service workers terminate after 30s idle or 5min for long requests. Fetch responses >30s also cause termination.

**Solution:**
- **Preferred approach:** Chain API calls efficiently. Most API calls (Adzuna, JSearch, Claude) should complete in <30s.
- **Keep-alive strategy:** Call `chrome.storage.local.get()` or other extension APIs every ~25s to reset idle timer during long operations.
- **For truly long operations (>5min):** Not recommended in service workers. Break into smaller chunks or use chrome.alarms to schedule continuation.
- **Active connections:** WebSocket connections extend lifetime (Chrome 116+), but not needed for REST APIs.

**Code pattern:**
```javascript
// Reset timer during long operations
async function longOperation() {
  const keepAlive = setInterval(() => {
    chrome.storage.local.get('keepalive'); // Resets timer
  }, 25000);

  try {
    await fetch('https://api.example.com/long-request');
  } finally {
    clearInterval(keepAlive);
  }
}
```

### 2. chrome.alarms Reliability for 6 AM Scheduling

**Issue:** Can alarms reliably trigger at 6 AM daily?

**Solution:**
- **Yes, with caveats:** Alarms persist across browser restarts and wake the service worker when they fire.
- **NOT guaranteed:** Alarms may be cleared on browser updates or restarts (not guaranteed to persist).
- **Does NOT wake device:** If computer is asleep at 6 AM, alarm fires when device wakes.
- **Best practice:** On service worker startup (`chrome.runtime.onStartup`), verify alarm exists and recreate if missing.

**Code pattern:**
```javascript
chrome.runtime.onStartup.addListener(async () => {
  const alarm = await chrome.alarms.get('dailyJobFetch');
  if (!alarm) {
    // Recreate alarm if missing
    chrome.alarms.create('dailyJobFetch', {
      when: getNext6AM(),
      periodInMinutes: 1440 // 24 hours
    });
  }
});
```

### 3. API Rate Limits (Adzuna 1000/mo, JSearch 150/mo)

**Issue:** How to manage rate limits and avoid wasting calls?

**Solution:**
- **Track usage:** Store API call counts in chrome.storage.local with monthly reset.
- **Intelligent fetching:** Fetch from Adzuna first (higher limit), fall back to JSearch only if needed.
- **User controls:** Allow users to configure fetch frequency (daily vs. every 2-3 days).
- **Cap enforcement:** Build in hard caps (e.g., max 100 jobs/day for Claude scoring) in extension logic.

**Storage schema:**
```javascript
{
  apiUsage: {
    adzuna: { count: 23, resetDate: '2026-03-01' },
    jsearch: { count: 5, resetDate: '2026-03-01' },
    claude: { count: 450, resetDate: '2026-03-01' }
  }
}
```

### 4. CORS Issues with External APIs

**Issue:** Will extension hit CORS errors calling Adzuna, JSearch, Claude APIs?

**Solution:**
- **Extensions bypass CORS:** Service workers can call any domain listed in `host_permissions` in manifest.json.
- **Manifest configuration:**
```json
{
  "host_permissions": [
    "https://api.adzuna.com/*",
    "https://jsearch.p.rapidapi.com/*",
    "https://api.anthropic.com/*"
  ]
}
```
- **Security note:** API keys visible in extension code (front-end). Not a vulnerability for personal use, but consider proxy server if distributing widely.
- **Content scripts vs. service worker:** Only service worker can make cross-origin requests. Content scripts cannot, even with host_permissions.

### 5. chrome.storage.local Size Limits

**Issue:** 10MB default limit - enough for job data?

**Calculation:**
- Assume 100 jobs/day × 30 days = 3,000 jobs/month
- Each job record ~2KB (title, company, description, score, URL, etc.)
- Total: 3,000 × 2KB = 6MB
- **Fits within 10MB limit** with room for settings, resume text, etc.

**Solutions if exceeded:**
- Request `"unlimitedStorage"` permission in manifest (no practical limit).
- Implement data pruning: Auto-delete jobs >30 days old.
- Compress job descriptions before storage.

**Code pattern:**
```javascript
// Monitor storage usage
chrome.storage.local.getBytesInUse(null, (bytes) => {
  const MB = bytes / (1024 * 1024);
  if (MB > 8) {
    console.warn('Approaching 10MB limit, consider pruning old jobs');
  }
});
```

### 6. PDF/DOCX Parsing Performance

**Issue:** Can resume parsing happen in service worker or does it need offscreen document?

**Solution:**
- **PDF.js limitation:** Requires DOM for rendering (uses Canvas API).
- **Use Offscreen Documents API:** Manifest V3 provides `chrome.offscreen` for DOM access from service workers.
- **Alternative:** Parse in popup/options page if user is actively uploading (simpler).
- **mammoth.js works in service worker:** Accepts ArrayBuffer, returns text without DOM.

**Architecture:**
```javascript
// In service worker
async function parseResume(file) {
  if (file.type === 'application/pdf') {
    // Create offscreen document for PDF.js
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse PDF resume'
    });
    // Send file to offscreen doc, receive parsed text
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // mammoth.js works directly in service worker
    const result = await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()});
    return result.value;
  }
}
```

## Stack Patterns by Variant

**If distributing extension widely (not just personal use):**
- Add backend proxy server to hide API keys (Adzuna, JSearch, Claude)
- Use environment-based configuration (dev vs. prod API endpoints)
- Consider rate limiting per user (if multi-user)

**If storage exceeds 10MB:**
- Request `"unlimitedStorage"` permission
- Implement background job pruning (auto-delete old jobs)
- Consider IndexedDB for structured job queries

**If UI complexity grows:**
- Consider adding a lightweight framework (Preact, Alpine.js)
- Use Web Components for reusable card components
- Current vanilla JS approach works for card-based dashboard

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pdfjs-dist@5.4.624 | Chrome 120+ | Uses Promise.withResolvers (ES2023), ensure polyfill for older Chrome if needed |
| mammoth.js@1.8.0 | Chrome 88+ | No special compatibility concerns, uses standard browser APIs |
| Chrome Manifest V3 | Chrome 88+ | Required for Chrome Web Store, service workers require Chrome 88+ |

## Confidence Assessment

| Technology | Confidence | Source |
|------------|-----------|--------|
| Manifest V3 architecture | HIGH | [Official Chrome docs](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) |
| Service worker lifecycle | HIGH | [Official lifecycle docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) |
| chrome.storage.local limits | HIGH | [Official storage API docs](https://developer.chrome.com/docs/extensions/reference/api/storage) |
| chrome.alarms reliability | HIGH | [Official alarms API docs](https://developer.chrome.com/docs/extensions/reference/api/alarms) |
| CORS bypass with host_permissions | HIGH | [Official network requests docs](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests) |
| pdfjs-dist version | MEDIUM | [npm package page](https://www.npmjs.com/package/pdfjs-dist), verified published 4 days ago |
| mammoth.js version | MEDIUM | [npm package page](https://www.npmjs.com/package/mammoth), version from search results |
| Vanilla JS best practice | MEDIUM | Multiple 2026 sources agree frameworks unnecessary for simple extensions |

## Sources

**Official Chrome Documentation (HIGH confidence):**
- [Manifest V3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Cross-Origin Network Requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)

**Library Documentation (MEDIUM-HIGH confidence):**
- [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) - v5.4.624, published 4 days ago
- [mammoth.js npm](https://www.npmjs.com/package/mammoth) - v1.8.0+
- [unpdf GitHub](https://github.com/unjs/unpdf) - Alternative PDF parser
- [officeParser GitHub](https://github.com/harshankur/officeParser) - v6.0.4, Alternative DOCX parser

**Community Best Practices (MEDIUM confidence):**
- [DEV: Chrome Extension Manifest V3 Guide](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l)
- [Chrome Extension Best Practices GitHub](https://github.com/dipankar/chrome-extension-best-practices)
- [Longer Service Worker Lifetimes (Chrome Blog)](https://developer.chrome.com/blog/longer-esw-lifetimes)
- [Vanilla JavaScript Trends 2026](https://dev.to/aleksei_aleinikov/build-your-first-chrome-extension-in-2025-with-just-vanilla-js-4c8p)

---
*Stack research for: JobDigest Chrome Extension*
*Researched: 2026-02-05*
