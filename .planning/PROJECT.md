# JobDigest

## What This Is

A Chrome extension that automates job searching by fetching jobs daily from Adzuna and JSearch APIs, scoring them 0-100 using Claude API based on resume match, and displaying them in a clean card-based dashboard. Users can generate personalized recruiter messages and cover letters, track applications through multiple states, and export data to CSV. Everything runs locally in the browser with zero hosting costs.

## Core Value

Eliminate 2+ hours per day of manual job browsing by auto-fetching, AI-scoring, and tracking jobs with intelligent filtering that surfaces only high-quality matches.

## Current State

**Latest Release:** v1 (shipped 2026-02-09)
**Codebase:** 7,550 LOC (JavaScript, HTML, CSS) + 2MB vendored libraries
**Architecture:** Chrome Extension (Manifest V3) with vanilla JavaScript
**Storage:** chrome.storage.local (10MB quota with 80% warning threshold)

See `.planning/milestones/v1-ROADMAP.md` for complete v1 details.

## Requirements

### Validated

All v1 requirements shipped 2026-02-09:

- ✓ Daily job fetching at 6 AM PST or on first browser open from Adzuna and JSearch APIs — v1
- ✓ AI scoring (0-100 with reasoning) of jobs based on resume match using Claude API — v1
- ✓ Card-based dashboard with black background and sand brown accents showing jobs sorted by score — v1
- ✓ Resume upload (PDF/DOCX) or paste text functionality for scoring — v1
- ✓ Recruiter message generation (under 100 words) tailored to specific jobs — v1
- ✓ Cover letter generation (3-4 paragraphs) tailored to specific jobs — v1
- ✓ Application tracking with 4 states: New, Contacted, Applied, Passed — v1
- ✓ CSV export of tracked applications — v1
- ✓ Onboarding flow for API key setup (Claude, Adzuna, JSearch) — v1
- ✓ Settings page to update API keys and search preferences — v1
- ✓ Search filters: keywords/job titles, location, salary range, date posted, industry — v1
- ✓ Manual refresh button to fetch jobs on demand — v1
- ✓ Dismiss/hide jobs not interested in — v1
- ✓ Click through to original job posting — v1
- ✓ Store generated content (cover letters, messages) with tracked applications — v1
- ✓ Track application date and notes for each applied job — v1
- ✓ Graceful API failure handling with user-friendly error messages — v1
- ✓ Cost control: cap at 100 jobs per day to manage Claude API costs — v1

### Active

(None — awaiting next milestone definition)

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

**Cost Model:** User pays directly for their own API usage (~$10-12/month for Claude API with prompt caching, ~$15/month for JSearch paid tier). No subscription or hosting costs for the extension itself. Total: ~$25-30/month.

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
- **APIs**: Adzuna (free 1000 calls/month), JSearch via RapidAPI (free 150 calls/month), Claude API (claude-haiku-4-5 for cost efficiency)
- **Security**: No LinkedIn scraping or TOS violations — only use official job APIs with proper authentication
- **Privacy**: All data stays local, user provides own API keys
- **Cost**: Zero hosting costs, user pays ~$30-60/month for Claude API directly
- **UI**: Card-based layout with black background and sand brown accents

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla JavaScript (no React/Vue) | Reduce bundle size, simplify extension architecture, faster load times | ✓ Good — 7,550 LOC total, fast popup render |
| Manifest V3 | Required by Chrome for new extensions, future-proof | ✓ Good — Checkpoint recovery pattern handles service worker termination |
| chrome.storage.local only | Zero hosting costs, all data stays local, privacy-first | ✓ Good — 10MB quota with monitoring at 80% |
| User provides own API keys | No cost to maintain service, scales without infrastructure, users control their spending | ✓ Good — Onboarding flow guides setup |
| Adzuna + JSearch APIs | Free tiers provide sufficient volume (1000+150 = 1150 calls/month), official APIs with no TOS risks | ✓ Good — Adaptive distribution balances quality |
| Claude API for scoring | Superior reasoning quality for nuanced job-resume matching compared to alternatives | ✓ Good — Prompt caching reduces cost 90% |
| Cap at 100 jobs/day | Prevents runaway Claude API costs, still provides 10-20 high-quality matches after filtering | ✓ Good — Daily stats with reset logic |
| 4 application states only | Simple enough to avoid complexity, sufficient for tracking job search pipeline | ✓ Good — Status dropdown on cards and modal |
| Claude Haiku 4.5 model | Cost efficiency while maintaining quality | ✓ Good — ~$10-12/month vs $30-60 with Sonnet |
| Prompt caching on resume | 90% token reduction after first request | ✓ Good — Validated in production usage |
| Data URL for CSV download | MV3-compatible download mechanism | ✓ Good — Fixed blob URL incompatibility issue |
| Checkpoint recovery pattern | Service worker resilience across 4 stages | ✓ Good — No lost jobs during termination |

---
*Last updated: 2026-02-09 after v1 milestone completion*
