# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.
**Current focus:** Phase 7 - AI Content Generation (in progress)

## Current Position

Phase: 7 of 8 (AI Content Generation)
Plan: 1 of 3
Status: In progress
Last activity: 2026-02-07 — Completed 07-01-PLAN.md

Progress: [████████░░] 75.0%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 7 minutes
- Total execution time: 2.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 27min | 7min |
| 02 | 2 | 14min | 7min |
| 03 | 4 | 90min | 23min |
| 04 | 2 | 4min | 2min |
| 05 | 2 | 8min | 4min |
| 06 | 2 | 23min | 12min |
| 07 | 1 | 2min | 2min |

**Recent Trend:**
- Last 5 plans: 05-01 (3min), 05-02 (5min), 06-01 (2min), 06-02 (21min), 07-01 (2min)
- Trend: Phase 7 started. Content generation engine foundation complete with Claude API integration

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

**From 03-04 execution:**
- Time picker granularity: 15-minute intervals chosen for balance between user control and UI simplicity
- Independent save buttons: Search preferences have own "Save" button separate from fetch time changes (which auto-save)
- Fetch Now error handling: Tiered messaging distinguishes missing keys, invalid keys, and API failures for self-diagnosis
- Fetch history display: Last 5 entries shown in settings for troubleshooting without clutter
- Response structure alignment: handleFetchNow checks `!response.success || response.error` to match job-fetcher actual response format
- Error message pass-through: Background handlers return `{ success: false, error: error.message }` for specific UI feedback

**From 04-01 execution:**
- Model selection: Haiku 4.5 chosen for scoring ($1 input / $5 output per MTok) as cost-quality balance
- Scoring weighting: Skills-heavy approach (60% skills/tech stack, 15% experience, 10% title, 10% industry, 5% other)
- Job content extraction: extractJobCore strips benefits/perks/culture sections to reduce token costs, keeps requirements/responsibilities/skills
- Rate limiting: Sequential scoring with 500ms delay (conservative for Tier 1: 50 RPM limit)
- Error handling: Failed scoring returns null score object (not throw), job marked with score = -1 sentinel
- Structured outputs: output_config with json_schema guarantees valid JSON, eliminates parsing errors
- Prompt caching: Two system blocks with cache_control ephemeral (instructions + resume) for 90% cost reduction
- Checkpoint resilience: Save after each job scored for service worker restart recovery

**From 04-02 execution:**
- Scoring integration: Appended scoring stage after fetch pipeline completes (not inserted into checkpoint switch)
- Error isolation: Scoring failure does NOT crash fetch pipeline (try/catch with no re-throw, errors logged to historyEntry.errors)
- scoringResult forwarding: Added to all fetch return objects (runJobFetch, resumeJobFetch) for UI consumption
- Keep-alive separation: Manual scoring uses 'ai-scoring' tag, distinct from 'job-fetch' tag used by fetch pipeline
- Message handlers: SCORE_JOBS (manual scoring with keep-alive) and GET_SCORING_STATUS (lightweight storage query for UI stats)

**From 05-01 execution:**
- Popup width: Expanded from 400px to 780px to support multi-column grid layout (Chrome allows up to 800px)
- Grid layout: CSS Grid with repeat(auto-fill, minmax(230px, 1fr)) for automatic 1-3 column responsive behavior
- Score badge colors: High (80-100) green #81c784, medium (60-79) amber #ffd54f, low (0-59) red #e57373 with WCAG AA contrast
- Description preview: Smart extraction using keyword matching (require, must have, experience with) to surface key requirements
- Status dropdown: Immediate persistence to storage without full re-render for smooth UX
- Empty state context: Different messages for "no jobs" vs "no filtered jobs" with adaptive action buttons
- Toolbar visibility: Always visible even with zero jobs (initial implementation hid it, corrected for consistency)

**From 05-02 execution:**
- Modal implementation: Native <dialog> element with showModal() for proper modal behavior and accessibility
- Score breakdown: 2-column grid for 5 dimensions with colored progress bars matching score ranges
- Modal navigation: Arrow key support (Left/Right) in addition to Previous/Next buttons, tracks position in filtered array
- Tooltip positioning: Below badge with text wrapping (max-width 200px) to prevent off-screen overflow on all card positions
- Settings UX: Changed close button from X to back arrow (←) for clearer affordance of returning to dashboard
- Data management safety: Confirmation dialogs for all destructive actions (clear jobs, clear scores, reset settings)
- Dialog visibility fix: Moved display:flex to [open] selector to prevent modal showing on page load
- API key preservation: Reset settings restores search preferences but preserves configured API keys

**From 06-01 execution:**
- Passed status auto-hidden from default view: When filter is "All", jobs with status "passed" are automatically hidden unless "Show hidden" is checked (treats Passed like dismiss)
- storage.updateJob() convenience method: Partial field updates without full read-modify-write pattern, returns updated job or null if not found
- Toast notification pattern: Auto-dismisses after 5 seconds, pauses timer on focus/blur for accessibility, ARIA attributes for screen readers
- showHidden state: Module-level variable in filters.js controls visibility of dismissed and passed jobs across all filters
- Note indicator minimal design: Pencil character (&#9998;) only shown when job.notes field exists

**From 06-02 execution:**
- Notes auto-save debounce: 1-second delay balances UX responsiveness with storage write frequency, module-level pending state tracks saveTimeout/pendingJobId/pendingNotes
- Flush-on-close pattern: Modal close handler checks for pending debounced save and flushes immediately to prevent data loss
- Application date preservation: Date picker defaults to today only when no prior applicationDate exists; existing dates preserved when toggling status away from and back to Applied
- Auto-scroll on status change: Modal scrolls to bottom when status changes to Applied to ensure date picker visibility in smaller viewports
- Character counter warning: Shows warning color at <100 characters remaining (not at limit) for advance notice

**From 07-01 execution:**
- Content generation model: claude-haiku-4-5 chosen for cost-effectiveness ($1/$5 per MTok vs Sonnet $3/$15) while maintaining quality
- Prompt caching strategy: System prompt + resume cached with ephemeral cache_control for ~90% cost reduction on repeat generations
- Anti-cliche engineering: 14 banned phrases ("I am excited to apply", "leverage my skills", "proven track record") prevent robotic AI language
- Tone guidance: Professional-but-conversational with "write like emailing a colleague" instruction
- Token optimization: extractKeyRequirements caps job descriptions at 1000 chars, focusing on requirements/skills/responsibilities
- Different max_tokens: 800 for cover letters (3-4 paragraphs), 200 for recruiter messages (<100 words)
- Metadata tracking: Generated content saved with generatedAt, editedAt, isEdited to distinguish AI vs user edits
- Keep-alive tag: 'content-gen' tag distinct from 'ai-scoring' and 'job-fetch' for service worker lifecycle management
- Message handler: GENERATE_CONTENT validates job exists and API key configured before generation

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 2 - Resume Management:**
- ~~Offscreen Document lifecycle management for PDF.js and mammoth.js needs careful implementation to avoid memory leaks~~ RESOLVED: Libraries run in popup context where DOM and Web Workers are available, no offscreen document needed
- ~~mammoth.js must be loaded via script tag in popup.html before use~~ RESOLVED: Script tag added in 02-02, window.mammoth now available

**Phase 4 - AI Scoring:**
- ~~Claude prompt engineering for 0-100 scoring quality vs token cost balance needs experimentation~~ RESOLVED: Skills-heavy weighting (60%) implemented with Haiku 4.5, structured outputs eliminate variability
- API rate limit quotas in production usage patterns unknown (theoretical calculations only) - monitoring usage logs will inform real-world patterns

**Phase 3 - Job Fetching (COMPLETE):**
- ~~chrome.alarms reliability issues when device sleeps (best-effort, not guaranteed)~~ RESOLVED: Smart catch-up logic added (skips duplicate fetch if alarm >2hr late AND already fetched today)
- ~~Service worker termination mid-API-call requires batch processing with checkpoints~~ RESOLVED: Checkpoint recovery implemented in job-fetcher.js, verifies and recovers on startup
- ~~Response structure consistency between UI and background handlers~~ RESOLVED: Aligned handleFetchNow with job-fetcher response format, added error message pass-through

## Session Continuity

Last session: 2026-02-07T20:47:07 UTC
Stopped at: Completed 07-01-PLAN.md
Resume file: None

**Phase 7 Plan 01 complete (1/3 plans):** Content generation engine foundation implemented. Created content-generator.js module with generateContent() function that calls Claude Haiku 4.5 API using prompt caching (system + resume) for cost efficiency. Includes anti-cliche constraints (14 banned phrases) and professional-but-conversational tone guidance. Background service worker now handles GENERATE_CONTENT messages with job validation, API key check, and keep-alive wrapper. Generated content automatically saved to job records with metadata (generatedAt, isEdited, editedAt). clipboardWrite permission added to manifest for copy functionality. Ready for Plan 02 (UI integration with generate buttons, edit modals, copy buttons).
