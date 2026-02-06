# Roadmap: JobDigest

## Overview

JobDigest delivers automated job searching through eight phases, starting with Chrome extension foundation and API infrastructure, then building resume management and job fetching capabilities, followed by AI-powered scoring and dashboard UI, and culminating in application tracking, content generation, and data export features. Each phase builds on the previous, ensuring service worker reliability and storage patterns are established before adding user-facing features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Infrastructure** - Extension scaffolding, service worker lifecycle, storage patterns
- [x] **Phase 2: Resume Management** - Upload/parse PDF/DOCX/text, store resume for AI features
- [ ] **Phase 3: Job Fetching & Scheduling** - Adzuna/JSearch API integration, daily alarms, batch processing
- [ ] **Phase 4: AI Scoring** - Claude API integration, job-resume matching with 0-100 scores
- [ ] **Phase 5: Dashboard & UI** - Card-based job display, filtering, sorting, detail views
- [ ] **Phase 6: Application Tracking** - Status management, notes, date tracking, dismiss jobs
- [ ] **Phase 7: AI Content Generation** - Cover letter and recruiter message generation
- [ ] **Phase 8: Export & Polish** - CSV export, manual controls, storage monitoring

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Extension boots reliably with service worker lifecycle management, storage abstraction, error handling, and CORS permissions
**Depends on**: Nothing (first phase)
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-10, ERROR-01, ERROR-02, ERROR-03, ERROR-04, ERROR-07
**Success Criteria** (what must be TRUE):
  1. Extension installs and runs on Chrome with Manifest V3
  2. User completes onboarding flow and configures all three API keys (Claude, Adzuna, JSearch)
  3. Service worker persists state to chrome.storage.local and restores on restart
  4. API calls handle failures gracefully with user-friendly error messages
  5. Extension requests and uses unlimitedStorage permission to avoid quota issues
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Manifest V3 scaffolding, storage abstraction, error handling infrastructure
- [x] 01-02-PLAN.md — Service worker lifecycle management, keep-alive, daily cap
- [x] 01-03-PLAN.md — Onboarding wizard and settings page for API key configuration
- [x] 01-04-PLAN.md — Integration verification and human acceptance testing

### Phase 2: Resume Management
**Goal**: Users can upload resume in multiple formats (PDF/DOCX/text) which is parsed and stored for AI scoring
**Depends on**: Phase 1 (storage patterns established)
**Requirements**: RESUME-01, RESUME-02, RESUME-03, RESUME-04
**Success Criteria** (what must be TRUE):
  1. User can upload PDF resume and extension extracts text successfully
  2. User can upload DOCX resume and extension extracts text successfully
  3. User can paste plain text resume directly
  4. Resume text persists in chrome.storage.local and loads on extension restart
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Vendor PDF.js and mammoth.js libraries, create resume parser module, extend storage helpers
- [x] 02-02-PLAN.md — Resume management UI in settings panel with file upload, text paste, and human verification

### Phase 3: Job Fetching & Scheduling
**Goal**: Extension automatically fetches jobs daily at user-configured time from Adzuna and JSearch APIs with adaptive distribution and manual trigger fallback
**Depends on**: Phase 1 (API error handling, batch processing patterns)
**Requirements**: FETCH-01, FETCH-02, FETCH-03, FETCH-04, FETCH-05, FETCH-06, FETCH-07, ERROR-02, ERROR-03, ERROR-04, ERROR-05
**Success Criteria** (what must be TRUE):
  1. Extension fetches jobs daily at user-configured time via chrome.alarms without user intervention
  2. User can manually trigger job fetch on demand via "Fetch Jobs Now" button
  3. Extension successfully fetches jobs from both Adzuna API and JSearch API
  4. Extension handles service worker termination mid-fetch and resumes from last checkpoint
  5. Extension caps job fetching at 100 jobs per day across both APIs
  6. Extension verifies alarm exists on browser startup and recreates if missing
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — API clients for Adzuna and JSearch with normalized job schema, storage extensions
- [ ] 03-02-PLAN.md — Scheduler, adaptive distribution, and job-fetcher orchestrator with checkpoint recovery
- [ ] 03-03-PLAN.md — Background service worker integration with alarm handling, batch recovery, message routing
- [ ] 03-04-PLAN.md — Settings UI for fetch scheduling, search preferences, manual trigger, and human verification

### Phase 4: AI Scoring
**Goal**: Each fetched job receives 0-100 match score with reasoning based on resume comparison using Claude API
**Depends on**: Phase 2 (resume stored), Phase 3 (jobs fetched)
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, SCORE-07
**Success Criteria** (what must be TRUE):
  1. Extension scores each fetched job with number between 0-100 using Claude API
  2. Each score includes text reasoning explaining match quality (skills, experience, keywords, title, industry)
  3. Scoring evaluates all five dimensions: skills match, experience level, tech stack alignment, job title relevance, industry fit
  4. Scored jobs persist in storage with scores visible to user
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

### Phase 5: Dashboard & UI
**Goal**: Users view scored jobs in card-based dashboard with filtering, sorting, and detail views
**Depends on**: Phase 4 (scored jobs available)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, CONFIG-05, CONFIG-06, CONFIG-07, CONFIG-08, CONFIG-09
**Success Criteria** (what must be TRUE):
  1. Dashboard displays jobs as cards with black background and sand brown accents
  2. Jobs sort by score (highest to lowest) by default
  3. User can click on job card to view full description in detail modal
  4. User can click "View Original" to open job posting URL in new tab
  5. User can filter jobs by application status (New, Contacted, Applied, Passed)
  6. Each job card prominently shows score, job title, company name, and location
  7. User can configure search preferences (keywords, location, salary, date posted, industry) in settings
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during planning

### Phase 6: Application Tracking
**Goal**: Users manage job application pipeline with status tracking, notes, dates, and dismiss functionality
**Depends on**: Phase 5 (dashboard UI established)
**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06, TRACK-09
**Success Criteria** (what must be TRUE):
  1. User can change job status between New, Contacted, Applied, and Passed states
  2. User can add application date when marking job as Applied
  3. User can add free-form notes to any job and view notes later
  4. User can dismiss/hide jobs they're not interested in and dismissed jobs don't appear in main view
  5. Status changes and notes persist in storage across sessions
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during planning

### Phase 7: AI Content Generation
**Goal**: Users generate personalized cover letters and recruiter messages for specific jobs using Claude API
**Depends on**: Phase 6 (job tracking UI established), Phase 4 (Claude API integration)
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, TRACK-07, TRACK-08
**Success Criteria** (what must be TRUE):
  1. User can generate 3-4 paragraph cover letter tailored to specific job and resume
  2. User can generate recruiter message under 100 words tailored to specific job and resume
  3. Generated cover letters reference both resume skills and job description requirements
  4. Generated recruiter messages reference both resume experience and job description
  5. Generated content saves with job record for future reference
**Plans**: TBD

Plans:
- [ ] 07-01: TBD during planning

### Phase 8: Export & Polish
**Goal**: Users export application data to CSV and monitor storage usage with warning system
**Depends on**: Phase 6 (application tracking data), Phase 7 (generated content)
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, ERROR-06
**Success Criteria** (what must be TRUE):
  1. User can export all tracked jobs to CSV file via "Export" button
  2. CSV export includes job metadata (title, company, location, score, status, application date, notes)
  3. CSV export includes generated content (cover letters and recruiter messages)
  4. Extension monitors chrome.storage.local usage and warns user at 80% capacity
**Plans**: TBD

Plans:
- [ ] 08-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 4/4 | Complete | 2026-02-05 |
| 2. Resume Management | 2/2 | Complete | 2026-02-05 |
| 3. Job Fetching & Scheduling | 0/4 | Not started | - |
| 4. AI Scoring | 0/TBD | Not started | - |
| 5. Dashboard & UI | 0/TBD | Not started | - |
| 6. Application Tracking | 0/TBD | Not started | - |
| 7. AI Content Generation | 0/TBD | Not started | - |
| 8. Export & Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-05*
*Last updated: 2026-02-05* (Phase 3 planned)
