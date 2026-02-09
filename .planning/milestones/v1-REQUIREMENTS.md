# Requirements Archive: v1 Initial Release

**Archived:** 2026-02-09
**Status:** ✅ SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md` (will be created in next milestone).

---

# Requirements: JobDigest v1

**Defined:** 2026-02-05
**Core Value:** Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.

## v1 Requirements

Requirements for initial release. All requirements completed.

### Resume Management

- [x] **RESUME-01**: User can upload resume as PDF file — ✓ Shipped (Phase 2)
- [x] **RESUME-02**: User can upload resume as DOCX file — ✓ Shipped (Phase 2)
- [x] **RESUME-03**: User can paste resume as plain text — ✓ Shipped (Phase 2)
- [x] **RESUME-04**: Extension parses and stores resume text in chrome.storage.local — ✓ Shipped (Phase 2)

### Job Fetching

- [x] **FETCH-01**: Extension fetches jobs daily at 6 AM PST via chrome.alarms — ✓ Shipped (Phase 3)
- [x] **FETCH-02**: Extension fetches jobs from Adzuna API (1000 free calls/month) — ✓ Shipped (Phase 3)
- [x] **FETCH-03**: Extension fetches jobs from JSearch API via RapidAPI (150 free calls/month) — ✓ Shipped (Phase 3)
- [x] **FETCH-04**: User can manually trigger job fetch on demand via "Fetch Jobs Now" button — ✓ Shipped (Phase 3)
- [x] **FETCH-05**: Extension implements batch processing to handle service worker termination — ✓ Shipped (Phase 3)
- [x] **FETCH-06**: Extension verifies alarm exists on startup and recreates if missing — ✓ Shipped (Phase 3)
- [x] **FETCH-07**: Extension caps job fetching at 100 jobs per day for cost control — ✓ Shipped (Phase 3)

### AI Scoring

- [x] **SCORE-01**: Extension scores each job 0-100 based on resume match using Claude API — ✓ Shipped (Phase 4)
- [x] **SCORE-02**: Extension provides reasoning for each job score explaining the match — ✓ Shipped (Phase 4)
- [x] **SCORE-03**: Scoring evaluates skills match (job requirements vs resume skills) — ✓ Shipped (Phase 4)
- [x] **SCORE-04**: Scoring evaluates experience level (years required vs years available) — ✓ Shipped (Phase 4)
- [x] **SCORE-05**: Scoring evaluates keywords/tech stack alignment — ✓ Shipped (Phase 4)
- [x] **SCORE-06**: Scoring evaluates job title relevance — ✓ Shipped (Phase 4)
- [x] **SCORE-07**: Scoring evaluates industry fit and motivation alignment — ✓ Shipped (Phase 4)

### AI Content Generation

- [x] **CONTENT-01**: User can generate cover letter (3-4 paragraphs) tailored to specific job — ✓ Shipped (Phase 7)
- [x] **CONTENT-02**: User can generate recruiter message (under 100 words) tailored to specific job — ✓ Shipped (Phase 7)
- [x] **CONTENT-03**: Generated cover letters reference both resume and job description — ✓ Shipped (Phase 7)
- [x] **CONTENT-04**: Generated recruiter messages reference both resume and job description — ✓ Shipped (Phase 7)

### Dashboard

- [x] **DASH-01**: Extension displays jobs in card-based layout with black background and sand brown accents — ✓ Shipped (Phase 5)
- [x] **DASH-02**: Dashboard sorts jobs by score (highest to lowest) by default — ✓ Shipped (Phase 5)
- [x] **DASH-03**: User can view full job description in detail modal — ✓ Shipped (Phase 5)
- [x] **DASH-04**: User can click through to original job posting URL — ✓ Shipped (Phase 5)
- [x] **DASH-05**: User can filter jobs by status (New, Contacted, Applied, Passed) — ✓ Shipped (Phase 5)
- [x] **DASH-06**: Dashboard shows job score prominently on each card — ✓ Shipped (Phase 5)
- [x] **DASH-07**: Dashboard shows job title, company, location on each card — ✓ Shipped (Phase 5)

### Application Tracking

- [x] **TRACK-01**: User can mark job with status: New (default) — ✓ Shipped (Phase 6)
- [x] **TRACK-02**: User can mark job with status: Contacted — ✓ Shipped (Phase 6)
- [x] **TRACK-03**: User can mark job with status: Applied — ✓ Shipped (Phase 6)
- [x] **TRACK-04**: User can mark job with status: Passed (rejected or not interested) — ✓ Shipped (Phase 6)
- [x] **TRACK-05**: User can add application date when marking job as Applied — ✓ Shipped (Phase 6)
- [x] **TRACK-06**: User can add free-form notes to any job — ✓ Shipped (Phase 6)
- [x] **TRACK-07**: Extension stores generated cover letters with job for reference — ✓ Shipped (Phase 7)
- [x] **TRACK-08**: Extension stores generated recruiter messages with job for reference — ✓ Shipped (Phase 7)
- [x] **TRACK-09**: User can dismiss/hide jobs they're not interested in — ✓ Shipped (Phase 6)

### Export

- [x] **EXPORT-01**: User can export all tracked jobs to CSV file — ✓ Shipped (Phase 8)
- [x] **EXPORT-02**: CSV export includes job metadata (title, company, location, score, status, dates, notes) — ✓ Shipped (Phase 8)
- [x] **EXPORT-03**: CSV export includes generated content (cover letters, recruiter messages) — ✓ Shipped (Phase 8)

### Settings & Configuration

- [x] **CONFIG-01**: Onboarding flow guides user through API key setup on first install — ✓ Shipped (Phase 1)
- [x] **CONFIG-02**: User can configure Claude API key in settings — ✓ Shipped (Phase 1)
- [x] **CONFIG-03**: User can configure Adzuna API key in settings — ✓ Shipped (Phase 1)
- [x] **CONFIG-04**: User can configure JSearch API key in settings — ✓ Shipped (Phase 1)
- [x] **CONFIG-05**: User can set search keywords/job titles in preferences — ✓ Shipped (Phase 5)
- [x] **CONFIG-06**: User can set location preferences in settings — ✓ Shipped (Phase 5)
- [x] **CONFIG-07**: User can set salary range minimum in preferences — ✓ Shipped (Phase 5)
- [x] **CONFIG-08**: User can set date posted filter (last X days) in preferences — ✓ Shipped (Phase 5)
- [x] **CONFIG-09**: User can set industry preferences in settings — ✓ Shipped (Phase 5)
- [x] **CONFIG-10**: Extension enforces 100 jobs/day cap for Claude API cost control — ✓ Shipped (Phase 1)

### Error Handling & Reliability

- [x] **ERROR-01**: Extension handles API failures gracefully with user-friendly error messages — ✓ Shipped (Phase 1)
- [x] **ERROR-02**: Extension implements exponential backoff retry for API rate limits (429 responses) — ✓ Shipped (Phase 1)
- [x] **ERROR-03**: Extension implements keep-alive pattern during long API operations — ✓ Shipped (Phase 1)
- [x] **ERROR-04**: Extension saves progress after each batch to handle service worker termination — ✓ Shipped (Phase 1)
- [x] **ERROR-05**: Extension detects missed alarms and offers catch-up fetch — ✓ Shipped (Phase 3)
- [x] **ERROR-06**: Extension monitors chrome.storage.local usage and warns at 80% capacity — ✓ Shipped (Phase 8)
- [x] **ERROR-07**: Extension requests unlimitedStorage permission to avoid quota issues — ✓ Shipped (Phase 1)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced AI Features

- **AI-V2-01**: Advanced filtering via AI extraction (remote work, salary, benefits from JD)
- **AI-V2-02**: Skill gap analysis between resume and job requirements
- **AI-V2-03**: Interview preparation suggestions based on job description

### Enhanced Tracking

- **TRACK-V2-01**: Application deadline tracking with countdown timers
- **TRACK-V2-02**: Browser notifications for upcoming deadlines
- **TRACK-V2-03**: Interview stage tracking (phone screen, technical, on-site, offer)

### Integrations

- **INTEG-V2-01**: Company research integration (Clearbit, Crunchbase, Glassdoor APIs)
- **INTEG-V2-02**: Salary comparison data integration

### Advanced UI

- **UI-V2-01**: Kanban board view for application pipeline
- **UI-V2-02**: Analytics dashboard (application stats, response rates)
- **UI-V2-03**: Dark/light theme toggle

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fully automated "apply to all" button | "Spray and pray" approach has 0.5% response rate, damages user reputation, ethical concerns. Instead prioritize quality over quantity with AI scoring. |
| LinkedIn/Indeed scraping | Violates terms of service, creates legal risk (CFAA, GDPR), Chrome Web Store ban risk. Use official APIs only. |
| Browser autofill for application forms | ATS variability means 60-70% accuracy at best, users lose control over what's submitted. Manual application required. |
| Resume builder | Scope creep beyond core value, competitor market already saturated (Teal, Huntr have this). |
| Real-time notifications | Daily batch processing is sufficient for v1, push notifications add complexity. |
| Social features (sharing, teams) | Personal tool focused on individual job seekers, not collaborative. |
| Mobile app | Chrome extension only for v1, mobile requires separate development. |
| Backend server or hosted service | Zero hosting costs is hard constraint, everything runs locally. |
| Integration with job application portals | Manual application process acceptable for v1, integration adds complexity and fragility. |
| Advanced analytics or visualizations | Simple tracking sufficient for v1, defer to v2 after usage patterns understood. |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RESUME-01 | Phase 2 | ✓ Complete |
| RESUME-02 | Phase 2 | ✓ Complete |
| RESUME-03 | Phase 2 | ✓ Complete |
| RESUME-04 | Phase 2 | ✓ Complete |
| FETCH-01 | Phase 3 | ✓ Complete |
| FETCH-02 | Phase 3 | ✓ Complete |
| FETCH-03 | Phase 3 | ✓ Complete |
| FETCH-04 | Phase 3 | ✓ Complete |
| FETCH-05 | Phase 3 | ✓ Complete |
| FETCH-06 | Phase 3 | ✓ Complete |
| FETCH-07 | Phase 3 | ✓ Complete |
| SCORE-01 | Phase 4 | ✓ Complete |
| SCORE-02 | Phase 4 | ✓ Complete |
| SCORE-03 | Phase 4 | ✓ Complete |
| SCORE-04 | Phase 4 | ✓ Complete |
| SCORE-05 | Phase 4 | ✓ Complete |
| SCORE-06 | Phase 4 | ✓ Complete |
| SCORE-07 | Phase 4 | ✓ Complete |
| CONTENT-01 | Phase 7 | ✓ Complete |
| CONTENT-02 | Phase 7 | ✓ Complete |
| CONTENT-03 | Phase 7 | ✓ Complete |
| CONTENT-04 | Phase 7 | ✓ Complete |
| DASH-01 | Phase 5 | ✓ Complete |
| DASH-02 | Phase 5 | ✓ Complete |
| DASH-03 | Phase 5 | ✓ Complete |
| DASH-04 | Phase 5 | ✓ Complete |
| DASH-05 | Phase 5 | ✓ Complete |
| DASH-06 | Phase 5 | ✓ Complete |
| DASH-07 | Phase 5 | ✓ Complete |
| TRACK-01 | Phase 6 | ✓ Complete |
| TRACK-02 | Phase 6 | ✓ Complete |
| TRACK-03 | Phase 6 | ✓ Complete |
| TRACK-04 | Phase 6 | ✓ Complete |
| TRACK-05 | Phase 6 | ✓ Complete |
| TRACK-06 | Phase 6 | ✓ Complete |
| TRACK-07 | Phase 7 | ✓ Complete |
| TRACK-08 | Phase 7 | ✓ Complete |
| TRACK-09 | Phase 6 | ✓ Complete |
| EXPORT-01 | Phase 8 | ✓ Complete |
| EXPORT-02 | Phase 8 | ✓ Complete |
| EXPORT-03 | Phase 8 | ✓ Complete |
| CONFIG-01 | Phase 1 | ✓ Complete |
| CONFIG-02 | Phase 1 | ✓ Complete |
| CONFIG-03 | Phase 1 | ✓ Complete |
| CONFIG-04 | Phase 1 | ✓ Complete |
| CONFIG-05 | Phase 5 | ✓ Complete |
| CONFIG-06 | Phase 5 | ✓ Complete |
| CONFIG-07 | Phase 5 | ✓ Complete |
| CONFIG-08 | Phase 5 | ✓ Complete |
| CONFIG-09 | Phase 5 | ✓ Complete |
| CONFIG-10 | Phase 1 | ✓ Complete |
| ERROR-01 | Phase 1 | ✓ Complete |
| ERROR-02 | Phase 1 | ✓ Complete |
| ERROR-03 | Phase 1 | ✓ Complete |
| ERROR-04 | Phase 1 | ✓ Complete |
| ERROR-05 | Phase 3 | ✓ Complete |
| ERROR-06 | Phase 8 | ✓ Complete |
| ERROR-07 | Phase 1 | ✓ Complete |

**Coverage:**
- v1 requirements: 58 total
- Completed: 58 (100%)

---

## Milestone Summary

**Shipped:** 58 of 58 requirements (100%)

**Adjusted:** None — all original requirements delivered as defined

**Dropped:** None — zero scope cuts

**Scope Additions:** Phase 8 included gap closure plan (08-03) to fix UAT-discovered issues (blob URL download, empty state validation) — both resolved successfully

**Quality Metrics:**
- 89 observable truths verified across 8 phases
- 45+ cross-phase integrations verified
- 5/5 E2E flows complete
- 0 anti-patterns detected
- 0 critical technical debt

---

*Archived: 2026-02-09 as part of v1 milestone completion*
