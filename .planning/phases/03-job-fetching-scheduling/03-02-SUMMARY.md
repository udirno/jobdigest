---
phase: 03-job-fetching-scheduling
plan: 02
subsystem: job-fetching
tags: [scheduler, chrome-alarms, adaptive-distribution, job-fetcher, checkpoint-recovery, keep-alive, service-worker]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Storage abstraction, keep-alive utilities, error handling with retryWithBackoff
  - phase: 03-01-api-clients
    provides: API clients (fetchAdzunaJobs, fetchJSearchJobs), storage schema with settings/fetch-history/adaptive-metrics
provides:
  - Scheduler module creating timezone-aware daily alarms
  - Adaptive distribution module calculating quality-based API allocation
  - Job-fetcher orchestrator coordinating 4-stage bootstrap pipeline with checkpoint recovery
  - Complete fetch engine ready for background.js integration
affects: [03-03-background-integration, 04-ai-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fall-through switch for checkpoint-based stage recovery"
    - "Keep-alive wrapping for long service worker operations"
    - "Immediate job persistence after each API call (not batched at end)"
    - "Deduplication filter against existing stored jobs"
    - "Quality metric: 70% avgScore + 30% high-value percentage"
    - "Graceful degradation to 25/25 split when scores unavailable"

key-files:
  created:
    - src/scheduler.js
    - src/adaptive-distribution.js
    - src/job-fetcher.js
  modified: []

key-decisions:
  - "Daily alarm uses chrome.alarms.create with when + periodInMinutes: 1440 for timezone-aware scheduling"
  - "verifyAlarmExists recreates missing alarm automatically (resilience against Chrome alarm persistence issues)"
  - "Hybrid quality metric: 70% average score + 30% high-value job percentage for balanced allocation"
  - "Minimum allocation of 10 jobs per API to never starve a source completely"
  - "7-day rolling window for adaptive metrics (slice(-7) on recentWindow arrays)"
  - "4-stage checkpoint pipeline: bootstrap-adzuna → bootstrap-jsearch → adaptive-allocation → remaining-fetch"
  - "Jobs saved immediately after each API call for checkpoint resilience (not batched until end)"
  - "Individual API failures caught separately to preserve partial results"
  - "Bootstrap count adjusted if daily cap leaves less than 50 jobs remaining"

patterns-established:
  - "Scheduler pattern: Load settings, calculate next local time, clear old alarm, create new with when + period"
  - "Checkpoint recovery: Fall-through switch starting from progress.stage, loading progress.fetchedJobs"
  - "Adaptive allocation: Default to even split when no scores, proportional when scores available, enforce minimum per source"
  - "Fetch pipeline: Check cap → set progress → wrap in keep-alive → execute stages → update stats → clear progress"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 03 Plan 02: Job Fetcher Orchestrator Summary

**Complete fetch pipeline with timezone-aware daily scheduling, quality-based adaptive API allocation (defaults to 25/25 until Phase 4 scoring), and 4-stage checkpoint recovery for service worker resilience**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T20:27:48Z
- **Completed:** 2026-02-05T20:29:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Scheduler creates chrome.alarms at user's preferred time in local timezone with automatic recreation if alarm disappears
- Adaptive distribution calculates quality-based allocation with graceful degradation (25/25 when no scores available)
- Job-fetcher orchestrates complete bootstrap flow: 25 Adzuna + 25 JSearch, then allocate remaining 50 based on quality metrics
- Checkpoint-based recovery allows resuming from any of 4 stages after service worker restart
- Jobs saved immediately after each API call, deduplicated against existing storage, with per-API error isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scheduler and adaptive distribution modules** - `130b5dc` (feat)
2. **Task 2: Create job-fetcher orchestrator with checkpoint recovery** - `fb48876` (feat)

## Files Created/Modified

**Created:**
- `src/scheduler.js` - Timezone-aware daily alarm scheduling with verifyAlarmExists resilience and getNextFetchTime query
- `src/adaptive-distribution.js` - Quality-based API allocation using hybrid metric (70% avgScore + 30% high-value %), defaults to 25/25 when no scores, enforces 10-job minimum per source
- `src/job-fetcher.js` - Main fetch orchestrator with runJobFetch entry point, resumeJobFetch recovery, executeFetchPipeline 4-stage switch, keep-alive wrapping, deduplication, and daily cap enforcement

## Decisions Made

**Scheduler design:**
- `scheduleDailyFetch` calculates next occurrence in user's local timezone (not UTC) - if preferred time already passed today, schedules for tomorrow
- `chrome.alarms.create` uses `when` timestamp (not `delayInMinutes`) for precise timezone handling
- `periodInMinutes: 1440` (24 hours) ensures alarm repeats daily
- `verifyAlarmExists` recreates alarm if missing - handles Chrome's known alarm persistence issues after browser restart

**Adaptive allocation strategy:**
- Default to 25/25 split when bootstrap jobs lack scores (Phase 4 not yet integrated)
- When scores available: hybrid quality = (avgScore × 0.7) + ((highValueCount / jobCount) × 100 × 0.3)
- Rationale: 70% weight on average quality, 30% on percentage of exceptional jobs (>=80 score)
- Enforce minimum 10 jobs per API - prevents completely starving a source due to temporary low quality
- 7-day rolling window for metrics history (balances recency vs stability)

**Checkpoint recovery architecture:**
- 4 stages: bootstrap-adzuna, bootstrap-jsearch, adaptive-allocation, remaining-fetch
- Fall-through switch allows resuming from any stage (load savedJobs from progress.fetchedJobs)
- Batch progress saved BEFORE each stage starts (checkpoint for resume)
- Jobs saved IMMEDIATELY after each API fetch (not accumulated and saved at end)
- Deduplication against existing stored jobs prevents duplicates across service worker restarts
- Individual try/catch per API prevents one failure from blocking the other

**Daily cap handling:**
- Check cap before starting fetch, calculate remaining = 100 - dailyStats.jobsFetched
- Adjust bootstrap counts if remaining < 50 (each API gets Math.floor(remaining / 2))
- Increment daily count AFTER pipeline completes (not during)
- History entry tracks partial results if fetch fails mid-pipeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all modules implemented as specified with proper error handling, checkpoint recovery, and graceful degradation.

## User Setup Required

None - no external service configuration required. Scheduler uses existing settings from storage.getSettings().

## Next Phase Readiness

**Ready for Phase 3 Plan 03 (Background Integration):**
- Scheduler ready to create daily alarms on extension install/startup
- Job-fetcher provides runJobFetch for alarm handler and resumeJobFetch for service worker startup recovery
- All three modules import correctly from Phase 1 (storage, keep-alive, errors) and Plan 01 (API clients)
- Fetch pipeline enforces daily cap and tracks history

**Ready for Phase 4 (AI Scoring):**
- Adaptive allocation already checks for job.score field - will automatically use proportional allocation when scores present
- updateAdaptiveMetrics tracks avgScore and highValueCount - will populate when scoring added
- Current graceful degradation to 25/25 ensures system works before scoring integrated

**No blockers or concerns.**

---
*Phase: 03-job-fetching-scheduling*
*Completed: 2026-02-05*

## Self-Check: PASSED
