---
phase: 06-application-tracking
plan: 01
subsystem: ui
tags: [dashboard, filtering, ux, toast-notifications, job-cards]

# Dependency graph
requires:
  - phase: 05-dashboard-ui
    provides: Job card grid rendering and filter controls
provides:
  - Dismiss functionality with reversible undo toast
  - Hidden job filtering (dismissed + passed status)
  - Show hidden toggle in toolbar
  - Note indicator on cards with notes
  - storage.updateJob() convenience method
affects: [06-02, future application tracking features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Toast notification pattern with auto-dismiss and focus management
    - Job field update via storage.updateJob() convenience method

key-files:
  created: []
  modified:
    - src/storage.js
    - src/dashboard/filters.js
    - src/dashboard/job-card.js
    - src/popup.html
    - src/popup.css

key-decisions:
  - "Passed-status jobs auto-hidden from 'All' view but accessible via 'Passed' filter"
  - "Toast auto-dismisses after 5 seconds with pause-on-focus for accessibility"
  - "Note indicator shows pencil icon only when job.notes field exists"

patterns-established:
  - "storage.updateJob(jobId, updates) for partial field updates avoiding full read-modify-write"
  - "showUndoToast(message, callback) pattern with ARIA attributes and keyboard focus"
  - "showHidden state variable controls visibility of dismissed and passed jobs"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 6 Plan 1: Dismiss & Hidden Jobs Summary

**Dismiss-with-undo on job cards, hidden job filtering for dismissed/passed status, and note indicators**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T00:08:44Z
- **Completed:** 2026-02-07T00:11:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Dismiss button on every job card with reversible undo toast
- Hidden job filtering excludes dismissed and passed-status jobs from default view
- "Show hidden" toggle in toolbar reveals hidden jobs
- Note indicator (pencil icon) appears on cards with existing notes
- storage.updateJob() convenience method for partial field updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend storage, update filter logic, and add hidden jobs toggle** - `d5a041b` (feat)
2. **Task 2: Add dismiss button with undo toast and note indicator** - `302d977` (feat)

## Files Created/Modified
- `src/storage.js` - Added updateJob() convenience method for partial job field updates
- `src/dashboard/filters.js` - Added showHidden state, filter logic to exclude dismissed/passed jobs, setShowHidden/getShowHidden exports
- `src/dashboard/job-card.js` - Added dismiss button, note indicator, dismissJob() and showUndoToast() functions
- `src/popup.html` - Added "Show hidden" checkbox in toolbar-left
- `src/popup.css` - Added toast notification styles, filter toggle styles, dismiss button and note indicator styles

## Decisions Made
- **Passed status auto-hidden from default view:** When filter is "All", jobs with status "passed" are automatically hidden unless "Show hidden" is checked. This treats "Passed" like dismiss per user preference decision documented in 06-CONTEXT.md
- **"Show hidden" in toolbar:** Checkbox placed in toolbar-left next to job count for easy discoverability and access
- **Toast auto-dismiss with pause-on-focus:** Toast automatically dismisses after 5 seconds but pauses timer when focused (for keyboard users or slower readers), restarting on blur for accessibility
- **Note indicator minimal design:** Pencil character (&#9998;) only shown when job.notes exists, placed before "View Details" button in card footer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dismiss and hidden job filtering complete, ready for Plan 02 to add notes, application dates, and modal enhancements
- storage.updateJob() convenience method available for Plan 02 to use for notes and date updates
- Note indicator renders correctly, ready for Plan 02's note-editing functionality
- Toast pattern established and working, can be reused for other notifications

## Self-Check: PASSED

---
*Phase: 06-application-tracking*
*Completed: 2026-02-07*
