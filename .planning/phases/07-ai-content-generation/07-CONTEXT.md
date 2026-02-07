# Phase 7: AI Content Generation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate personalized cover letters and recruiter messages for specific jobs using Claude API. Users trigger generation from job detail modal, can edit content before copying, and generated content persists with job records. Content generation leverages existing resume data and job descriptions to create natural, human-like application materials.

</domain>

<decisions>
## Implementation Decisions

### Generation triggers & workflow
- Buttons in job detail modal trigger generation (not separate tab or context menu)
- Button behavior: Claude has discretion on whether to use separate buttons or combined button
- Regeneration allowed: Show 'Regenerate' button after initial generation to create new versions
- Loading feedback: Claude has discretion on loading UX (spinner, overlay, progress indicator)
- Content quality: Prompt engineering focused on natural, human-like writing that doesn't sound AI-generated
- Avoid AI tells: No cliches, buzzwords, generic phrases like "I am writing to express" or "leverage my skills"

### Content display & editing
- Display layout: Claude has discretion on layout approach (expandable sections, tabs, side-by-side panels)
- Editing: Yes, inline editing via textarea — users can modify content before copying, changes are saved
- Copy mechanism: Claude has discretion on copy button design and interaction pattern
- Copy feedback: Claude has discretion on feedback method (toast, button state change, both)

### Tone & customization
- Cover letter tone: Professional but conversational (balance formality with approachability, natural language)
- Recruiter message tone: Same tone as cover letter for consistency
- Custom instructions: Yes, provide text field for custom instructions (e.g., "emphasize leadership", "mention relocation")
- Instructions location: Claude has discretion on whether custom instructions are global (settings), per-job (modal), or both

### Storage & history
- Version history: Claude has discretion on saving all versions vs latest only vs latest + original
- Metadata tracking: Yes, track both generation timestamp and distinguish AI-generated vs user-edited content
- Storage strategy: Claude has discretion on handling storage space (character limits, compression, cleanup)
- Content persistence: Claude has discretion on whether content persists across sessions and how users access it

### Claude's Discretion
- Button design (separate vs combined generation buttons)
- Loading feedback during generation (spinner, overlay, progress indicator)
- Display layout (expandable sections, tabs, side-by-side panels)
- Copy-to-clipboard interaction pattern
- Copy feedback mechanism (toast, button state change, both)
- Custom instructions location (global settings, per-job modal, or both)
- Version history strategy (all versions, latest only, or latest + original)
- Storage space handling (character limits, compression, user-triggered cleanup)
- Content persistence approach (when/how users access previously generated content)

</decisions>

<specifics>
## Specific Ideas

- Content must be usable without sounding AI-generated — focus on natural, human-like writing
- Tone should feel like a person wrote it, not a robot (avoid formulaic business letter cliches)
- Professional but conversational means approachable and natural, not stiff or robotic
- Custom instructions allow flexibility for specific situations (emphasizing skills, mentioning relocation, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ai-content-generation*
*Context gathered: 2026-02-06*
