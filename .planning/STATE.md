# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.
**Current focus:** Phase 3 - Job Fetching & Scheduling (next up)

## Current Position

Phase: 3 of 8 (Job Fetching & Scheduling)
Plan: 3 of 3
Status: Phase complete
Last activity: 2026-02-05 — Completed 03-03-PLAN.md (Background integration)

Progress: [█████████░] 90.0%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 4 minutes
- Total execution time: 0.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 27min | 7min |
| 02 | 2 | 14min | 7min |
| 03 | 3 | 5min | 2min |

**Recent Trend:**
- Last 5 plans: 02-02 (13min), 03-01 (2min), 03-02 (2min), 03-03 (1min)
- Trend: Phase 3 complete with exceptional 2min average, backend integration modules extremely efficient

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Foundation: Vanilla JavaScript chosen to reduce bundle size and simplify extension architecture
- Foundation: Manifest V3 required by Chrome, future-proof
- Foundation: chrome.storage.local only for zero hosting costs
- Foundation: User provides own API keys to eliminate service maintenance costs
- Foundation: Adzuna + JSearch APIs provide sufficient free tier volume (1150 calls/month)
- Foundation: Claude API chosen for superior reasoning quality in job-resume matching
- Foundation: 100 jobs/day cap prevents runaway Claude API costs

**From 01-01 execution:**
- Storage: Job data structured as object map indexed by jobId for fast lookup
- Storage: Daily stats auto-reset when date changes to support 100 jobs/day cap
- Storage: API keys support partial updates with deep merge for adzuna object
- Error handling: Retry logic skips 4xx errors (except 429) to avoid wasting retries on client errors
- Error handling: Batch progress tracking added for service worker restart recovery

**From 01-02 execution:**
- Keep-alive: Dual mechanism using chrome.alarms every 25s + setTimeout ping every 20s for robust coverage
- Service worker: Daily alarm period set to 1440 minutes (24 hours) with 6 AM PST scheduling deferred to Phase 3
- API testing: Minimal requests used to validate credentials (Claude: 1 token, Adzuna: 1 result, JSearch: 1 page)
- State recovery: Batch progress recovery logs on startup but actual recovery logic deferred to Phase 3

**From 01-03 execution:**
- Onboarding wizard: 3-step flow (Claude → Adzuna → JSearch) with skip and continue options
- Key masking: Show first 8 + ... + last 4 characters for security while allowing verification
- Save on Continue: Keys saved regardless of validation status to not block onboarding flow
- Settings panel: Slide-in overlay from right with smooth CSS transition

**From 01-04 execution:**
- Integration testing: Automated checks validate manifest, storage, and error exports before human testing
- Acceptance testing: 5 test scenarios confirm complete user journey from first launch through settings
- Quality validation: All tests passed without requiring fixes, confirming Phase 1 implementation quality

**From 02-01 execution:**
- PDF.js worker path: chrome.runtime.getURL used for reliable extension context resolution instead of relative paths
- mammoth.js loading: Script tag approach exposing window.mammoth rather than ES module import for UMD compatibility
- File validation: 5MB limit prevents memory issues, most resumes 100-500KB so provides comfortable headroom
- Text validation: Minimum 50 characters required to catch corrupted files or scanned images without OCR

**From 02-02 execution:**
- Resume UI positioning: Resume section placed above API Keys in settings for user-facing feature prominence
- Hidden class CSS scoping: Scoped to :not(.settings-panel) to prevent interference with slide animation
- Relative date display: Show "today/yesterday/N days ago" instead of ISO timestamps for better UX
- File input reset: Reset after upload allows re-uploading same file if needed

**From 03-01 execution:**
- Storage schema: SETTINGS formalized with fetchHour, fetchMinute, timezone, searchKeywords, location, salaryMin, datePosted, employmentType, remoteOnly
- Fetch history: Last 7 entries tracked with date, status, counts, errors; auto-trimmed on each addition
- Adaptive metrics: Per-source quality tracking with recentWindow arrays
- Normalized job schema: jobId (source-prefixed), source, title, company, location, salary, description, url, postedAt, fetchedAt, status, score, scoreReasoning
- API client pattern: Validate keys first, use storage.getSettings() for defaults, wrap fetch in retryWithBackoff
- JSearch query construction: Combines keywords + location in single string ("software engineer in San Francisco")

**From 03-02 execution:**
- Scheduler: chrome.alarms with when + periodInMinutes: 1440 for timezone-aware daily scheduling
- Alarm resilience: verifyAlarmExists recreates missing alarms automatically (handles Chrome persistence issues)
- Adaptive allocation: Hybrid quality metric (70% avgScore + 30% high-value percentage) with 25/25 default when no scores
- Minimum allocation: 10 jobs per API enforced to never starve a source completely
- Checkpoint recovery: 4-stage fall-through switch (bootstrap-adzuna → bootstrap-jsearch → adaptive-allocation → remaining-fetch)
- Job persistence: Immediate save after each API call (not batched at end) for checkpoint resilience
- Error isolation: Individual try/catch per API preserves partial results if one source fails
- Daily cap handling: Bootstrap counts adjusted if remaining < 50, daily stats incremented after pipeline completes

**From 03-03 execution:**
- Smart catch-up policy: Skip fetch if alarm missed by >2 hours AND daily stats show jobs already fetched today (prevents duplicate fetches after device sleep)
- GET_FETCH_STATUS structure: Returns inProgress, currentStage, dailyStats (jobsFetched, remaining, date), nextFetchTime, and last 5 fetch history entries for rich UI state
- Default fetch time: 6:00 AM local time on first install, stored with timezone for cross-device consistency
- Alarm verification on startup: verifyAlarmExists() recreates alarm if Chrome cleared it, ensuring fetch reliability
- Message-based API: TRIGGER_FETCH, GET_FETCH_STATUS, GET_NEXT_FETCH_TIME, UPDATE_FETCH_SCHEDULE handlers enable popup/settings UI integration

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 2 - Resume Management:**
- ~~Offscreen Document lifecycle management for PDF.js and mammoth.js needs careful implementation to avoid memory leaks~~ RESOLVED: Libraries run in popup context where DOM and Web Workers are available, no offscreen document needed
- ~~mammoth.js must be loaded via script tag in popup.html before use~~ RESOLVED: Script tag added in 02-02, window.mammoth now available

**Phase 4 - AI Scoring:**
- Claude prompt engineering for 0-100 scoring quality vs token cost balance needs experimentation
- API rate limit quotas in production usage patterns unknown (theoretical calculations only)

**Phase 3 - Job Fetching:**
- ~~chrome.alarms reliability issues when device sleeps (best-effort, not guaranteed)~~ MITIGATED: Smart catch-up logic added (skips duplicate fetch if alarm >2hr late AND already fetched today)
- ~~Service worker termination mid-API-call requires batch processing with checkpoints~~ RESOLVED: Checkpoint recovery implemented in job-fetcher.js, verifies and recovers on startup

## Session Continuity

Last session: 2026-02-05T20:42:07 UTC
Stopped at: Completed 03-03-PLAN.md (Background integration)
Resume file: None

**Phase 3 complete (3/3 plans):** Job fetching fully operational. Daily alarm triggers fetch pipeline automatically. Smart catch-up handles device sleep scenarios. Service worker startup recovers in-progress fetches. Message handlers (TRIGGER_FETCH, GET_FETCH_STATUS, GET_NEXT_FETCH_TIME, UPDATE_FETCH_SCHEDULE) ready for UI integration. Ready for Phase 4 (AI Scoring).
