---
phase: 03-job-fetching-scheduling
plan: 01
subsystem: api
tags: [adzuna, jsearch, rapidapi, fetch, storage, job-aggregation]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Storage abstraction, error handling with retryWithBackoff and ApiError
  - phase: 02-resume-management
    provides: Storage patterns for data persistence
provides:
  - Adzuna API client with fetchAdzunaJobs function
  - JSearch API client with fetchJSearchJobs function
  - Extended storage schema with SETTINGS, FETCH_HISTORY, ADAPTIVE_METRICS keys
  - Normalized job object schema used by both API clients
  - Storage helper methods for settings, fetch history, and adaptive metrics
affects: [03-02-job-fetcher-orchestrator, 03-03-scheduling, 04-ai-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalized job schema with source-prefixed jobIds (adzuna-*, jsearch-*)"
    - "API client pattern using storage.getSettings() for search params with fallbacks"
    - "Pagination handling unique to each API (Adzuna 50/page, JSearch ~10/page)"
    - "Storage helpers with defaults pattern (getSettings, getAdaptiveMetrics)"
    - "Fetch history with auto-trim to last 7 entries"

key-files:
  created:
    - src/api/adzuna.js
    - src/api/jsearch.js
  modified:
    - src/storage.js

key-decisions:
  - "Storage settings schema defined: fetchHour, fetchMinute, timezone, searchKeywords, location, salaryMin, datePosted, employmentType, remoteOnly"
  - "Fetch history tracks last 7 operations with date, status, counts, errors"
  - "Adaptive metrics structure for source quality tracking (recentWindow arrays per source)"
  - "Normalized job schema includes both common fields (title, company, location, salary, description, url, postedAt) and source-specific fields (contractType for Adzuna, employmentType/isRemote for JSearch)"
  - "API key validation throws ApiError with retryable: false before making requests"
  - "Query construction for JSearch combines keywords + location in single string"

patterns-established:
  - "API client exports single fetch function: fetchXJobs(count, searchParams)"
  - "Both clients follow same error handling pattern: validate keys, wrap fetch in retryWithBackoff, use createApiError"
  - "Both clients return normalized array of job objects sliced to exact count requested"
  - "Storage helpers merge partial updates for settings (same pattern as setApiKeys)"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 03 Plan 01: API Clients & Storage Extension Summary

**Two job API clients (Adzuna, JSearch) with normalized output schema plus extended storage for settings, fetch history, and adaptive metrics**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T20:20:04Z
- **Completed:** 2026-02-05T20:22:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Extended storage.js with SETTINGS, FETCH_HISTORY, ADAPTIVE_METRICS keys and 6 new helper methods
- Created Adzuna API client with pagination support (50 results per page)
- Created JSearch API client with RapidAPI authentication
- Both clients return jobs in identical normalized schema for consistent downstream processing
- Established API client pattern with storage integration and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend storage.js with Phase 3 storage keys and helpers** - `ffcc199` (feat)
2. **Task 2: Create Adzuna API client** - `2a4e1d4` (feat)
3. **Task 3: Create JSearch API client** - `fcf80e3` (feat)

## Files Created/Modified

**Created:**
- `src/api/adzuna.js` - Adzuna API client fetching jobs with app_id/app_key auth, pagination, and normalization
- `src/api/jsearch.js` - JSearch API client fetching jobs with RapidAPI headers, query string construction, and normalization

**Modified:**
- `src/storage.js` - Added FETCH_HISTORY and ADAPTIVE_METRICS keys, formalized SETTINGS schema, added 6 helper methods (getSettings, setSettings, getFetchHistory, addFetchHistoryEntry, getAdaptiveMetrics, setAdaptiveMetrics)

## Decisions Made

**Storage schema:**
- SETTINGS schema: fetchHour (0-23, default 6), fetchMinute (0-59, default 0), timezone (auto-detected via Intl.DateTimeFormat), searchKeywords (array), location (string), salaryMin (number|null), datePosted ('all'|'today'|'3days'|'week'|'month'), employmentType (FULLTIME|PARTTIME|CONTRACTOR), remoteOnly (boolean)
- FETCH_HISTORY: Array of fetch operation records, auto-trimmed to last 7 entries
- ADAPTIVE_METRICS: Per-source quality metrics with recentWindow arrays

**API client patterns:**
- Validate API keys before making requests, throw ApiError with retryable: false if missing
- Use storage.getSettings() for search parameter defaults with fallback to reasonable defaults ('software engineer' if no keywords)
- Return normalized job objects with consistent schema: jobId, source, title, company, location, salary, description, url, postedAt, fetchedAt, status, score, scoreReasoning
- jobId uses source prefix: 'adzuna-${id}' or 'jsearch-${id}' for uniqueness across sources
- Both clients use retryWithBackoff and createApiError for consistent error handling

**API-specific decisions:**
- Adzuna: Use query params (app_id, app_key), sort_by=date for freshest jobs, handle pagination (50/page max)
- JSearch: Use RapidAPI headers (X-RapidAPI-Key, X-RapidAPI-Host), combine keywords + location in query string, ~10 results per page
- JSearch location handling: Build query as "keywords in location" for single-string format
- Normalized salary structure: { min, max, predicted } for both sources despite different field names

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all API clients implemented as specified with proper error handling and normalization.

## User Setup Required

None - no external service configuration required. API keys are already configured via onboarding wizard from Phase 1.

## Next Phase Readiness

**Ready for Phase 3 Plan 02 (Job Fetcher Orchestrator):**
- API clients available for job fetching
- Storage schema ready for fetch history tracking
- Normalized job schema defined for consistent processing
- Settings storage available for user preferences

**Ready for Phase 4 (AI Scoring):**
- Normalized job objects include score and scoreReasoning fields (null until scored)
- Both clients return jobs ready for scoring pipeline

**No blockers or concerns.**

---
*Phase: 03-job-fetching-scheduling*
*Completed: 2026-02-05*

## Self-Check: PASSED
