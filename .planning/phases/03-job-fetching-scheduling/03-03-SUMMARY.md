---
phase: 03-job-fetching-scheduling
plan: 03
subsystem: background
tags: [chrome-alarms, service-worker, message-passing, lifecycle]

# Dependency graph
requires:
  - phase: 03-01
    provides: Scheduler module with timezone-aware alarm creation
  - phase: 03-02
    provides: Job fetcher orchestrator with 4-stage pipeline and batch recovery
provides:
  - Alarm-triggered daily job fetching with smart catch-up after device sleep
  - Service worker startup recovery for in-progress fetches
  - Message handlers for manual fetch trigger and status queries
  - Background integration layer connecting fetch engine to Chrome lifecycle
affects: [03-04-settings-ui, 04-ai-scoring, popup-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Smart catch-up: skip fetch if alarm delayed >2hr AND already fetched today"
    - "Message-based API: TRIGGER_FETCH, GET_FETCH_STATUS, GET_NEXT_FETCH_TIME, UPDATE_FETCH_SCHEDULE"

key-files:
  created: []
  modified: [src/background.js]

key-decisions:
  - "Smart catch-up prevents duplicate fetches after device sleep by checking delay >120min AND dailyStats.jobsFetched > 0"
  - "GET_FETCH_STATUS returns rich state object with inProgress, currentStage, dailyStats, nextFetchTime, recentHistory for UI display"
  - "UPDATE_FETCH_SCHEDULE allows user to change fetch time dynamically, reschedules alarm immediately"

patterns-established:
  - "Message handlers in background.js follow async pattern with try/catch and error propagation"
  - "Alarm listener handles daily-job-fetch and keepalive-* alarms separately"
  - "Default settings initialized on first install: fetchHour=6, fetchMinute=0, timezone=local"

# Metrics
duration: 1min
completed: 2026-02-05
---

# Phase 03 Plan 03: Background Integration Summary

**Service worker wiring connects fetch pipeline to Chrome alarms with smart catch-up, startup recovery, and message-based manual trigger/status APIs**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-05T20:40:54Z
- **Completed:** 2026-02-05T20:42:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Daily alarm triggers full fetch pipeline automatically via runJobFetch()
- Smart catch-up logic handles missed alarms after device sleep (>2hr delay + already fetched today = skip)
- Service worker startup verifies alarm exists and recovers in-progress fetches via resumeJobFetch()
- Four new message handlers enable popup to trigger fetches, query status, get next fetch time, and update schedule
- Default settings initialized on first install (6:00 AM local time, empty search params)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update background.js imports and onInstalled handler** - `a7a76ff` (feat)

## Files Created/Modified
- `src/background.js` - Added scheduler/job-fetcher imports, updated onInstalled to call scheduleDailyFetch(), added default settings initialization, updated onStartup for alarm verification and batch recovery, added smart catch-up logic to alarm listener, added 4 new message handlers (TRIGGER_FETCH, GET_FETCH_STATUS, GET_NEXT_FETCH_TIME, UPDATE_FETCH_SCHEDULE)

## Decisions Made
- **Smart catch-up policy:** Skip fetch if alarm missed by >2 hours AND daily stats show jobs already fetched today (prevents duplicate fetches after device sleep)
- **GET_FETCH_STATUS structure:** Returns inProgress, currentStage, dailyStats (jobsFetched, remaining, date), nextFetchTime, and last 5 fetch history entries for rich UI state
- **Default fetch time:** 6:00 AM local time on first install, stored with timezone for cross-device consistency
- **Alarm verification on startup:** verifyAlarmExists() recreates alarm if Chrome cleared it, ensuring fetch reliability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 3 Plan 04 (Settings UI):**
- Message handlers (UPDATE_FETCH_SCHEDULE) ready for settings panel integration
- GET_FETCH_STATUS available for dashboard display
- TRIGGER_FETCH ready for manual fetch button

**Ready for Phase 4 (AI Scoring):**
- Fetch pipeline fully operational and can be extended with scoring after fetch
- Job storage structure already normalized for score/scoreReasoning fields

**No blockers:**
- Alarm fires and triggers fetch automatically
- Manual fetch available via message passing
- Service worker restart recovery operational

## Self-Check: PASSED

---
*Phase: 03-job-fetching-scheduling*
*Completed: 2026-02-05*
