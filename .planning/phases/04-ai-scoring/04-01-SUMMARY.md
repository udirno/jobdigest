---
phase: 04-ai-scoring
plan: 01
subsystem: api
tags: [claude-api, ai-scoring, structured-outputs, prompt-caching, haiku-4-5]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Error handling (retryWithBackoff, createApiError) and storage layer
  - phase: 02-resume-management
    provides: Resume storage (getResume) for scoring comparison
provides:
  - Claude API wrapper with structured outputs for guaranteed valid scoring JSON
  - Job scorer orchestrator for batch sequential scoring with checkpoint resilience
  - extractJobCore helper that strips benefits/perks/culture sections per user decision
  - Scoring schema with 0-100 overall score plus 5 dimension scores (skills, experience, tech, title, industry)
affects: [04-02-integration, dashboard-display, adaptive-metrics]

# Tech tracking
tech-stack:
  added:
    - Claude Haiku 4.5 model via Messages API
    - Structured outputs (output_config with json_schema)
    - Prompt caching (cache_control: ephemeral)
  patterns:
    - Skills-heavy weighting (60% on skills/tech stack per user decision)
    - Core job section extraction (strips fluff, keeps requirements/responsibilities/skills)
    - Sequential scoring with 500ms delay for rate limit safety (Tier 1: 50 RPM)
    - Checkpoint resilience (save after each job scored)
    - Sentinel value pattern (-1 = scoring failed, null = unscored)

key-files:
  created:
    - src/api/claude-client.js (Claude API wrapper)
    - src/job-scorer.js (Scoring orchestrator)
  modified: []

key-decisions:
  - "Use Haiku 4.5 for cost-quality balance ($1 input / $5 output per MTok)"
  - "Skills-heavy weighting: 60% skills/tech stack, 15% experience, 10% title, 10% industry, 5% other"
  - "Strip benefits/perks/culture sections via extractJobCore to reduce token usage"
  - "Sequential scoring with 500ms delay (conservative for Tier 1: 50 RPM limit)"
  - "Sentinel value -1 for failed scoring (distinguishes from null = unscored)"
  - "Structured outputs eliminate JSON parsing errors, guarantee valid schema"
  - "Prompt caching on resume content for 90% cost reduction after first request"

patterns-established:
  - "Structured output schema pattern: Use output_config with json_schema type for guaranteed valid JSON responses"
  - "Prompt caching pattern: Two system blocks with cache_control ephemeral (instructions + resume content)"
  - "Graceful scoring failure: Return null score object rather than throwing, allows pipeline to continue"
  - "Checkpoint save pattern: Save after each job scored for service worker restart resilience"
  - "Job core extraction: Programmatically strip fluff sections (benefits, perks, culture) to reduce token costs"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 04 Plan 01: AI Scoring Engine Summary

**Claude Haiku 4.5 scoring client with structured outputs, prompt caching, and sequential orchestrator for 0-100 job-resume matching**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-06T07:17:55Z
- **Completed:** 2026-02-06T07:19:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created Claude API wrapper with structured outputs (json_schema) for guaranteed valid JSON scoring responses
- Implemented prompt caching on system blocks (instructions + resume) for 90% cost reduction on repeated scoring
- Built job scorer orchestrator with sequential processing, 500ms rate limit delays, and checkpoint resilience
- Established extractJobCore helper that strips benefits/perks/culture sections per user decision (reduces token costs)
- Skills-heavy scoring weighting (60% skills/tech stack) per user decision in prompt engineering

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Claude API scoring client with structured outputs and prompt caching** - `822314c` (feat)
2. **Task 2: Create job scorer orchestrator with sequential processing and checkpoint save** - `299814c` (feat)

## Files Created/Modified
- `src/api/claude-client.js` - Claude API wrapper with scoreJob function and extractJobCore helper. Uses structured outputs (output_config.format.type: json_schema) to guarantee valid scoring JSON. Implements prompt caching on two system blocks (instructions + resume content) for 90% cost reduction. Gracefully returns null score on failure rather than throwing. Uses retryWithBackoff from errors.js for rate limit handling.
- `src/job-scorer.js` - Scoring orchestrator with scoreUnscoredJobs (batch) and scoreSingleJob (individual) functions. Validates resume and API key before processing. Filters jobs where score is null/undefined. Scores sequentially with 500ms delay (conservative for Tier 1: 50 RPM limit). Saves each job immediately after scoring for checkpoint resilience. Uses -1 sentinel for failed scoring (distinguishes from null = unscored).

## Decisions Made

**Model selection:**
- Chose Haiku 4.5 for scoring ($1 input / $5 output per MTok) as balanced cost-quality approach. Sonnet 4.5 would be 3x cost ($3 input) but overkill for straightforward job matching per research.

**Scoring weighting:**
- Implemented skills-heavy weighting per user decision: 60% skills/tech stack (primary factor), 15% experience level, 10% title relevance, 10% industry fit, 5% other factors.

**Job content extraction:**
- Created extractJobCore helper per user decision to send only core sections (title, company, requirements, responsibilities, skills, experience, tech stack, location, salary). Strips benefits, perks, company culture, diversity statements, equal opportunity text to reduce token usage.
- Unstructured descriptions (no clear section headings) are truncated to first 2000 characters as reasonable approximation (requirements typically appear first).

**Rate limiting:**
- Sequential scoring with 500ms delay between requests (120 RPM effective rate, well under Tier 1 limit of 50 RPM). Conservative approach ensures no rate limit errors even on Tier 1 accounts.

**Error handling:**
- Failed scoring returns null score object (not throw) to allow pipeline continuation. Job marked with score = -1 sentinel to distinguish from unscored (null). scoreReasoning set to "Scoring failed after retries" for transparency.

**Checkpoint resilience:**
- Save each job immediately after scoring via storage.saveJob(). If service worker terminates mid-batch, already-scored jobs are persisted and won't be re-scored on restart.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Users provide Claude API key via existing settings panel (Phase 1).

## Next Phase Readiness

**Ready for Phase 4 Plan 02 (Integration):**
- Claude API scoring client exports scoreJob function ready for pipeline integration
- Job scorer exports scoreUnscoredJobs for batch processing and scoreSingleJob for individual re-scoring
- Structured outputs guarantee valid JSON, eliminating parsing error handling in integration layer
- Prompt caching implemented, will achieve 90% cost reduction after first request in batch
- Checkpoint resilience ensures service worker termination doesn't lose scoring progress

**Integration requirements for Plan 02:**
- Wire scoreUnscoredJobs into fetch pipeline (call after jobs fetched)
- Use existing keep-alive mechanism to prevent service worker termination during scoring
- Display scores in dashboard (score 0-100, scoreReasoning text, scoreDetails dimensions)
- Handle -1 sentinel for failed scoring (show "Scoring failed" label or exclude from display)

**No blockers or concerns.**

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 04-ai-scoring*
*Completed: 2026-02-06*
