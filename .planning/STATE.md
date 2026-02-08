# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.
**Current focus:** Phase 8 - Export & Polish (complete) - ALL PHASES COMPLETE

## Current Position

Phase: 8 of 8 (Export & Polish)
Plan: 2 of 2
Status: Phase complete
Last activity: 2026-02-08 — Completed 08-02-PLAN.md

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 6 minutes
- Total execution time: 2.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 27min | 7min |
| 02 | 2 | 14min | 7min |
| 03 | 4 | 90min | 23min |
| 04 | 2 | 4min | 2min |
| 05 | 2 | 8min | 4min |
| 06 | 2 | 23min | 12min |
| 07 | 2 | 10min | 5min |
| 08 | 2 | 5min | 2.5min |

**Recent Trend:**
- Last 5 plans: 06-02 (21min), 07-01 (2min), 07-02 (8min), 08-01 (2min), 08-02 (3min)
- Trend: Phase 8 complete. All 20 plans executed successfully with 100% completion rate

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

**From 07-02 execution:**
- Expandable sections: One section per content type (cover letter, recruiter message) chosen over tabbed interface for better discoverability at a glance
- Separate generate buttons: Each content type has dedicated button instead of combined dropdown for clearer affordance and simpler one-click interaction
- Per-job custom instructions: Text input in modal (not global settings) allows job-specific emphasis without new settings section
- Auto-expand after generation: Section automatically expands when generation completes for immediate content visibility
- Content auto-save: 1-second debounced auto-save for edited content (same pattern as notes) with separate state tracking and flush-on-close
- Regenerate confirmation: Confirm dialog before regenerating edited content to prevent accidental overwrites of user customizations
- Relative time metadata: Shows "Generated 5 min ago" or "Edited today" instead of ISO timestamps for user-friendly display
- Auto-resize textareas: Dynamically adjust height based on scrollHeight so all content visible without manual resize or scrollbars

**From 08-01 execution:**
- CSV export: Explicit field whitelist (jobId, title, company, location, url, source, postedAt, fetchedAt, score, scoreReasoning, status, applicationDate, notes, dismissed, coverLetter, coverLetterGenerated, coverLetterEdited, recruiterMessage, recruiterMessageGenerated, recruiterMessageEdited) prevents sensitive data leaks
- CSV injection prevention: Fields starting with =, +, -, @ prefixed with single quote per OWASP guidance to prevent formula injection in Excel
- UTF-8 BOM: \uFEFF prepended for Excel compatibility on Windows
- Blob URL lifecycle: Create blob → trigger download → cleanup after 1s on success or immediately on error
- Export button feedback: Shows "Exporting..." during operation, "Exported!" for 1.5s on success, "No jobs to export" or "Export failed" for 2s on error
- RFC 4180 compliance: Proper escaping of commas, quotes, newlines, carriage returns in CSV fields

**From 08-02 execution:**
- Conservative 10MB quota: Used for early warnings even with unlimitedStorage permission (better to warn at 8MB than risk data loss)
- Storage monitoring thresholds: 80% warning (amber) provides buffer time, 95% critical (red) prevents imminent data loss
- Dual display approach: Warning banner for critical situations (80%+) + always-on settings display for continuous awareness
- Export Jobs button in banner: Provides immediate CSV export action without navigation, reducing friction for remediation
- Graceful error handling: getBytesInUse() failures return safe defaults (0 bytes, no warnings) with console.error logging
- Progress bar color coding: Green (<60%), amber (60-80%), red (>80%) for instant visual feedback on storage health

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

Last session: 2026-02-08T01:37:11 UTC
Stopped at: Completed Phase 8
Resume file: None

**Phase 8 complete (2/2 plans):** Plan 01 added CSV export with RFC 4180 compliance and injection prevention. Plan 02 added storage usage monitoring with chrome.storage.local.getBytesInUse(). Warning banner appears at 80% capacity (amber) and 95% critical (red) with Export Jobs and Manage Storage action buttons. Settings panel displays storage usage progress bar with color-coded visualization (green/amber/red) at all times. Graceful error handling ensures monitoring never crashes the app. All 8 phases complete (20/20 plans executed). Extension is feature-complete and production-ready.
