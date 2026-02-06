# Phase 6: Application Tracking - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Manage job application pipeline with status tracking, notes, dates, and dismiss functionality. Users track their progress through the application process for jobs discovered in Phase 3-5. New tracking features (e.g., interview scheduling, offer management) belong in future phases.

</domain>

<decisions>
## Implementation Decisions

### Status workflow & transitions
- Users can skip states (New → Applied directly without Contacted) - real applications don't always follow linear paths
- "Passed" status is a final state - auto-hides jobs from main view like dismiss (accessible via filter)
- Status transitions allowed in any direction (Claude's discretion on validation/warnings)
- Application date handling when marking as Applied (Claude's discretion on required vs optional)

### Notes & date capture
- Notes have 2000 character limit to prevent storage bloat and encourage concise tracking
- Notes auto-save with debounced persistence (~1 second after user stops typing) - no explicit Save button
- Application dates captured via date picker defaulting to today when user marks job as Applied
- Text formatting for notes (Claude's discretion: plain text vs basic formatting based on complexity tradeoff)

### Dismiss/hide behavior
- Dismiss reversibility (Claude's discretion: permanent vs archive view)
- Dismiss action location in UI (Claude's discretion: card, modal, or both)
- Dismiss confirmation pattern (Claude's discretion: immediate, undo toast, or confirmation dialog)
- Dismissed jobs and daily cap interaction (Claude's discretion: count toward 100/day or exclude)

### Claude's Discretion
- Whether status changes backward should show warnings
- Whether to require application date when marking as Applied
- Notes text formatting (plain vs markdown vs rich text)
- Dismiss reversibility and UI placement
- How cards indicate notes presence (icon, preview, or none)
- Whether application dates appear on cards or modal only
- Where notes editing appears (card, modal, or both)
- Whether status dropdown stays on cards or moves to modal

</decisions>

<specifics>
## Specific Ideas

- Auto-save for notes (don't make users click Save)
- Date picker should default to today but allow backdating if needed
- "Passed" should work like dismiss - clean up the active view
- 2000 character limit on notes keeps storage under control

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-application-tracking*
*Context gathered: 2026-02-06*
