---
phase: 07-ai-content-generation
plan: 01
subsystem: ai
tags: [claude-api, haiku-4-5, prompt-engineering, content-generation, cover-letters]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: storage abstraction, error handling, retry logic, keep-alive mechanism
  - phase: 02-resume-management
    provides: resume storage and retrieval
provides:
  - Content generation engine for personalized cover letters and recruiter messages
  - Claude API integration with prompt caching for cost efficiency
  - Anti-cliche prompt engineering with professional-but-conversational tone
  - Generated content storage with metadata tracking (generatedAt, isEdited)
  - GENERATE_CONTENT message handler in background service worker
affects: [07-02, 07-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prompt caching with ephemeral cache_control for system prompt + resume"
    - "Negative constraints in prompts (banned phrases) to prevent AI cliches"
    - "Token cost optimization via extractKeyRequirements (cap at 1000 chars)"
    - "Metadata tracking for generated vs user-edited content"

key-files:
  created:
    - src/content-generator.js
  modified:
    - src/background.js
    - manifest.json

key-decisions:
  - "Used claude-haiku-4-5 model for cost-effectiveness ($1/$5 per MTok vs Sonnet $3/$15)"
  - "Prompt caching for system prompt + resume reduces costs by ~90% on repeat generations"
  - "Anti-cliche constraints include 14 banned phrases to prevent robotic AI language"
  - "Professional-but-conversational tone guidance: 'write like emailing a colleague'"
  - "Different max_tokens: 800 for cover letters (3-4 paragraphs), 200 for recruiter messages (<100 words)"
  - "extractKeyRequirements caps job description at 1000 chars to control token costs"
  - "Generated content saved with metadata: generatedAt, editedAt, isEdited for tracking AI vs human edits"
  - "clipboardWrite permission added for Plan 02's copy-to-clipboard functionality"

patterns-established:
  - "Content generation uses separate API calls from scoring (different prompt structure, no structured outputs)"
  - "Keep-alive tag 'content-gen' is distinct from 'ai-scoring' and 'job-fetch' tags"
  - "Message handler validates job exists and API key configured before generation"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 07 Plan 01: Content Generation Engine Summary

**Claude Haiku 4.5 content generator with prompt-cached system instructions, anti-cliche constraints, and background message handler for cover letters and recruiter messages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T20:45:19Z
- **Completed:** 2026-02-07T20:47:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Content generation module created with Claude API integration reusing existing error handling and retry patterns
- Prompt engineering with negative examples (14 banned phrases) and explicit tone/structure requirements
- Generated content automatically saved to job records with tracking metadata (generatedAt, isEdited, editedAt)
- Background service worker routes GENERATE_CONTENT messages with keep-alive protection
- clipboardWrite permission added to manifest for future copy functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Create content-generator.js module with prompt engineering** - `fc462bd` (feat)
2. **Task 2: Wire background message handler and add manifest permission** - `12b25ae` (feat)

## Files Created/Modified
- `src/content-generator.js` - Content generation orchestrator with prompt engineering, Claude API integration, and storage persistence
- `src/background.js` - Added GENERATE_CONTENT message handler with job validation, API key check, and keep-alive wrapper
- `manifest.json` - Added clipboardWrite permission for copy-to-clipboard functionality

## Decisions Made

- **Model selection:** claude-haiku-4-5 chosen for cost-effectiveness ($1 input / $5 output per MTok vs Sonnet $3/$15) while maintaining quality for content generation
- **Prompt caching strategy:** System prompt + resume cached with ephemeral cache_control for ~90% cost reduction on repeat generations
- **Anti-cliche engineering:** Explicit negative constraints with 14 banned phrases ("I am excited to apply", "leverage my skills", "proven track record") to prevent robotic AI language
- **Tone guidance:** Professional-but-conversational with "write like emailing a colleague, not writing a formal letter" instruction
- **Token optimization:** extractKeyRequirements caps job descriptions at 1000 chars, focusing on requirements/skills/responsibilities sections
- **Different max_tokens:** 800 for cover letters (3-4 paragraphs), 200 for recruiter messages (<100 words) based on content type
- **Metadata tracking:** Generated content saved with generatedAt, editedAt, isEdited fields to distinguish AI-generated from user-edited content
- **Message handler pattern:** Validates job exists and Claude API key configured before attempting generation, returns structured { success, content, usage } or { success: false, error } response
- **Keep-alive tag:** Uses 'content-gen' tag (distinct from 'ai-scoring' and 'job-fetch') to prevent service worker termination during 2-5 second API calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Users provide their own Claude API key through existing settings flow (Phase 01).

## Next Phase Readiness

Content generation foundation complete. Ready for Phase 07 Plan 02 (UI integration):
- generateContent() function ready for popup to call via chrome.runtime.sendMessage
- Background handler routes GENERATE_CONTENT messages correctly
- Generated content persists to storage with metadata for UI display
- clipboardWrite permission enables copy-to-clipboard functionality

No blockers. Phase 07 Plan 02 can wire UI controls (generate buttons, edit modals, copy buttons) to this backend.

## Self-Check: PASSED

---
*Phase: 07-ai-content-generation*
*Completed: 2026-02-07*
