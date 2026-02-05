# JobDigest

## What This Is

A Chrome extension that automates job searching by fetching jobs daily from Adzuna and JSearch APIs, scoring them 0-100 using Claude API based on resume match, and displaying them in a clean card-based dashboard. Users can generate personalized recruiter messages and cover letters, track applications through multiple states, and export data to CSV. Everything runs locally in the browser with zero hosting costs.

## Core Value

Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Daily job fetching at 6 AM PST or on first browser open from Adzuna and JSearch APIs
- [ ] AI scoring (0-100 with reasoning) of jobs based on resume match using Claude API
- [ ] Card-based dashboard with black background and sand brown accents showing jobs sorted by score
- [ ] Resume upload (PDF/DOCX) or paste text functionality for scoring
- [ ] Recruiter message generation (under 100 words) tailored to specific jobs
- [ ] Cover letter generation (3-4 paragraphs) tailored to specific jobs
- [ ] Application tracking with 4 states: New, Contacted, Applied, Passed
- [ ] CSV export of tracked applications
- [ ] Onboarding flow for API key setup (Claude, Adzuna, JSearch)
- [ ] Settings page to update API keys and search preferences
- [ ] Search filters: keywords/job titles, location, salary range, date posted, industry
- [ ] Manual refresh button to fetch jobs on demand
- [ ] Dismiss/hide jobs not interested in
- [ ] Click through to original job posting
- [ ] Store generated content (cover letters, messages) with tracked applications
- [ ] Track application date and notes for each applied job
- [ ] Graceful API failure handling with user-friendly error messages
- [ ] Cost control: cap at 100 jobs per day to manage Claude API costs

### Out of Scope

- LinkedIn scraping — violates TOS, creates security/ban risks
- Backend server or hosted service — zero hosting costs is a hard constraint
- Mobile app — Chrome extension only for v1
- Real-time notifications — daily batch processing is sufficient
- Social features (sharing, teams) — personal tool focused on individual job seekers
- Integration with job application portals — manual application process acceptable for v1
- Advanced analytics or visualizations — simple tracking sufficient for v1

## Context

**Target Users:** Job seekers actively applying to 10-20 jobs per day who are spending 2-3 hours manually browsing LinkedIn and Indeed. They want to eliminate browsing time, focus only on high-quality matches, and track applications without spreadsheets.

**Problem Solved:**
- Eliminates 2+ hours/day of manual job browsing
- Filters out ghost jobs and poor matches using AI scoring
- Generates personalized recruiter messages and cover letters
- Provides simple application tracking with CSV export

**Cost Model:** User pays directly for their own API usage (~$30-60/month for Claude API). No subscription or hosting costs for the extension itself.

**Scoring Logic:** Claude evaluates jobs holistically across multiple dimensions:
- Skills match (job requirements vs resume skills)
- Experience level (years required vs years available)
- Keywords/tech stack alignment
- Job title relevance
- Industry fit and motivation alignment

## Constraints

- **Tech Stack**: Chrome Extension with Manifest V3, vanilla JavaScript (no frameworks) — simplicity and performance
- **Storage**: chrome.storage.local for all data — zero hosting costs, all data stays local
- **Scheduling**: chrome.alarms API for daily 6 AM PST job fetching
- **APIs**: Adzuna (free 1000 calls/month), JSearch via RapidAPI (free 150 calls/month), Claude API (claude-3-5-sonnet-20241022)
- **Security**: No LinkedIn scraping or TOS violations — only use official job APIs with proper authentication
- **Privacy**: All data stays local, user provides own API keys
- **Cost**: Zero hosting costs, user pays ~$30-60/month for Claude API directly
- **UI**: Card-based layout with black background and sand brown accents

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla JavaScript (no React/Vue) | Reduce bundle size, simplify extension architecture, faster load times | — Pending |
| Manifest V3 | Required by Chrome for new extensions, future-proof | — Pending |
| claude.storage.local only | Zero hosting costs, all data stays local, privacy-first | — Pending |
| User provides own API keys | No cost to maintain service, scales without infrastructure, users control their spending | — Pending |
| Adzuna + JSearch APIs | Free tiers provide sufficient volume (1000+150 = 1150 calls/month), official APIs with no TOS risks | — Pending |
| Claude API for scoring | Superior reasoning quality for nuanced job-resume matching compared to alternatives | — Pending |
| Cap at 100 jobs/day | Prevents runaway Claude API costs, still provides 10-20 high-quality matches after filtering | — Pending |
| 4 application states only | Simple enough to avoid complexity, sufficient for tracking job search pipeline | — Pending |

---
*Last updated: 2026-02-05 after initialization*
