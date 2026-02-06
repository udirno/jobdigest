# Phase 5: Dashboard & UI - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Card-based dashboard that displays scored jobs with filtering, sorting, and detail views. Users interact with this daily to browse and evaluate job matches. Application tracking (status changes, notes, dates) is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Card Layout & Density
- **Information richness**: Rich cards showing score, title, company, location, posted date, salary range, skills match %, and description preview
- **Score display**: Subtle color-coded badge (no emojis), clear numeric score, blends with black/sand brown theme using subtle red/yellow/green
- **Quick actions on card**: Three actions - View Details (modal), View Original (external link), Status dropdown (quick change)
- **Grid layout**: Responsive grid - 1 column on mobile, 2 on tablet, 3 on desktop
- **Design philosophy**: Minimalist but clear - should not look AI-generated in terms of text/branding

### Score Visualization
- **Dimension breakdown**: Not visible on cards - only show overall score
- **Info tooltip**: Small hover tooltip on score badge explaining how score was calculated (for curious users)
- **Score colors**: Subtle red/yellow/green gradient matching the black/sand brown theme
- **AI reasoning**: Only in detail modal, not on cards
- **Description preview**: Smart extraction of key requirements/skills (not generic intro sentences)

### Filtering & Sorting UX
- **Filter placement**: Claude's discretion based on best design principles
- **Available filters**: Just application status (New, Contacted, Applied, Passed) - keep it simple
- **Sort options**: Multiple - score, date posted, company name, title (user choice)
- **Default view**: All jobs, sorted by score (highest to lowest)

### Detail Modal & Navigation
- **Modal size**: Claude's discretion based on best design principles
- **Modal content**: Description + score breakdown (full job description + 5 dimension scores with reasoning)
- **Navigation**: Previous/Next buttons to browse through jobs while modal is open
- **Empty state**: Helpful prompt - suggest manual fetch trigger or check settings

</decisions>

<specifics>
## Specific Ideas

- User wants minimalist, clear design that doesn't look AI-generated
- Black background with sand brown accents (established in Phase 1)
- Score should be immediately understandable without being too prominent
- Cards should provide rich information without feeling cluttered
- Smart extraction of key requirements rather than showing generic job description intro

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-dashboard-ui*
*Context gathered: 2026-02-06*
