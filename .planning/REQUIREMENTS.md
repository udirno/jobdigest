# Requirements: JobDigest

**Defined:** 2026-02-05
**Core Value:** Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Resume Management

- [ ] **RESUME-01**: User can upload resume as PDF file
- [ ] **RESUME-02**: User can upload resume as DOCX file
- [ ] **RESUME-03**: User can paste resume as plain text
- [ ] **RESUME-04**: Extension parses and stores resume text in chrome.storage.local

### Job Fetching

- [ ] **FETCH-01**: Extension fetches jobs daily at 6 AM PST via chrome.alarms
- [ ] **FETCH-02**: Extension fetches jobs from Adzuna API (1000 free calls/month)
- [ ] **FETCH-03**: Extension fetches jobs from JSearch API via RapidAPI (150 free calls/month)
- [ ] **FETCH-04**: User can manually trigger job fetch on demand via "Fetch Jobs Now" button
- [ ] **FETCH-05**: Extension implements batch processing to handle service worker termination
- [ ] **FETCH-06**: Extension verifies alarm exists on startup and recreates if missing
- [ ] **FETCH-07**: Extension caps job fetching at 100 jobs per day for cost control

### AI Scoring

- [ ] **SCORE-01**: Extension scores each job 0-100 based on resume match using Claude API
- [ ] **SCORE-02**: Extension provides reasoning for each job score explaining the match
- [ ] **SCORE-03**: Scoring evaluates skills match (job requirements vs resume skills)
- [ ] **SCORE-04**: Scoring evaluates experience level (years required vs years available)
- [ ] **SCORE-05**: Scoring evaluates keywords/tech stack alignment
- [ ] **SCORE-06**: Scoring evaluates job title relevance
- [ ] **SCORE-07**: Scoring evaluates industry fit and motivation alignment

### AI Content Generation

- [ ] **CONTENT-01**: User can generate cover letter (3-4 paragraphs) tailored to specific job
- [ ] **CONTENT-02**: User can generate recruiter message (under 100 words) tailored to specific job
- [ ] **CONTENT-03**: Generated cover letters reference both resume and job description
- [ ] **CONTENT-04**: Generated recruiter messages reference both resume and job description

### Dashboard

- [ ] **DASH-01**: Extension displays jobs in card-based layout with black background and sand brown accents
- [ ] **DASH-02**: Dashboard sorts jobs by score (highest to lowest) by default
- [ ] **DASH-03**: User can view full job description in detail modal
- [ ] **DASH-04**: User can click through to original job posting URL
- [ ] **DASH-05**: User can filter jobs by status (New, Contacted, Applied, Passed)
- [ ] **DASH-06**: Dashboard shows job score prominently on each card
- [ ] **DASH-07**: Dashboard shows job title, company, location on each card

### Application Tracking

- [ ] **TRACK-01**: User can mark job with status: New (default)
- [ ] **TRACK-02**: User can mark job with status: Contacted
- [ ] **TRACK-03**: User can mark job with status: Applied
- [ ] **TRACK-04**: User can mark job with status: Passed (rejected or not interested)
- [ ] **TRACK-05**: User can add application date when marking job as Applied
- [ ] **TRACK-06**: User can add free-form notes to any job
- [ ] **TRACK-07**: Extension stores generated cover letters with job for reference
- [ ] **TRACK-08**: Extension stores generated recruiter messages with job for reference
- [ ] **TRACK-09**: User can dismiss/hide jobs they're not interested in

### Export

- [ ] **EXPORT-01**: User can export all tracked jobs to CSV file
- [ ] **EXPORT-02**: CSV export includes job metadata (title, company, location, score, status, dates, notes)
- [ ] **EXPORT-03**: CSV export includes generated content (cover letters, recruiter messages)

### Settings & Configuration

- [ ] **CONFIG-01**: Onboarding flow guides user through API key setup on first install
- [ ] **CONFIG-02**: User can configure Claude API key in settings
- [ ] **CONFIG-03**: User can configure Adzuna API key in settings
- [ ] **CONFIG-04**: User can configure JSearch API key in settings
- [ ] **CONFIG-05**: User can set search keywords/job titles in preferences
- [ ] **CONFIG-06**: User can set location preferences in settings
- [ ] **CONFIG-07**: User can set salary range minimum in preferences
- [ ] **CONFIG-08**: User can set date posted filter (last X days) in preferences
- [ ] **CONFIG-09**: User can set industry preferences in settings
- [ ] **CONFIG-10**: Extension enforces 100 jobs/day cap for Claude API cost control

### Error Handling & Reliability

- [ ] **ERROR-01**: Extension handles API failures gracefully with user-friendly error messages
- [ ] **ERROR-02**: Extension implements exponential backoff retry for API rate limits (429 responses)
- [ ] **ERROR-03**: Extension implements keep-alive pattern during long API operations
- [ ] **ERROR-04**: Extension saves progress after each batch to handle service worker termination
- [ ] **ERROR-05**: Extension detects missed alarms and offers catch-up fetch
- [ ] **ERROR-06**: Extension monitors chrome.storage.local usage and warns at 80% capacity
- [ ] **ERROR-07**: Extension requests unlimitedStorage permission to avoid quota issues

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

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RESUME-01 | Phase 2 | Pending |
| RESUME-02 | Phase 2 | Pending |
| RESUME-03 | Phase 2 | Pending |
| RESUME-04 | Phase 2 | Pending |
| FETCH-01 | Phase 3 | Pending |
| FETCH-02 | Phase 3 | Pending |
| FETCH-03 | Phase 3 | Pending |
| FETCH-04 | Phase 3 | Pending |
| FETCH-05 | Phase 3 | Pending |
| FETCH-06 | Phase 3 | Pending |
| FETCH-07 | Phase 3 | Pending |
| SCORE-01 | Phase 4 | Complete |
| SCORE-02 | Phase 4 | Complete |
| SCORE-03 | Phase 4 | Complete |
| SCORE-04 | Phase 4 | Complete |
| SCORE-05 | Phase 4 | Complete |
| SCORE-06 | Phase 4 | Complete |
| SCORE-07 | Phase 4 | Complete |
| CONTENT-01 | Phase 7 | Pending |
| CONTENT-02 | Phase 7 | Pending |
| CONTENT-03 | Phase 7 | Pending |
| CONTENT-04 | Phase 7 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| DASH-07 | Phase 5 | Pending |
| TRACK-01 | Phase 6 | Pending |
| TRACK-02 | Phase 6 | Pending |
| TRACK-03 | Phase 6 | Pending |
| TRACK-04 | Phase 6 | Pending |
| TRACK-05 | Phase 6 | Pending |
| TRACK-06 | Phase 6 | Pending |
| TRACK-07 | Phase 7 | Pending |
| TRACK-08 | Phase 7 | Pending |
| TRACK-09 | Phase 6 | Pending |
| EXPORT-01 | Phase 8 | Pending |
| EXPORT-02 | Phase 8 | Pending |
| EXPORT-03 | Phase 8 | Pending |
| CONFIG-01 | Phase 1 | Pending |
| CONFIG-02 | Phase 1 | Pending |
| CONFIG-03 | Phase 1 | Pending |
| CONFIG-04 | Phase 1 | Pending |
| CONFIG-05 | Phase 5 | Pending |
| CONFIG-06 | Phase 5 | Pending |
| CONFIG-07 | Phase 5 | Pending |
| CONFIG-08 | Phase 5 | Pending |
| CONFIG-09 | Phase 5 | Pending |
| CONFIG-10 | Phase 1 | Pending |
| ERROR-01 | Phase 1 | Pending |
| ERROR-02 | Phase 1 | Pending |
| ERROR-03 | Phase 1 | Pending |
| ERROR-04 | Phase 1 | Pending |
| ERROR-05 | Phase 3 | Pending |
| ERROR-06 | Phase 8 | Pending |
| ERROR-07 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 58 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
