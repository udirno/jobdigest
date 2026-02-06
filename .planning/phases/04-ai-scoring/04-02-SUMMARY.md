---
phase: 04-ai-scoring
plan: 02
subsystem: api
tags: [scoring-integration, job-fetcher, background-messages, keep-alive]

# Dependency graph
requires:
  - phase: 04-ai-scoring
    plan: 01
    provides: Claude scoring client and job scorer orchestrator
  - phase: 03-job-fetching
    provides: Job fetcher pipeline (runJobFetch, executeFetchPipeline) with checkpoint stages
  - phase: 01-foundation
    provides: Background message handlers and keep-alive mechanism
provides:
  - Automatic AI scoring integrated into fetch pipeline (runs after fetch completes)
  - SCORE_JOBS message handler for manual scoring trigger with keep-alive protection
  - GET_SCORING_STATUS message handler for UI statistics (scored/unscored/failed counts)
  - scoringResult in fetch pipeline return objects for UI consumption
affects: [05-dashboard, settings-ui, adaptive-metrics-v2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Scoring failure isolation via try/catch with no re-throw (fetch succeeds even if scoring fails)
    - scoringResult forwarding in fetch return objects for UI consumption
    - Separate keep-alive tags for different operations (job-fetch vs ai-scoring)
    - Scoring runs inside executeFetchPipeline (covered by existing keep-alive wrapper)

key-files:
  created: []
  modified:
    - src/job-fetcher.js (added scoring stage to pipeline)
    - src/background.js (added SCORE_JOBS and GET_SCORING_STATUS handlers)

key-decisions:
  - "Scoring appended after fetch stages (not inserted into checkpoint switch)"
  - "Scoring failure isolated -- does NOT crash fetch pipeline (try/catch with no re-throw)"
  - "Manual scoring uses separate 'ai-scoring' keep-alive tag (distinct from 'job-fetch')"
  - "GET_SCORING_STATUS is lightweight storage query (no API calls, no keep-alive needed)"

patterns-established:
  - "Pipeline extension pattern: Append new stages after checkpoint switch completes"
  - "Error isolation pattern: try/catch that catches, logs, records error but does NOT re-throw"
  - "Multi-operation keep-alive: Use separate tags for different long-running operations"
  - "Statistics handler pattern: Lightweight storage queries for UI state (no keep-alive needed)"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 04 Plan 02: Scoring Pipeline Integration Summary

**AI scoring automatically runs after job fetch with isolated error handling and manual trigger via background messages**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-06T07:22:28Z
- **Completed:** 2026-02-06T07:24:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Integrated AI scoring into fetch pipeline with automatic execution after fetch stages complete
- Scoring failures isolated -- they don't crash the fetch pipeline (try/catch with no re-throw)
- Added SCORE_JOBS message handler for manual scoring with keep-alive protection
- Added GET_SCORING_STATUS message handler for UI statistics (scored/unscored/failed/total/averageScore)
- scoringResult included in all fetch return objects for UI consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scoring stage to job-fetcher pipeline** - `c48a5ce` (feat)
2. **Task 2: Add scoring message handlers to background service worker** - `2033e3f` (feat)

## Files Created/Modified
- `src/job-fetcher.js` - Imported scoreUnscoredJobs from job-scorer.js. Added scoring stage after executeFetchPipeline completes daily stats update and adaptive metrics. Scoring wrapped in try/catch that catches errors, logs them, pushes to historyEntry.errors, and does NOT re-throw (fetch success independent of scoring success). Added scoringResult to all return objects in runJobFetch and resumeJobFetch (both success and error cases). Scoring automatically covered by existing keep-alive (runs inside executeFetchPipeline which is wrapped by withKeepAlive).
- `src/background.js` - Imported scoreUnscoredJobs from job-scorer.js. Added SCORE_JOBS handler that triggers manual scoring wrapped in keepAlive.withKeepAlive('ai-scoring', ...) for service worker protection. Added GET_SCORING_STATUS handler that queries storage for job counts (scored/unscored/failed/total) and calculates averageScore. Both handlers follow existing message handler conventions (success/error patterns).

## Decisions Made

**Scoring stage placement:**
- Scoring appended after the 4-stage checkpoint switch (bootstrap-adzuna → bootstrap-jsearch → adaptive-allocation → remaining-fetch) completes, not inserted into the switch. This keeps checkpoint stages focused on fetching and makes scoring a post-fetch operation.

**Error isolation strategy:**
- Scoring failure does NOT crash the fetch pipeline. Scoring wrapped in try/catch that catches errors, logs them, pushes to historyEntry.errors, but does NOT re-throw. This allows partial results: fetch succeeds even if scoring fails. Critical for resilience.

**Keep-alive separation:**
- Manual scoring (SCORE_JOBS handler) uses separate 'ai-scoring' keep-alive tag, distinct from the 'job-fetch' tag used by the fetch pipeline. This provides clarity for debugging and allows separate lifecycle tracking.

**Statistics query efficiency:**
- GET_SCORING_STATUS is a lightweight storage query (no API calls). It reads all jobs from storage and calculates counts. No keep-alive wrapper needed because it's a synchronous operation that completes in milliseconds.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 5 (Dashboard) and Settings UI:**
- GET_SCORING_STATUS provides scored/unscored/failed/total/averageScore for UI display
- scoringResult in fetch return objects provides scoring feedback after fetch completes
- SCORE_JOBS allows manual re-scoring (e.g., after resume upload or user request)
- Jobs in storage now have score (0-100 or -1 for failed), scoreReasoning, scoredAt, scoreDetails
- Dashboard can filter/sort by score, display reasoning, show dimension breakdowns

**Integration points for Dashboard:**
- Query jobs with `storage.getJobs()` and filter/sort by score field
- Display scoreReasoning as tooltip or detail panel for job matching transparency
- Show scoreDetails dimensions (skills_match, experience_level, tech_stack_alignment, title_relevance, industry_fit) as visual breakdown
- Handle -1 sentinel (failed scoring) by showing "Scoring failed" label or excluding from display

**Integration points for Settings:**
- Add "Re-score All Jobs" button that calls chrome.runtime.sendMessage({ type: 'SCORE_JOBS' })
- Display scoring status with GET_SCORING_STATUS (e.g., "85 scored, 5 unscored, 2 failed")
- Trigger re-scoring after resume upload (new resume should re-score all jobs)

**No blockers or concerns.**

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 04-ai-scoring*
*Completed: 2026-02-06*
