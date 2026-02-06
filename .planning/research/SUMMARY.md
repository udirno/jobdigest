# Project Research Summary

**Project:** JobDigest Chrome Extension
**Domain:** Chrome Extension (Manifest V3) - Job Search Automation
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

JobDigest is a Chrome extension that automates daily job searches by fetching positions from APIs (Adzuna, JSearch), scoring them against a user's resume using Claude AI (0-100 match score), and presenting high-quality matches in a dashboard. This eliminates the 2+ hours/day spent manually browsing job boards. The recommended approach leverages Manifest V3's service worker architecture with vanilla JavaScript (no framework overhead), chrome.storage.local for persistence, chrome.alarms for daily scheduling, and native Chrome APIs to bypass CORS restrictions when calling external services.

The core architectural challenge is managing service worker lifecycle termination (30s idle, 5min max runtime). Service workers aren't persistent background pages—they're event-driven and stateless. All API orchestration (Adzuna → JSearch → Claude scoring) must be chunked into <5-minute batches with progress saved to storage after each chunk. The killer feature is AI scoring, which requires careful prompt engineering and batch processing to stay within Claude API rate limits while maintaining fast user experience.

Critical risks include: (1) service worker termination mid-API-call leading to incomplete job fetches, (2) chrome.alarms not firing reliably overnight when devices sleep, (3) API rate limits (Adzuna 1000/mo, JSearch 150/mo, Claude pay-per-token) requiring intelligent quota management, and (4) storage quota exceeded with 10MB chrome.storage.local limit. Mitigation involves batch processing with persistent checkpoints, alarm verification on startup, request queuing with exponential backoff retry logic, and requesting unlimitedStorage permission from day one.

## Key Findings

### Recommended Stack

The stack is lean and Chrome-native to minimize extension overhead and maximize startup speed. Manifest V3 is mandatory (V2 deprecated since June 2024), requiring service workers instead of persistent background pages. Vanilla JavaScript (ES2022+) is sufficient for this card-based dashboard—modern fetch() API and ES Modules eliminate framework dependencies. The only external libraries needed are pdfjs-dist (5.4.624+) and mammoth.js (1.8.0+) for parsing resume uploads, both requiring an Offscreen Document for DOM access since service workers lack it.

**Core technologies:**
- **Manifest V3 Service Workers**: Event-driven background orchestration—required for Chrome Web Store, terminates after 30s idle, wakes on alarms/messages
- **chrome.storage.local**: 10MB async storage (request unlimitedStorage for unlimited)—persists across restarts, survives cache clearing, triggers onChanged events for reactive UI
- **chrome.alarms**: Native scheduling API for daily 6 AM job fetching—persists across browser restarts, wakes service worker when fired, minimum 30s intervals in Chrome 120+
- **Vanilla JavaScript + native fetch()**: No build step, faster load times—fetch() is async, designed for service workers, preferred over XMLHttpRequest in MV3
- **pdfjs-dist + mammoth.js**: Resume parsing from PDF/DOCX—Mozilla-maintained PDF.js works in browser, mammoth converts .docx to text, both require Offscreen Document for DOM operations

**What NOT to use:**
- Manifest V2 (removed from Chrome Web Store June 2024)
- Global variables in service worker (lost on termination after 30s)
- localStorage/sessionStorage (synchronous, blocks service worker, cleared with browsing data)
- React/Vue/Svelte (unnecessary for simple card UI, adds overhead)
- remotely-hosted code (blocked by Manifest V3 CSP)

### Expected Features

The research identified a clear MVP focused on automated job fetching with AI scoring, separating table-stakes features from premium future additions and explicitly avoiding "spray-and-pray" auto-apply anti-patterns.

**Must have (table stakes):**
- **Resume upload/storage** (PDF + DOCX support) — All AI features (scoring, cover letters) require resume as input; foundational dependency
- **Daily API job fetch** (Adzuna + JSearch) — Core automation value; eliminates 2+ hours of manual browsing
- **AI job-resume scoring (0-100)** — THE differentiator; instant quality assessment vs manual JD reading; killer feature requiring Claude API integration
- **Card-based dashboard** with sorting/filtering — View fetched jobs, sort by score (high to low), focus on top matches
- **Job detail view** — Read full job description before applying
- **Manual application status tracking** — Track progress through saved/applied/interview/rejected stages
- **Export to CSV** — Users expect data portability for backup/sharing with recruiters

**Should have (competitive differentiators):**
- **AI cover letter generator** — Teal/Huntr charge $9-15/mo for this; table stakes for premium tier; Claude API integration
- **AI recruiter message generator** — Extends cover letter feature to LinkedIn outreach; Claude API
- **Advanced filtering** (company, location, remote, salary) — Power users applying to 10+ jobs/day need granular filters; requires AI extraction from JDs
- **Application deadline tracking** — Prevent missed opportunities; countdown timers; browser notifications

**Defer (v2+):**
- **Skill gap analysis** — High complexity; requires structured skill taxonomy; educational value but not core workflow
- **Company research integration** (Clearbit, Crunchbase, Glassdoor) — Expensive API costs; requires premium tier ($10-15/mo)
- **Interview preparation assistant** — Scope creep beyond job search; potentially separate product
- **Browser autofill** for application forms — Anti-feature risk; ATS variability means 60-70% accuracy; users lose control

**Explicitly avoid (anti-features):**
- **Fully automated "apply to all" button** — "Spray and pray" has 0.5% response rate; damages user reputation; ethical concerns; instead prioritize best-fit jobs with AI scoring and require manual review
- **LinkedIn/Indeed scraping** — Violates ToS; legal risk (CFAA, GDPR); Chrome Web Store ban risk; use official APIs instead

### Architecture Approach

Manifest V3 enforces a message-based, event-driven architecture where the service worker acts as stateless orchestrator coordinating UI (popup/options), external APIs (Adzuna/JSearch/Claude), and persistence (chrome.storage). The service worker terminates after 30 seconds of inactivity or 5 minutes of continuous work, so all state must persist in storage and be restored on each wake-up. The Offscreen Document API provides DOM access for PDF/DOCX parsing without requiring visible UI.

**Major components:**
1. **Service Worker (background.js)** — Stateless event orchestrator; handles chrome.alarms (daily fetch), chrome.runtime.onMessage (popup requests), API orchestration with retry logic; terminates when idle; NO global state
2. **Popup UI (popup.html/js)** — Primary dashboard; renders job cards from chrome.storage; sends messages to service worker for actions (fetch, score, generate cover letter); subscribes to storage.onChanged for reactive updates
3. **API Integration Layer** (background/api/) — Adzuna, JSearch, Claude clients with fetch() using host_permissions to bypass CORS; implements exponential backoff retry for 429 rate limits; batches Claude scoring (10-15 jobs/request)
4. **Storage Manager** (shared/storage.js) — Abstraction over chrome.storage.local; handles data schema (jobs, resume, settings, API usage quotas); monitors storage.getBytesInUse() to prevent quota exceeded
5. **Offscreen Document** (offscreen.html) — Hidden page for PDF.js (requires Canvas API) and mammoth.js (DOCX parsing); created on-demand via chrome.offscreen.createDocument, destroyed after parsing completes
6. **Options Page** (options.html/js) — Settings configuration (API keys, fetch schedule, retention policy); resume upload interface

**Key architectural patterns:**
- **Message-based communication**: All cross-context calls use chrome.runtime.sendMessage (popup ↔ service worker, offscreen ↔ service worker)
- **Storage event-driven UI**: Popup subscribes to chrome.storage.onChanged; service worker writes updates trigger reactive rendering
- **Service worker state resurrection**: On every function entry, load state from storage (never rely on globals); verify alarms on chrome.runtime.onStartup
- **CORS bypass with host_permissions**: Service worker can fetch any domain in manifest's host_permissions without preflight
- **Batch processing for long operations**: Chunk API calls into <5min batches, save progress to storage after each, resume on restart if interrupted

### Critical Pitfalls

Research identified 8 critical pitfalls with prevention strategies. The top 5 that directly impact core workflow:

1. **Service Worker Termination Mid-API-Call** — Service workers die after 30s inactivity or 5min continuous work; if JobDigest fetches 200 jobs then scores them with Claude, the worker terminates mid-process, losing in-progress work. **Prevention**: Batch API calls into 10-15 job chunks, save progress to storage after each batch, use trivial extension API calls (chrome.storage.local.get()) every 25s to reset idle timer during long ops, implement graceful recovery (check storage for incomplete batches on restart).

2. **Alarm Reliability Assumptions** — chrome.alarms are best-effort, not guaranteed; they don't fire while device sleeps, don't wake device, and may be cleared on browser restart. Users expect 6 AM daily fetch but alarm may not fire. **Prevention**: Verify alarm exists on chrome.runtime.onStartup and recreate if missing, implement "missed alarm" detection (check last-run timestamp, run catch-up if >25h gap), always provide manual "Fetch Jobs Now" button as fallback.

3. **CORS Errors with External APIs** — fetch() from service worker to Adzuna/JSearch/Claude triggers "blocked by CORS policy" unless host_permissions declared in manifest.json. Extension becomes useless if APIs blocked. **Prevention**: Declare all API domains in host_permissions, never fetch from content scripts (they don't bypass CORS), test permissions early in packaged extension (not just unpacked dev mode).

4. **Global State Loss on Service Worker Restart** — Storing job cache, API rate counters, or user state in global variables (let jobCache = []) works in testing but fails unpredictably when service worker terminates. **Prevention**: NEVER use globals for state; persist everything in chrome.storage.local or chrome.storage.session; treat service worker as stateless; reload state from storage on every function call.

5. **Storage Quota Exceeded for Job Data** — chrome.storage.local has 10MB default limit; 200 jobs/day × 7 days = 1400 jobs × 2-5KB each = 2.8-7MB (approaching limit with resume, settings, etc.). storage.local.set() fails silently when quota exceeded. **Prevention**: Request unlimitedStorage permission in manifest immediately, implement data retention policy (auto-delete jobs >30 days), monitor storage.getBytesInUse() and warn users approaching limits, store only essential fields (not full API responses).

**Additional critical pitfalls:**
6. **Missing Retry Logic for API Rate Limits** — APIs return 429 Too Many Requests; without exponential backoff, extension fails silently
7. **Missing Error Handling for chrome.runtime.lastError** — Callback-based APIs fail silently if lastError not checked; use promise wrappers
8. **Debugging Blind Spots with Inactive Service Workers** — console.log() invisible when service worker inactive; implement persistent logging to storage

## Implications for Roadmap

Based on architectural dependencies and pitfall prevention needs, the roadmap should follow this phase structure:

### Phase 0: Foundation & Critical Infrastructure
**Rationale:** Establish service worker lifecycle management, storage patterns, and CORS permissions BEFORE building features. Pitfall prevention must be architectural, not bolted on later.
**Delivers:** Manifest V3 setup with host_permissions, storage abstraction layer with promise wrappers, service worker with alarm verification on startup, persistent logging utility
**Addresses:** Pitfalls #3 (CORS), #4 (global state), #7 (runtime.lastError), foundational requirements for all subsequent phases
**Avoids:** Technical debt from shortcuts (global variables, missing error handling, no retry logic)

### Phase 1: API Integration with Batch Processing
**Rationale:** Job fetching is the core value prop but must handle service worker termination. Build batch processing and retry logic from the start, not after timeout issues emerge.
**Delivers:** Adzuna + JSearch API clients with exponential backoff retry, batch orchestration (process in chunks, save progress), alarm-triggered daily fetch with catch-up logic for missed runs
**Uses:** chrome.alarms (verified on startup), chrome.storage.local (for batch checkpoints), fetch() with host_permissions
**Implements:** Service worker API orchestration, scheduler module
**Addresses:** Pitfalls #1 (service worker termination), #2 (alarm reliability), #6 (retry logic)

### Phase 2: Resume Storage & AI Scoring
**Rationale:** AI scoring is the killer feature and requires resume as input. Offscreen Document for PDF/DOCX parsing adds complexity but is unavoidable (service workers lack DOM).
**Delivers:** Resume upload UI (options page), Offscreen Document with PDF.js + mammoth.js parsers, Claude API client for job scoring (batch 10-15 jobs/request), storage schema for scored jobs
**Uses:** chrome.offscreen API, Claude API with batching, unlimitedStorage permission
**Implements:** AI integration layer, resume parsing pipeline
**Addresses:** MVP feature dependencies (all AI features require resume), pitfall #1 (batch scoring to avoid timeout)

### Phase 3: Dashboard UI & Job Management
**Rationale:** Once jobs are fetched and scored, users need to view/filter/track them. UI subscribes to storage.onChanged for reactive updates when service worker updates data.
**Delivers:** Popup with job card rendering, filter/sort by score, job detail modal, manual status tracking (saved/applied/rejected), storage monitoring UI (bytes used, retention settings)
**Uses:** chrome.storage.onChanged for reactive rendering, chrome.runtime.sendMessage for actions
**Implements:** Popup UI components, storage event listeners
**Addresses:** MVP must-have features (dashboard, filtering, status tracking), pitfall #5 (storage quota monitoring)

### Phase 4: Export & User Controls
**Rationale:** Export provides data portability (table stakes); manual fetch button is critical fallback for alarm failures.
**Delivers:** Export to CSV (all jobs + metadata), manual "Fetch Jobs Now" button, last-fetch timestamp display, settings page (API keys, retention policy, schedule)
**Uses:** chrome.downloads API for CSV export, options page for configuration
**Implements:** Export module, settings persistence
**Addresses:** Table-stakes features from research, pitfall #2 mitigation (manual trigger for missed alarms)

### Phase 5: AI Content Generation
**Rationale:** Cover letter and recruiter message generation are competitive differentiators but depend on all previous infrastructure (resume storage, job data, Claude API integration).
**Delivers:** AI cover letter generator (per job + resume), AI recruiter message generator, template management
**Uses:** Claude API (already integrated in Phase 2), job + resume data from storage
**Implements:** Content generation UI in popup, prompt engineering for quality output
**Addresses:** Competitive features from research (Teal/Huntr charge for this)

### Phase 6: Advanced Features & Polish
**Rationale:** After MVP validation, add power-user features and refine UX based on usage data.
**Delivers:** Advanced filters (remote, salary, location via AI extraction), application deadline tracking with notifications, interview stage tracking, debug panel showing persistent logs
**Uses:** chrome.notifications for deadlines, stored logs from Phase 0
**Implements:** Advanced filtering, notifications, debug UI
**Addresses:** Competitive features, pitfall #8 (debug visibility for production issues)

### Phase Ordering Rationale

- **Phase 0 before Phase 1**: Alarm verification, storage patterns, and CORS setup are prerequisites for API integration. Building features first then retrofitting pitfall prevention creates technical debt.
- **Phase 1 before Phase 2**: Job fetching must work reliably before scoring can happen. Batch processing architecture established in Phase 1 applies to Claude scoring in Phase 2.
- **Phase 2 before Phase 3**: Dashboard needs scored jobs to display. UI depends on stable storage schema and data flow from API orchestration.
- **Phase 3 before Phase 5**: AI content generation (cover letters) requires UI for users to trigger generation and view results. Dashboard infrastructure must exist first.
- **Batch processing throughout**: Service worker termination risk means ALL API-heavy operations (fetch, score, content generation) must chunk work and save progress.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Resume parsing)**: PDF.js and mammoth.js integration in Offscreen Document is complex; minimal examples exist. May need trial implementation to verify approach.
- **Phase 2 (Claude prompt engineering)**: AI scoring quality depends heavily on prompt design. Needs experimentation to balance accuracy vs token cost.
- **Phase 5 (Content generation)**: Cover letter quality is subjective; prompt engineering for personalized output needs user testing iterations.

**Phases with standard patterns (skip research-phase):**
- **Phase 0 (Manifest setup)**: Well-documented in official Chrome docs; standard extension initialization
- **Phase 1 (API integration)**: fetch() with retry logic is standard pattern; Adzuna/JSearch have published docs
- **Phase 3 (Dashboard UI)**: Card-based rendering with vanilla JS is straightforward; no novel patterns
- **Phase 4 (Export CSV)**: Standard data serialization; chrome.downloads API well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Chrome documentation for Manifest V3, service workers, chrome.storage, chrome.alarms. pdfjs-dist and mammoth.js versions verified from npm (published recently). |
| Features | MEDIUM-HIGH | Competitive analysis based on WebSearch of Teal, Huntr, Simplify, Eztrackr features. Table stakes features verified across multiple sources. AI scoring as differentiator is inference from competitor pricing (premium feature). |
| Architecture | HIGH | Official Chrome architecture docs, message passing, Offscreen API, service worker lifecycle. Community sources verified against official docs for consistency. |
| Pitfalls | HIGH | Official Chrome docs detail service worker termination, alarm limitations, storage quotas. Community discussions on GitHub and Chromium groups confirm real-world issues. |

**Overall confidence:** HIGH

The technical foundation (Manifest V3, Chrome APIs) is extensively documented with official sources. Feature research relies on competitive analysis which is solid but not definitive (user preferences may differ). All architectural patterns are verified with official Chrome documentation. Pitfalls are derived from both official limitations (documented) and community-reported production issues (verified across multiple independent sources).

### Gaps to Address

**Gap 1: Claude API prompt engineering for job scoring**
- **Issue**: Optimal prompt structure for 0-100 scoring is unknown; balance between accuracy and token cost unclear
- **Impact**: Core differentiator quality depends on this
- **Resolution**: Build prompt experimentation framework in Phase 2; test multiple prompt structures; collect user feedback on score accuracy; iterate based on data

**Gap 2: Offscreen Document lifecycle management**
- **Issue**: Best practices for creating/destroying Offscreen Documents unclear; potential memory leaks if not destroyed properly
- **Impact**: Resource consumption, extension performance
- **Resolution**: Implement strict create-parse-destroy pattern; add automated tests verifying cleanup; monitor chrome://extensions during testing for resource leaks

**Gap 3: API rate limit quotas in production**
- **Issue**: Theoretical calculations (1000 Adzuna calls/month, 150 JSearch calls/month, Claude pay-per-token) but unknown actual usage patterns
- **Impact**: Extension may exhaust quotas faster than expected; costs may exceed projections
- **Resolution**: Implement detailed usage tracking in Phase 1; add quota warnings at 80% threshold; provide user controls for fetch frequency (daily vs every 2-3 days); monitor actual usage in MVP beta

**Gap 4: Job data schema evolution**
- **Issue**: Initial schema may not capture all needed fields; changing schema post-launch risks data migration issues
- **Impact**: User data corruption, lost application tracking
- **Resolution**: Over-engineer schema in Phase 1 (include optional fields for future features); implement schema version field; build migration utility before first schema change needed

## Sources

### Primary (HIGH confidence)
- **Chrome Extension Manifest V3 Official Docs** — Architecture, service workers, APIs, migration guide, known issues
  - [Architecture Overview](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)
  - [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
  - [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
  - [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
  - [chrome.offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
  - [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
  - [Network Requests & CORS](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)

- **Library Documentation**
  - [pdfjs-dist npm](https://www.npmjs.com/package/pdfjs-dist) — v5.4.624, published 2026-02-01
  - [mammoth.js npm](https://www.npmjs.com/package/mammoth) — v1.8.0+, DOCX parser

### Secondary (MEDIUM confidence)
- **Competitor Feature Analysis** (WebSearch, Chrome Web Store)
  - Teal Job Search Chrome Extension features
  - Simplify Copilot autofill capabilities
  - Huntr application tracking features
  - Eztrackr CSV export functionality
  - Jobscan ATS resume scoring approach

- **Community Best Practices**
  - [Chrome Extension Best Practices GitHub](https://github.com/dipankar/chrome-extension-best-practices)
  - [Longer Service Worker Lifetimes (Chrome Blog)](https://developer.chrome.com/blog/longer-esw-lifetimes)
  - [Chrome Extension System Architecture Guide 2026 (Medium)](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)

### Tertiary (LOW confidence, needs validation)
- **Community Discussions** (Chromium Extensions Google Group, GitHub Issues)
  - [MV3 service workers and alarms reliability issues](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE)
  - [Alarm persistence problems](https://github.com/GoogleChrome/chrome-extensions-samples/issues/630)
  - [Debugging service worker console.log limitations](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3QAinUhCiPY)

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
