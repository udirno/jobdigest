# Phase 5: Dashboard & UI - Research

**Researched:** 2026-02-06
**Domain:** Card-based dashboard UI with vanilla JavaScript
**Confidence:** HIGH

## Summary

This research investigates building a card-based job dashboard using vanilla JavaScript, CSS Grid, and the native HTML `<dialog>` element. The phase requires implementing responsive card grids, filtering/sorting controls, detail modals with navigation, and score visualization with accessibility compliance.

The standard approach for 2026 is to leverage modern CSS (Grid with `auto-fill` and `minmax()`, `line-clamp` for truncation) combined with vanilla JavaScript DOM manipulation and the production-ready native `<dialog>` element for modals. This eliminates library dependencies while maintaining accessibility and performance.

Key constraints from user decisions include minimalist black/sand brown theme, rich information cards with subtle score colors, responsive grid layout (1/2/3 columns), and specific quick actions (View Details, View Original, Status dropdown). The native `<dialog>` element provides built-in accessibility features (focus management, keyboard handling, inertness) that align with modern standards.

**Primary recommendation:** Use CSS Grid with `repeat(auto-fill, minmax(320px, 1fr))` for responsive cards, native `<dialog>` element for modals, and CSS `line-clamp` for description truncation. Implement virtual scrolling only if performance testing reveals issues with 100+ cards.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Card Layout & Density
- **Information richness**: Rich cards showing score, title, company, location, posted date, salary range, skills match %, and description preview
- **Score display**: Subtle color-coded badge (no emojis), clear numeric score, blends with black/sand brown theme using subtle red/yellow/green
- **Quick actions on card**: Three actions - View Details (modal), View Original (external link), Status dropdown (quick change)
- **Grid layout**: Responsive grid - 1 column on mobile, 2 on tablet, 3 on desktop
- **Design philosophy**: Minimalist but clear - should not look AI-generated in terms of text/branding

#### Score Visualization
- **Dimension breakdown**: Not visible on cards - only show overall score
- **Info tooltip**: Small hover tooltip on score badge explaining how score was calculated (for curious users)
- **Score colors**: Subtle red/yellow/green gradient matching the black/sand brown theme
- **AI reasoning**: Only in detail modal, not on cards
- **Description preview**: Smart extraction of key requirements/skills (not generic intro sentences)

#### Filtering & Sorting UX
- **Filter placement**: Claude's discretion based on best design principles
- **Available filters**: Just application status (New, Contacted, Applied, Passed) - keep it simple
- **Sort options**: Multiple - score, date posted, company name, title (user choice)
- **Default view**: All jobs, sorted by score (highest to lowest)

#### Detail Modal & Navigation
- **Modal size**: Claude's discretion based on best design principles
- **Modal content**: Description + score breakdown (full job description + 5 dimension scores with reasoning)
- **Navigation**: Previous/Next buttons to browse through jobs while modal is open
- **Empty state**: Helpful prompt - suggest manual fetch trigger or check settings

### Claude's Discretion
- **Filter placement**: Based on best design principles (research standard patterns)
- **Modal size**: Based on best design principles (research readable content width)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Grid | Native | Responsive card layout | Built-in, no dependencies, excellent browser support, auto-fill with minmax handles responsiveness automatically |
| HTML `<dialog>` | Native | Modal dialogs | Production-ready (Baseline since March 2022), built-in accessibility (focus trap, Esc handling, inertness), zero dependencies |
| CSS `line-clamp` | Native | Multi-line text truncation | Standard for description previews, clean ellipsis handling, no JavaScript required |
| Vanilla JavaScript | ES6+ | DOM manipulation & state | Zero bundle overhead, Chrome extension context, sufficient for dashboard interactions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Floating UI | 1.x | Tooltip positioning | Only if built-in CSS positioning insufficient for score tooltip |
| Virtual scroll library | 1.x+ | Large list optimization | Only if performance testing shows slowdown with 100+ cards (unlikely for popup dimensions) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<dialog>` | Custom modal with ARIA | More code, more maintenance, same result - native is superior |
| CSS Grid | Flexbox | Grid handles 2D layout better, cards align both horizontally and vertically |
| Vanilla JS | React/Vue | Adds bundle size (~40-100kb), overkill for simple dashboard, slows extension load time |

**Installation:**
```bash
# No installation needed - all native browser APIs
# If adding Floating UI for tooltip positioning:
npm install @floating-ui/dom
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── popup.html           # Main dashboard (already exists)
├── popup.css            # Design system (already exists)
├── popup.js             # Dashboard initialization (already exists, extend)
├── dashboard/
│   ├── job-card.js      # Card rendering logic
│   ├── job-modal.js     # Detail modal with navigation
│   ├── filters.js       # Filter & sort controls
│   └── empty-state.js   # Empty state messages
└── lib/                 # Third-party (already exists)
```

### Pattern 1: Responsive Grid with Auto-Fill
**What:** CSS Grid automatically creates as many columns as fit the viewport, wrapping cards to new rows
**When to use:** All card grid layouts where you want responsive behavior without media queries
**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/How_to/Layout_cookbook/Card */
.job-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 16px;
}

/* Individual card structure */
.job-card {
  display: grid;
  grid-template-rows: max-content 1fr max-content;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.job-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

### Pattern 2: Native Dialog Modal with Focus Management
**What:** Use HTML `<dialog>` element with `.showModal()` for automatic accessibility
**When to use:** All modal dialogs requiring focus trap, Esc handling, and backdrop
**Example:**
```html
<!-- Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog -->
<dialog id="job-detail-modal" class="job-modal">
  <div class="modal-header">
    <h2 id="modal-title">Job Title</h2>
    <form method="dialog">
      <button autofocus aria-label="Close">×</button>
    </form>
  </div>
  <div class="modal-content">
    <!-- Job details here -->
  </div>
  <div class="modal-navigation">
    <button id="prev-job">← Previous</button>
    <button id="next-job">Next →</button>
  </div>
</dialog>
```

```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
const modal = document.getElementById('job-detail-modal');

// Open modal (automatic focus management, inertness, Esc handling)
modal.showModal();

// Close modal (focus returns to trigger element)
modal.close();

// Listen for close event
modal.addEventListener('close', () => {
  console.log('Modal closed, focus restored');
});
```

### Pattern 3: Multi-line Text Truncation with Ellipsis
**What:** CSS `line-clamp` truncates text to specified number of lines with ellipsis
**When to use:** Job description previews, any multi-line text requiring length control
**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp */
.job-description-preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  line-height: 1.5;
  color: var(--text-secondary);
}
```

### Pattern 4: Accessible Color-Coded Score Badge
**What:** Badge with background and text color both shifted to maintain 4.5:1 contrast ratio
**When to use:** Score display requiring both color coding and WCAG AA compliance
**Example:**
```css
/* Source: https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025 */
.score-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  position: relative;
}

/* High score: subtle green */
.score-badge.high {
  background-color: rgba(46, 125, 50, 0.2);
  color: #81c784;
}

/* Medium score: subtle yellow */
.score-badge.medium {
  background-color: rgba(251, 192, 45, 0.2);
  color: #ffd54f;
}

/* Low score: subtle red */
.score-badge.low {
  background-color: rgba(211, 47, 47, 0.2);
  color: #e57373;
}
```

### Pattern 5: Filter & Sort Controls with Dropdown
**What:** Select dropdowns styled to match theme, positioned prominently at top of dashboard
**When to use:** Filtering and sorting controls where native `<select>` provides accessibility
**Example:**
```html
<div class="dashboard-controls">
  <div class="control-group">
    <label for="filter-status">Status:</label>
    <select id="filter-status" class="control-select">
      <option value="all">All Jobs</option>
      <option value="New">New</option>
      <option value="Contacted">Contacted</option>
      <option value="Applied">Applied</option>
      <option value="Passed">Passed</option>
    </select>
  </div>

  <div class="control-group">
    <label for="sort-by">Sort by:</label>
    <select id="sort-by" class="control-select">
      <option value="score">Score (High to Low)</option>
      <option value="date">Date Posted</option>
      <option value="company">Company Name</option>
      <option value="title">Job Title</option>
    </select>
  </div>
</div>
```

### Pattern 6: Empty State with Call to Action
**What:** Replace empty grid with informative message and suggested action
**When to use:** When no jobs match filters or no jobs exist yet
**Example:**
```html
<!-- Source: https://www.eleken.co/blog-posts/empty-state-ux -->
<div class="empty-state">
  <div class="empty-state-icon">
    <!-- Simple icon or illustration -->
    <svg>...</svg>
  </div>
  <h2 class="empty-state-title">No jobs yet</h2>
  <p class="empty-state-description">
    Jobs will appear here after your first fetch.
    Try triggering a manual fetch or check your search settings.
  </p>
  <button class="btn-primary" onclick="openSettings()">
    Adjust Search Settings
  </button>
</div>
```

### Anti-Patterns to Avoid
- **Over-complicating state management:** Don't introduce Redux/Zustand for simple filter/sort state - use local variables and URL params
- **Custom modals with ARIA:** Native `<dialog>` is production-ready and handles accessibility automatically - don't hand-roll
- **Rendering all cards regardless of count:** For 500+ cards, this causes lag - consider virtual scrolling (but test first, likely not needed for popup dimensions)
- **Color-only status indicators:** Color blindness affects 8% of men - always pair color with text/icon
- **Tight coupling to API response shape:** Job cards should work with normalized data, not raw API responses

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialogs | Custom div with ARIA, focus trap logic, backdrop click handling | Native `<dialog>` element with `.showModal()` | Built-in focus management, Esc handling, inertness, backdrop, ARIA role - 200+ lines of code vs 2 lines |
| Responsive grid breakpoints | Media queries for 1/2/3 columns | CSS Grid `repeat(auto-fill, minmax(320px, 1fr))` | Zero breakpoints, automatically adapts, fewer lines of code |
| Text truncation with ellipsis | JavaScript substring + "..." | CSS `line-clamp` with `-webkit-box` | Handles line height, word breaks, responsive resizing automatically |
| Tooltip positioning | Manual coordinate calculation for edge detection | CSS `position: absolute` with container positioning (or Floating UI if complex) | Browser handles viewport edges, no math required for simple tooltips |
| Virtual scrolling (if needed) | Custom scroll listener + DOM recycling | HyperList or similar tiny library (~300 lines) | Edge cases: variable heights, scroll momentum, resize handling |

**Key insight:** In 2026, native browser APIs (Grid, `<dialog>`, `line-clamp`) have matured to handle common UI patterns without libraries. Extensions benefit most from zero dependencies - smaller bundles, faster load times, fewer maintenance concerns.

## Common Pitfalls

### Pitfall 1: Forgetting Dialog Backdrop Styling
**What goes wrong:** Native `<dialog>` backdrop (::backdrop pseudo-element) is unstyled by default, appears as white or transparent
**Why it happens:** Developers test modal content styling but forget the backdrop needs explicit styling
**How to avoid:** Always style `dialog::backdrop` when using `.showModal()`
```css
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
```
**Warning signs:** Modal opens but background isn't dimmed/blurred

### Pitfall 2: Assuming Grid Creates Equal-Height Cards Across Rows
**What goes wrong:** Cards in different rows have different heights, layout looks uneven
**Why it happens:** CSS Grid aligns items within a row, but rows are independent
**How to avoid:** Accept this as correct behavior OR use `grid-auto-rows: 1fr` with min-height (can cause issues with varying content)
```css
/* Accept different row heights (recommended) */
.job-grid {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  grid-auto-rows: auto; /* Default, each row sizes to tallest card in that row */
}
```
**Warning signs:** Cards in row 1 are taller than row 2, but layout is actually correct

### Pitfall 3: Poor Color Contrast on Score Badges
**What goes wrong:** Subtle color-coded badges fail WCAG AA contrast requirements (4.5:1 for text)
**Why it happens:** Designing with "subtle" colors without testing actual contrast ratios
**How to avoid:** Use WebAIM Contrast Checker to verify all badge color combinations meet 4.5:1 ratio
**Warning signs:** Colors look nice but are hard to read in different lighting, fail accessibility audits

### Pitfall 4: Not Handling Empty Modal Navigation States
**What goes wrong:** Previous/Next buttons remain enabled when viewing first/last job, clicking causes errors
**Why it happens:** Forgetting to disable buttons based on current job index
**How to avoid:** Always update button disabled state when changing jobs
```javascript
function updateModalNavigation(currentIndex, totalJobs) {
  document.getElementById('prev-job').disabled = currentIndex === 0;
  document.getElementById('next-job').disabled = currentIndex === totalJobs - 1;
}
```
**Warning signs:** Console errors when clicking Next on last job, buttons don't appear disabled

### Pitfall 5: Excessive Animations Slowing Extension Popup
**What goes wrong:** Card hover effects, modal transitions, and filter animations cause lag on mid-range devices
**Why it happens:** Adding multiple CSS transitions/animations without considering Chrome extension popup performance constraints
**How to avoid:** Keep animations minimal and fast (≤200ms), test on lower-end hardware, use `transform` and `opacity` (GPU-accelerated)
```css
/* Good: GPU-accelerated, fast */
.job-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

/* Bad: Reflows, multiple properties, slow */
.job-card {
  transition: all 0.5s;
}
```
**Warning signs:** Popup feels sluggish when hovering/clicking cards, janky scrolling

### Pitfall 6: DOM Manipulation Without Fragments for Large Updates
**What goes wrong:** Rendering 100+ job cards one by one causes multiple reflows, slow initial render
**Why it happens:** Appending each card directly to DOM in loop
**How to avoid:** Use DocumentFragment to batch DOM updates
```javascript
// Good: Single DOM update
const fragment = document.createDocumentFragment();
jobs.forEach(job => {
  const card = createJobCard(job);
  fragment.appendChild(card);
});
jobGrid.appendChild(fragment);

// Bad: 100+ reflows
jobs.forEach(job => {
  const card = createJobCard(job);
  jobGrid.appendChild(card); // Reflow on each iteration
});
```
**Warning signs:** Slow initial dashboard load, janky rendering when filtering

### Pitfall 7: Not Using Form Method Dialog for Close Button
**What goes wrong:** Close button requires JavaScript event listener when native form method works
**Why it happens:** Not aware that `<form method="dialog">` automatically closes modal
**How to avoid:** Wrap close button in form with `method="dialog"`
```html
<!-- Good: Zero JavaScript -->
<dialog>
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>

<!-- Unnecessary: Requires JS -->
<dialog id="modal">
  <button onclick="modal.close()">Close</button>
</dialog>
```
**Warning signs:** Event listeners on close buttons when not needed

### Pitfall 8: Tooltip Accessibility for Keyboard Users
**What goes wrong:** CSS-only `:hover` tooltips don't work for keyboard navigation (`:focus` required)
**Why it happens:** Testing only with mouse, forgetting keyboard and screen reader users
**How to avoid:** Style both `:hover` AND `:focus` states, use `aria-describedby` to link tooltip
```css
/* Good: Both hover and focus */
.score-badge:hover .tooltip,
.score-badge:focus .tooltip {
  opacity: 1;
  visibility: visible;
}

/* Bad: Only hover */
.score-badge:hover .tooltip {
  opacity: 1;
}
```
**Warning signs:** Tooltips don't appear when tabbing through UI

## Code Examples

Verified patterns from official sources:

### Job Card Rendering with Data Attributes
```javascript
// Source: Vanilla JavaScript best practices
function createJobCard(job) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.dataset.jobId = job.jobId;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  // Score badge with color coding
  const scoreClass = job.score >= 80 ? 'high' : job.score >= 60 ? 'medium' : 'low';

  card.innerHTML = `
    <div class="card-header">
      <div class="score-badge ${scoreClass}" tabindex="0" aria-describedby="score-tooltip-${job.jobId}">
        ${job.score}
        <span class="tooltip" id="score-tooltip-${job.jobId}" role="tooltip">
          Score based on skills match, experience, tech stack, title relevance, and industry fit
        </span>
      </div>
      <select class="status-dropdown" data-job-id="${job.jobId}" aria-label="Job status">
        <option value="New" ${job.status === 'New' ? 'selected' : ''}>New</option>
        <option value="Contacted" ${job.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
        <option value="Applied" ${job.status === 'Applied' ? 'selected' : ''}>Applied</option>
        <option value="Passed" ${job.status === 'Passed' ? 'selected' : ''}>Passed</option>
      </select>
    </div>

    <div class="card-body">
      <h3 class="job-title">${escapeHtml(job.title)}</h3>
      <p class="job-company">${escapeHtml(job.company)}</p>
      <p class="job-location">${escapeHtml(job.location)}</p>
      <p class="job-meta">
        Posted: ${formatDate(job.created)} ${job.salary_min ? `• $${job.salary_min}k+` : ''}
      </p>
      <p class="job-description-preview">
        ${extractKeyRequirements(job.description)}
      </p>
    </div>

    <div class="card-footer">
      <button class="btn-view-details" data-job-id="${job.jobId}">View Details</button>
      <a href="${job.redirect_url}" target="_blank" class="btn-view-original" rel="noopener noreferrer">
        View Original ↗
      </a>
    </div>
  `;

  // Add click handler for card
  card.addEventListener('click', (e) => {
    // Don't open modal if clicking on buttons/links/select
    if (e.target.closest('.status-dropdown, .btn-view-original')) return;
    openJobModal(job.jobId);
  });

  // Add keyboard handler
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openJobModal(job.jobId);
    }
  });

  return card;
}

// HTML escaping for security
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Extract key requirements from description (simple heuristic)
function extractKeyRequirements(description) {
  // Look for sentences containing requirement keywords
  const keywords = ['require', 'must have', 'experience with', 'skills', 'knowledge of'];
  const sentences = description.split(/[.!?]+/).map(s => s.trim());

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some(keyword => lower.includes(keyword))) {
      return sentence;
    }
  }

  // Fallback: First 150 characters
  return description.substring(0, 150);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}
```

### Native Dialog Modal with Navigation
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
const modal = document.getElementById('job-detail-modal');
let currentJobs = [];
let currentJobIndex = 0;

function openJobModal(jobId) {
  // Load jobs in current sort order
  currentJobs = getFilteredAndSortedJobs();
  currentJobIndex = currentJobs.findIndex(job => job.jobId === jobId);

  renderModalContent(currentJobs[currentJobIndex]);
  updateModalNavigation();
  modal.showModal();
}

function renderModalContent(job) {
  const modalTitle = modal.querySelector('#modal-title');
  const modalBody = modal.querySelector('.modal-body');

  modalTitle.textContent = `${job.title} at ${job.company}`;

  modalBody.innerHTML = `
    <div class="modal-meta">
      <span>${job.location}</span>
      <span>Posted: ${formatDate(job.created)}</span>
      ${job.salary_min ? `<span>Salary: $${job.salary_min}k - $${job.salary_max}k</span>` : ''}
    </div>

    <div class="score-breakdown">
      <h3>Score: ${job.score}</h3>
      <div class="dimension-scores">
        <div class="dimension">
          <span>Skills Match:</span>
          <span class="dimension-score">${job.scoreDetails.skills_match}/100</span>
          <p class="dimension-reasoning">${job.scoreReasoning.skills_match || 'N/A'}</p>
        </div>
        <div class="dimension">
          <span>Experience Level:</span>
          <span class="dimension-score">${job.scoreDetails.experience_level}/100</span>
          <p class="dimension-reasoning">${job.scoreReasoning.experience_level || 'N/A'}</p>
        </div>
        <div class="dimension">
          <span>Tech Stack:</span>
          <span class="dimension-score">${job.scoreDetails.tech_stack_alignment}/100</span>
          <p class="dimension-reasoning">${job.scoreReasoning.tech_stack_alignment || 'N/A'}</p>
        </div>
        <div class="dimension">
          <span>Title Relevance:</span>
          <span class="dimension-score">${job.scoreDetails.title_relevance}/100</span>
          <p class="dimension-reasoning">${job.scoreReasoning.title_relevance || 'N/A'}</p>
        </div>
        <div class="dimension">
          <span>Industry Fit:</span>
          <span class="dimension-score">${job.scoreDetails.industry_fit}/100</span>
          <p class="dimension-reasoning">${job.scoreReasoning.industry_fit || 'N/A'}</p>
        </div>
      </div>
    </div>

    <div class="job-description">
      <h3>Full Description</h3>
      <div class="description-text">${escapeHtml(job.description).replace(/\n/g, '<br>')}</div>
    </div>
  `;
}

function updateModalNavigation() {
  const prevBtn = document.getElementById('prev-job');
  const nextBtn = document.getElementById('next-job');

  prevBtn.disabled = currentJobIndex === 0;
  nextBtn.disabled = currentJobIndex === currentJobs.length - 1;

  // Update counter
  document.getElementById('modal-counter').textContent =
    `${currentJobIndex + 1} of ${currentJobs.length}`;
}

// Navigation handlers
document.getElementById('prev-job').addEventListener('click', () => {
  if (currentJobIndex > 0) {
    currentJobIndex--;
    renderModalContent(currentJobs[currentJobIndex]);
    updateModalNavigation();
  }
});

document.getElementById('next-job').addEventListener('click', () => {
  if (currentJobIndex < currentJobs.length - 1) {
    currentJobIndex++;
    renderModalContent(currentJobs[currentJobIndex]);
    updateModalNavigation();
  }
});

// Keyboard navigation in modal
modal.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && currentJobIndex > 0) {
    e.preventDefault();
    document.getElementById('prev-job').click();
  } else if (e.key === 'ArrowRight' && currentJobIndex < currentJobs.length - 1) {
    e.preventDefault();
    document.getElementById('next-job').click();
  }
});
```

### Filter & Sort Implementation
```javascript
// Filter and sort state (local variables, not global state)
let currentFilter = 'all';
let currentSort = 'score';

function initDashboardControls() {
  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderJobGrid();
  });

  document.getElementById('sort-by').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderJobGrid();
  });
}

function getFilteredAndSortedJobs() {
  const allJobs = Object.values(storage.getJobs()); // Sync access for extension

  // Filter
  let filtered = currentFilter === 'all'
    ? allJobs
    : allJobs.filter(job => job.status === currentFilter);

  // Sort
  filtered.sort((a, b) => {
    switch (currentSort) {
      case 'score':
        return (b.score || 0) - (a.score || 0); // High to low
      case 'date':
        return new Date(b.created) - new Date(a.created); // Newest first
      case 'company':
        return a.company.localeCompare(b.company);
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  return filtered;
}

async function renderJobGrid() {
  const grid = document.getElementById('job-grid');
  const emptyState = document.getElementById('empty-state');

  const jobs = getFilteredAndSortedJobs();

  if (jobs.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    updateEmptyStateMessage();
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  // Batch DOM updates with DocumentFragment
  const fragment = document.createDocumentFragment();
  jobs.forEach(job => {
    fragment.appendChild(createJobCard(job));
  });

  grid.innerHTML = '';
  grid.appendChild(fragment);
}

function updateEmptyStateMessage() {
  const emptyState = document.getElementById('empty-state');
  const title = emptyState.querySelector('.empty-state-title');
  const description = emptyState.querySelector('.empty-state-description');

  if (currentFilter !== 'all') {
    title.textContent = `No ${currentFilter} jobs`;
    description.textContent = 'Try adjusting your filter to see more jobs.';
  } else {
    title.textContent = 'No jobs yet';
    description.textContent = 'Jobs will appear here after your first fetch. Try triggering a manual fetch or check your search settings.';
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom modal with ARIA | Native `<dialog>` element | March 2022 (Baseline) | Eliminates 200+ lines of focus trap, keyboard, backdrop code |
| Media queries for responsive grid | CSS Grid `auto-fill` + `minmax()` | 2017 (Grid spec finalized) | Zero breakpoints, automatically responsive |
| JavaScript truncation | CSS `line-clamp` | 2020 (Webkit prefix stable) | No JS required, handles resize/reflow automatically |
| Framework for simple dashboard | Vanilla JavaScript | Ongoing (Manifest V3 push) | 40-100kb smaller bundle, faster extension load |
| jQuery for DOM manipulation | Native DOM APIs (querySelector, etc.) | 2015+ (ES6 adoption) | Zero dependencies, modern APIs are ergonomic |

**Deprecated/outdated:**
- **jQuery:** Modern DOM APIs (querySelector, classList, etc.) match jQuery ergonomics with zero dependencies
- **Bootstrap Grid:** CSS Grid is more powerful, flexible, and requires no library
- **Custom modal libraries (pre-dialog):** A11y-dialog, Micromodal were needed before `<dialog>` but now add overhead
- **Vendor prefixes for Grid:** Grid is unprefixed and stable across all browsers since 2017

## Open Questions

Things that couldn't be fully resolved:

1. **Virtual Scrolling Necessity**
   - What we know: Virtual scrolling reduces DOM nodes for 1000+ items, improves scroll performance
   - What's unclear: Whether Chrome extension popup dimensions (400px width, ~600px height) with typical 50-200 jobs will ever need virtual scrolling
   - Recommendation: **Implement without virtual scrolling first, add performance test task to verify scroll performance with 200+ cards. Only add virtual scrolling if tests show issues.**

2. **Smart Description Extraction Algorithm**
   - What we know: User wants "key requirements/skills" not "generic intro sentences" in description preview
   - What's unclear: Best heuristic for extracting relevant sentences without LLM or NLP library (would add dependencies)
   - Recommendation: **Start with keyword-based sentence matching (look for "require", "must have", "experience with"). Plan refinement task based on user feedback after initial implementation.**

3. **Tooltip Library Necessity**
   - What we know: Simple CSS tooltips work for basic hover/focus, Floating UI handles complex positioning
   - What's unclear: Whether score badge tooltip needs smart positioning or if simple CSS is sufficient
   - Recommendation: **Try CSS-only tooltip first (positioned relative to badge). Add Floating UI only if tooltips get cut off at viewport edges.**

4. **Status Dropdown vs Button Group**
   - What we know: User specified "Status dropdown" for quick status change on card
   - What's unclear: Whether native `<select>` styling will match minimalist theme or if custom dropdown needed
   - Recommendation: **Use native `<select>` with custom CSS styling (background, border, accent color). Custom dropdown only if styling limitations discovered.**

## Sources

### Primary (HIGH confidence)
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog - Dialog element browser support, accessibility features, API usage
- https://developer.mozilla.org/en-US/docs/Web/CSS/How_to/Layout_cookbook/Card - MDN card layout patterns with CSS Grid
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-clamp - Line clamp for text truncation
- https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025 - Color contrast accessibility standards (WCAG AA 4.5:1)

### Secondary (MEDIUM confidence)
- https://www.eleken.co/blog-posts/empty-state-ux - Empty state design principles (verified pattern)
- https://www.nngroup.com/articles/empty-state-interface-design/ - NN/G empty state guidelines (authoritative UX source)
- https://van11y.net/accessible-simple-tooltip/ - Accessible tooltip patterns with ARIA
- https://sergimansilla.com/blog/virtual-scrolling/ - Virtual scrolling implementation guide (if needed)
- https://css-tricks.com/css-grid-layout-guide/ - CSS Grid comprehensive guide
- https://webaim.org/resources/contrastchecker/ - WebAIM contrast checking tool

### Tertiary (LOW confidence - not used for core recommendations)
- Various WebSearch results on custom dropdown styling, job card design trends
- Community blog posts on vanilla JavaScript dashboard patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations based on MDN official docs and native browser APIs with verified Baseline status
- Architecture: HIGH - CSS Grid patterns from MDN, native dialog patterns from MDN, established vanilla JS patterns
- Pitfalls: MEDIUM-HIGH - Common pitfalls derived from MDN documentation notes and WebSearch verified patterns, some based on general extension development experience

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain, native APIs change slowly)
