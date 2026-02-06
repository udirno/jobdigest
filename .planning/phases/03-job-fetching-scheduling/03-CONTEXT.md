# Phase 3: Job Fetching & Scheduling - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated daily job fetching from Adzuna and JSearch APIs with scheduling, batch processing, error recovery, and manual trigger capability. This phase delivers the job acquisition pipeline. AI scoring happens in Phase 4, UI display in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Job Distribution Strategy
- **Adaptive distribution**: Split the 100-job daily cap between Adzuna and JSearch based on which API delivers better matches
- **Bootstrap approach**: "Gather first" — on each fetch, get 25 jobs from each API, score them, then allocate remaining 50 jobs based on quality results
- **Quality metric**: Claude's discretion (could be average score, high-value job count, or hybrid approach)
- **Recalibration frequency**: Claude's discretion (daily, weekly, or rolling window based on data stability needs)

### Fetch Timing and User Control
- **User-configurable time with timezone support**: Users can set their preferred fetch time (not fixed at 6 AM PST)
- **Timezone handling**: Claude's discretion (auto-detect browser timezone, explicit timezone setting, or hybrid approach)
- **Missed alarm handling**: Claude's discretion (fetch on wakeup, skip missed, or smart catch-up based on calendar day)
- **Fetch history visibility**: Claude's discretion (current status only, recent history, or detailed logs)

### Claude's Discretion
- Exact quality metric for adaptive distribution (average score vs high-value count vs engagement)
- Recalibration frequency for the adaptive algorithm
- Timezone handling strategy (auto-detect, explicit, or hybrid)
- Missed alarm behavior (catch-up rules)
- Fetch history UI (how much visibility users get into past fetches)
- Manual "Fetch Jobs Now" button placement and behavior (assumed in settings panel, respects daily cap)
- Search query configuration UI (keywords, location, salary) — defer detailed design to planning phase

</decisions>

<specifics>
## Specific Ideas

- The adaptive distribution is a key differentiator — system learns which API provides better matches for this user's profile and optimizes over time
- Bootstrap with 25/25 split before allocating remaining 50 ensures both APIs get fair evaluation
- User-configurable fetch time accommodates different job-seeking schedules (some people want jobs before work, others at night)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-job-fetching-scheduling*
*Context gathered: 2026-02-05*
