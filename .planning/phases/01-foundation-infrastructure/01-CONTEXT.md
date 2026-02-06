# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Chrome extension technical foundation: Manifest V3 scaffolding, service worker lifecycle management, storage abstraction patterns, error handling infrastructure, CORS permissions, and onboarding flow for API key configuration. This phase creates the reliable base that all subsequent phases (resume parsing, job fetching, AI scoring) depend on.

</domain>

<decisions>
## Implementation Decisions

### API Key Validation
- Validate API keys when user clicks Save/Continue button (not immediately on paste)
- If validation fails: save the invalid key anyway, show error on first actual API call (don't block onboarding)
- Provide individual "Test Connection" button for each API (Claude, Adzuna, JSearch)
- Validation response shows simple success/failure only (green check or red X, no quota/account details)

### Storage Schema Design
- Job data structured as object map indexed by job ID: `{jobId1: {job}, jobId2: {job}}` for fast lookup
- No schema version field initially — add versioning only when migration becomes necessary
- Metadata storage strategy (resume, settings, API keys): Claude's discretion
- Generated content storage with jobs (cover letters, messages): Claude's discretion

### Claude's Discretion
- Onboarding flow UI/UX (multi-step wizard vs single form)
- Error messaging detail level and retry suggestions
- How to structure metadata (resume, settings, API keys) in chrome.storage
- How to store generated content (embedded in job object vs separate storage)
- Service worker keep-alive implementation patterns
- Storage abstraction layer design
- CORS permission manifest configuration

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Chrome extension Manifest V3 patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-02-05*
