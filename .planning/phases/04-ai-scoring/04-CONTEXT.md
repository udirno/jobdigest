# Phase 4: AI Scoring - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Each fetched job receives a 0-100 match score with text reasoning based on resume comparison using Claude API. Scoring evaluates 5 dimensions: skills match, experience level, tech stack alignment, job title relevance, and industry fit. Scores persist in storage and are visible to users.

</domain>

<decisions>
## Implementation Decisions

### Scoring Prompt Design
- **Job description scope**: Send core sections only (job title, requirements, key responsibilities). Skip benefits, perks, and company culture fluff to reduce token usage.
- **Skills-heavy weighting**: Emphasize technical skills and tech stack match most heavily in the scoring. Skills alignment is the primary factor.
- **Prompt structure**: Claude's discretion (single-shot vs structured output)
- **Reasoning detail**: Claude's discretion (balance informativeness with readability)

### Score Computation Strategy
- **Timing**: Claude's discretion (immediately after fetch vs batch at end)
- **Failure handling**: Claude's discretion (retry with backoff, mark unscored, or fail entire fetch)
- **Parallelization**: Claude's discretion (sequential vs parallel batches)
- **Adaptive distribution integration**: Claude's discretion (activate adaptive allocation using scores now, or defer to future)

### Cost vs Quality Balance
- **Model selection**: Claude's discretion (Haiku/Sonnet/Opus trade-off)
- **Token limits**: Claude's discretion (set reasonable budgets based on typical job descriptions)
- **Priority**: Balanced approach - good enough scoring without excessive API spend
- **Cost warnings**: Claude's discretion (show cost estimates or let users manage via Anthropic dashboard)

### Score Visibility and Updates
- **Display timing**: Claude's discretion (progressive updates vs wait for batch)
- **Re-scoring capability**: Claude's discretion (manual trigger, automatic on resume change, or no re-scoring)
- **Unscored job handling**: Claude's discretion (show with label, hide, or bottom-rank)
- **Reasoning presentation**: Claude's discretion (visible by default or expand on click)

</decisions>

<specifics>
## Specific Ideas

- User wants skills and tech stack to be the primary matching criteria
- Cost control matters but shouldn't sacrifice matching quality - find the middle ground
- The 100 jobs/day cap already provides overall cost control

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-ai-scoring*
*Context gathered: 2026-02-05*
