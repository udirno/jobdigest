# JobDigest

Automate your job search with AI-powered job scoring and tracking. JobDigest fetches jobs daily, scores them 0-100 based on your resume, and helps you manage applications—all running locally in your browser.

## What It Does

- **Auto-fetches jobs** daily from Adzuna and JSearch APIs
- **AI scores jobs** 0-100 based on resume match using Claude API
- **Generates cover letters** and recruiter messages tailored to each job
- **Tracks applications** with notes, dates, and status management
- **Exports to CSV** for backup and analysis

---

## Quick Start

### 1. Get API Keys

You'll need three API keys:

**Claude API** (for AI scoring and content generation)
- Sign up at https://console.anthropic.com/
- Go to API Keys → Create Key
- Copy the key (starts with `sk-ant-...`)
- Cost: ~$10-12/month with prompt caching

**Adzuna API** (for job listings)
- Sign up at https://developer.adzuna.com/signup
- Create an app to get App ID and App Key
- Free tier: 1,000 calls/month

**JSearch API** (for additional job listings)
- Sign up at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- Subscribe to free tier (150 calls/month)
- Get your API key from the dashboard
- Paid tier: ~$15/month for 50 jobs/day

### 2. Install the Extension

**Option A: Load Unpacked (Developers)**

1. Download or clone this repository:
   ```bash
   git clone https://github.com/udirno/jobdigest.git
   cd jobdigest
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **"Load unpacked"**

5. Select the `jobdigest` folder (the one containing `manifest.json`)

6. The JobDigest icon should appear in your extensions toolbar

**Option B: Install from Chrome Web Store** (Coming soon)

### 3. Configure API Keys

1. Click the JobDigest extension icon in your toolbar

2. Complete the 3-step onboarding wizard:
   - **Step 1:** Enter your Claude API key
   - **Step 2:** Enter your Adzuna App ID and App Key
   - **Step 3:** Enter your JSearch API key

3. Click "Finish" to complete setup

### 4. Upload Your Resume

1. Click the settings icon (⚙️) in the extension

2. Scroll to the "Resume Management" section

3. Upload your resume:
   - **PDF or DOCX file** (drag & drop or click to upload)
   - **Or paste plain text** (50+ characters required)

4. Your resume is stored locally and used for AI scoring

### 5. Fetch Jobs

**Manual Fetch:**
1. Go to Settings → Job Fetching
2. Click **"Fetch Jobs Now"**
3. Wait 30-60 seconds for jobs to be fetched and scored

**Automatic Daily Fetch:**
- Jobs fetch automatically at 6 AM PST every day (customizable in settings)
- The extension must be installed for alarms to work

### 6. Browse and Track Jobs

1. Open the extension to see your dashboard

2. **Filter and sort** jobs:
   - Filter by status: All, New, Contacted, Applied, Passed
   - Sort by: Score, Date Posted, Company, Title

3. **Click any job card** to view details:
   - Full job description
   - AI reasoning for the score
   - 5-dimension breakdown (skills, experience, tech stack, title, industry)

4. **Track applications:**
   - Change status via dropdown (New → Contacted → Applied → Passed)
   - Add notes (auto-saves after you stop typing)
   - Set application date when marking as Applied
   - Dismiss jobs you're not interested in

5. **Generate content:**
   - Click "Generate Cover Letter" for a tailored 3-4 paragraph letter
   - Click "Generate Recruiter Message" for a concise <100 word message
   - Copy to clipboard or edit inline (changes auto-save)

6. **Export your data:**
   - Click "Export CSV" to download all tracked jobs
   - Includes job details, scores, notes, and generated content

---

## Features

### AI-Powered Scoring
- **0-100 score** based on resume match
- **5 dimensions evaluated:** Skills match, experience level, tech stack alignment, job title relevance, industry fit
- **AI reasoning** explains why each job scored the way it did

### Smart Job Fetching
- **Dual-source:** Adzuna + JSearch APIs
- **Daily cap:** 100 jobs/day to control costs
- **Adaptive distribution:** Balances quality across sources
- **Checkpoint recovery:** Resumes if browser closes mid-fetch

### Application Tracking
- **4 states:** New, Contacted, Applied, Passed
- **Notes:** Free-form text with 2,000 character limit (auto-saves)
- **Dates:** Track when you applied
- **Dismiss:** Hide jobs you're not interested in

### Content Generation
- **Cover letters:** 3-4 paragraphs tailored to job + resume
- **Recruiter messages:** <100 words, conversational tone
- **Anti-cliche prompts:** Avoids robotic AI language
- **Editable:** Modify generated content inline

### Privacy & Cost
- **Zero hosting costs:** Everything runs locally in your browser
- **Your data stays local:** All data stored in chrome.storage.local
- **You control API spending:** Use your own API keys
- **No tracking:** No analytics, no telemetry

---

## Troubleshooting

**Jobs not fetching?**
- Check API keys in Settings
- Verify daily cap hasn't been reached (100 jobs/day)
- Check browser console for errors (F12 → Console)

**Scoring not working?**
- Make sure you've uploaded a resume
- Verify Claude API key is valid
- Check that resume has 50+ characters

**Extension disappeared?**
- Chrome may have disabled it. Go to `chrome://extensions/` and re-enable
- Service worker may have terminated. Click the extension icon to restart

**Storage warning?**
- Export jobs to CSV and clear old data via Settings → Data Management
- Extension warns at 80% of 10MB storage quota

---

## Cost Breakdown

| Service | Free Tier | Paid Option | Recommended Usage |
|---------|-----------|-------------|-------------------|
| Claude API | $5 credit (first-time) | ~$10-12/month | 100 jobs/day scoring |
| Adzuna | 1,000 calls/month | N/A | 20 jobs/day |
| JSearch | 150 calls/month | $15/month (5,000 calls) | 30 jobs/day |

**Total:** ~$25-30/month for full usage (100 jobs/day)

---

## Development

Built with:
- **Manifest V3** Chrome Extension
- **Vanilla JavaScript** (no frameworks)
- **Claude Haiku 4.5** for AI scoring
- **PDF.js** and **mammoth.js** for resume parsing

**Codebase:** 7,550 lines of code across 22 files

---

## Support

- **Issues:** https://github.com/udirno/jobdigest/issues
- **Version:** v1 (shipped 2026-02-09)

---

## License

MIT License - See LICENSE file for details

---

**Eliminate 2+ hours of daily job browsing. Focus on high-quality matches. Track everything in one place.**
