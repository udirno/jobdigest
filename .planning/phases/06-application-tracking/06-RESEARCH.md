# Phase 6: Application Tracking - Research

**Researched:** 2026-02-06
**Domain:** Chrome extension state management, form auto-save, date input, and UI feedback patterns
**Confidence:** HIGH

## Summary

This phase adds application tracking functionality to the existing job dashboard by extending the job data model with tracking fields (notes, applicationDate, dismissed) and building UI for status transitions, note-taking, date capture, and dismiss/hide functionality. The research focused on Chrome extension storage patterns, debounced auto-save, HTML5 date inputs, character-limited textareas, and reversible action UX patterns.

The standard approach leverages existing chrome.storage.local infrastructure, native HTML5 form elements for accessibility, vanilla JavaScript debouncing for auto-save, and established UX patterns for destructive actions (soft delete with undo toast). The job data model already has a `status` field initialized to 'new'—this phase extends it to support the full workflow (new → contacted → applied → passed) and adds supplementary tracking fields.

Key technical decisions hinge on balancing user expectations (immediate feedback, forgiving UX) with implementation simplicity (no external libraries, leverage existing patterns from Phase 5). The research validates that native browser APIs and simple debounce patterns handle the requirements without additional dependencies.

**Primary recommendation:** Extend existing job objects with tracking fields, use native HTML5 date input with keyboard-accessible default value, implement debounced auto-save for notes (1 second delay), and use undo toast pattern for dismiss actions to maintain forgiving UX.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status workflow & transitions:**
- Users can skip states (New → Applied directly without Contacted) - real applications don't always follow linear paths
- "Passed" status is a final state - auto-hides jobs from main view like dismiss (accessible via filter)
- Status transitions allowed in any direction (Claude's discretion on validation/warnings)
- Application date handling when marking as Applied (Claude's discretion on required vs optional)

**Notes & date capture:**
- Notes have 2000 character limit to prevent storage bloat and encourage concise tracking
- Notes auto-save with debounced persistence (~1 second after user stops typing) - no explicit Save button
- Application dates captured via date picker defaulting to today when user marks job as Applied
- Text formatting for notes (Claude's discretion: plain text vs basic formatting based on complexity tradeoff)

**Dismiss/hide behavior:**
- Dismiss reversibility (Claude's discretion: permanent vs archive view)
- Dismiss action location in UI (Claude's discretion: card, modal, or both)
- Dismiss confirmation pattern (Claude's discretion: immediate, undo toast, or confirmation dialog)
- Dismissed jobs and daily cap interaction (Claude's discretion: count toward 100/day or exclude)

### Claude's Discretion

- Whether status changes backward should show warnings
- Whether to require application date when marking as Applied
- Notes text formatting (plain vs markdown vs rich text)
- Dismiss reversibility and UI placement
- How cards indicate notes presence (icon, preview, or none)
- Whether application dates appear on cards or modal only
- Where notes editing appears (card, modal, or both)
- Whether status dropdown stays on cards or moves to modal

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chrome.storage.local | Manifest v3 | Persistent storage for job tracking data | Built-in extension API, 10MB quota, automatic persistence |
| HTML5 `<input type="date">` | HTML5 | Date picker with keyboard accessibility | Native browser support, automatic validation, mobile-friendly |
| HTML5 `<textarea>` | HTML5 | Multi-line text input for notes | Universal support, accessibility built-in |
| Native `<dialog>` | HTML5 | Modal dialogs for job details and confirmations | Modern standard (Chrome 37+), no dependencies, automatic accessibility |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vanilla JS debounce | ES6+ | Auto-save delay for notes | Reduce storage writes, wait for user pause in typing |
| CSS transitions | CSS3 | Toast notification animations | Visual feedback for dismiss/undo actions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native date input | Third-party date picker (flatpickr, react-datepicker) | Native has accessibility/mobile support built-in; third-party offers more styling control but adds bundle size and complexity |
| Vanilla debounce | Lodash debounce | Lodash provides battle-tested implementation but adds 24KB; vanilla pattern is 5 lines and sufficient for this use case |
| Soft delete (dismissed flag) | Hard delete (remove from storage) | Soft delete allows undo and data recovery; hard delete saves storage but is irreversible |

**Installation:**

No additional npm packages required—all functionality uses native browser APIs and existing project infrastructure.

## Architecture Patterns

### Data Model Extension

Extend existing job object schema with tracking fields:

```javascript
// Current job object (from Phase 3-5)
{
  jobId: 'adzuna-12345',
  source: 'adzuna',
  title: 'Software Engineer',
  company: 'Acme Corp',
  status: 'new',  // ← Already exists
  score: 85,
  // ... other fields
}

// Extended for Phase 6
{
  // ... existing fields
  status: 'new' | 'contacted' | 'applied' | 'passed',
  notes: '',  // ← NEW: Free-form text, 2000 char max
  applicationDate: null,  // ← NEW: ISO date string or null
  dismissed: false  // ← NEW: Soft delete flag
}
```

**Migration strategy:** Fields are optional and default to falsy values. Existing jobs work without migration—new fields populate on first user interaction.

### Pattern 1: Debounced Auto-Save

**What:** Delay storage writes until user pauses typing (1 second idle threshold)

**When to use:** Any text input that persists to storage (notes field)

**Example:**

```javascript
// Source: Vanilla JS pattern from MDN/community best practices
let saveTimeout = null;

function handleNotesInput(event, jobId) {
  const notes = event.target.value;

  // Clear previous timer
  if (saveTimeout) clearTimeout(saveTimeout);

  // Set new timer
  saveTimeout = setTimeout(async () => {
    const jobs = await storage.getJobs();
    if (jobs[jobId]) {
      jobs[jobId].notes = notes;
      await storage.saveJob(jobId, jobs[jobId]);
      console.log(`Auto-saved notes for ${jobId}`);
    }
  }, 1000);  // 1 second debounce
}
```

### Pattern 2: HTML5 Date Input with Default

**What:** Native date picker with today's date pre-filled

**When to use:** Application date capture when user marks job as "Applied"

**Example:**

```javascript
// Source: MDN Web Docs - Setting default date value
const dateInput = document.createElement('input');
dateInput.type = 'date';
dateInput.id = 'application-date';

// Set default to today
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
dateInput.value = today;

// User can backdate or keep today
dateInput.addEventListener('change', async (e) => {
  const jobs = await storage.getJobs();
  if (jobs[jobId]) {
    jobs[jobId].applicationDate = e.target.value;
    await storage.saveJob(jobId, jobs[jobId]);
  }
});
```

### Pattern 3: Undo Toast for Dismiss

**What:** Show confirmation toast with undo button after dismiss action

**When to use:** Destructive actions that should be reversible (dismiss job)

**Example:**

```javascript
// Source: Material Design pattern, adapted for vanilla JS
function showUndoToast(message, undoCallback) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span>${message}</span>
    <button class="undo-btn">Undo</button>
  `;

  document.body.appendChild(toast);

  let undone = false;

  // Undo button handler
  toast.querySelector('.undo-btn').addEventListener('click', () => {
    undone = true;
    undoCallback();
    toast.remove();
  });

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    if (!undone) toast.remove();
  }, 4000);
}

// Usage
async function dismissJob(jobId) {
  const jobs = await storage.getJobs();
  const originalState = jobs[jobId].dismissed;

  jobs[jobId].dismissed = true;
  await storage.saveJob(jobId, jobs[jobId]);

  showUndoToast('Job dismissed', async () => {
    jobs[jobId].dismissed = originalState;
    await storage.saveJob(jobId, jobs[jobId]);
    await renderJobGrid();  // Refresh UI
  });

  await renderJobGrid();  // Remove from view
}
```

### Pattern 4: Character Counter for Textarea

**What:** Live character count display below textarea showing remaining characters

**When to use:** Text inputs with length limits (notes field with 2000 char max)

**Example:**

```javascript
// Source: U.S. Web Design System (USWDS) character count pattern
function createNotesField(jobId, currentNotes = '') {
  const container = document.createElement('div');
  container.className = 'notes-field';

  const textarea = document.createElement('textarea');
  textarea.maxLength = 2000;
  textarea.value = currentNotes;
  textarea.placeholder = 'Add notes about this job...';

  const counter = document.createElement('div');
  counter.className = 'char-counter';

  function updateCounter() {
    const remaining = 2000 - textarea.value.length;
    counter.textContent = `${remaining} characters remaining`;

    // Visual warning as user approaches limit
    if (remaining < 100) {
      counter.classList.add('warning');
    } else {
      counter.classList.remove('warning');
    }
  }

  textarea.addEventListener('input', (e) => {
    updateCounter();
    handleNotesInput(e, jobId);  // Debounced auto-save
  });

  updateCounter();
  container.append(textarea, counter);
  return container;
}
```

### Pattern 5: Status Transition Handling

**What:** Update job status with immediate persistence, no validation constraints

**When to use:** Status dropdown changes on job card or in modal

**Example:**

```javascript
// Source: Existing pattern from Phase 5 job-card.js
// Already implemented—Phase 6 just extends available statuses

const statusDropdown = card.querySelector('.status-dropdown');
statusDropdown.addEventListener('change', async (e) => {
  e.stopPropagation();  // Don't trigger card click
  const newStatus = e.target.value;

  const jobs = await storage.getJobs();
  if (jobs[jobId]) {
    jobs[jobId].status = newStatus;

    // If marking as Applied, prompt for application date
    if (newStatus === 'applied' && !jobs[jobId].applicationDate) {
      // Show date input in modal or inline
    }

    await storage.saveJob(jobId, jobs[jobId]);
  }
});
```

### Anti-Patterns to Avoid

- **Synchronous storage writes on every keystroke:** Use debouncing instead—chrome.storage.local writes are async and rate-limited
- **Hard delete for dismiss:** Use soft delete (dismissed flag) to enable undo and maintain data for analytics
- **Custom date picker implementation:** Use native HTML5 date input for accessibility and mobile support
- **Confirmation dialog for every dismiss:** Use undo toast pattern—faster workflow, still reversible
- **Storing notes in separate storage key:** Keep notes as job object property for atomic updates and simpler data model

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text debouncing | Custom timer management with edge case handling | Simple setTimeout pattern (5 lines) | Edge cases include: clearing timer on unmount, handling rapid clear/reset, multiple fields interfering. Pattern is trivial but easy to get wrong. |
| Date picker UI | Custom calendar widget with month/year navigation | Native `<input type="date">` | Handles keyboard navigation, screen readers, mobile touch targets, localization, date validation automatically. Custom implementations often fail WCAG. |
| Character counter | Manual string.length tracking | Standard pattern with visual feedback | Must handle: unicode characters, line breaks, paste events, maxLength enforcement, accessibility announcements. |
| Toast positioning | Absolute positioning with z-index management | CSS fixed position with flexbox stacking | Browser handles viewport boundaries, scroll behavior, mobile keyboards automatically. |
| Undo queue | Custom stack with timer management | Single-undo with 4-second timeout | Most users only need to undo the last action. Complex undo history adds cognitive load and implementation complexity. |

**Key insight:** Browser APIs have evolved to handle common UI patterns with accessibility baked in. Custom implementations may look simpler initially but lack keyboard navigation, screen reader support, mobile responsiveness, and cross-browser compatibility testing. The "simple" custom solution becomes complex when accessibility and edge cases emerge.

## Common Pitfalls

### Pitfall 1: Storage Quota Exceeded

**What goes wrong:** Extension hits 10MB chrome.storage.local limit and all writes fail silently (or throw errors)

**Why it happens:** Job descriptions are large (average 1-2KB each). Notes add more data. 2000 char limit helps but doesn't prevent quota issues at scale (5000+ jobs).

**How to avoid:**
- Monitor storage usage with `chrome.storage.local.getBytesInUse()`
- Implement cleanup for old/dismissed jobs (auto-archive jobs older than 90 days)
- User already has `unlimitedStorage` permission in manifest (confirmed)—this raises limit significantly but still finite

**Warning signs:**
- Storage writes fail with "QUOTA_BYTES" error
- Jobs save initially but fail after reaching threshold
- User reports "my notes aren't saving"

### Pitfall 2: Race Conditions in Debounced Auto-Save

**What goes wrong:** User types in notes field, immediately closes modal before debounce timer fires—notes are lost

**Why it happens:** Debounce delays save by 1 second. Modal close event doesn't trigger immediate flush of pending save.

**How to avoid:**
- Add "beforeunload" or modal close listener that flushes pending saves
- Clear debounce timer and save immediately on modal close

```javascript
modal.addEventListener('close', async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    // Flush pending save immediately
    const textarea = modal.querySelector('textarea[data-job-id]');
    if (textarea) {
      const jobId = textarea.dataset.jobId;
      await saveNotes(jobId, textarea.value);
    }
  }
});
```

**Warning signs:**
- User reports "sometimes my notes don't save"
- Occurs specifically when user types and immediately closes modal/popup

### Pitfall 3: HTML5 Date Input Browser Inconsistencies

**What goes wrong:** Date input renders differently across browsers—Chrome shows calendar widget, Safari shows text field with native picker, older browsers show text input with no validation

**Why it happens:** HTML5 date input has universal support (2026) but visual presentation varies. Keyboard accessibility also differs between browsers.

**How to avoid:**
- Use feature detection and provide fallback pattern (YYYY-MM-DD placeholder)
- Test keyboard navigation on Chrome, Firefox, Safari
- Don't rely on specific visual appearance (calendar icon, dropdown)

```javascript
// Feature detection
const supportsDateInput = (() => {
  const input = document.createElement('input');
  input.type = 'date';
  return input.type === 'date';
})();

if (!supportsDateInput) {
  // Provide text input with validation and hint
  input.type = 'text';
  input.placeholder = 'YYYY-MM-DD';
  input.pattern = '\\d{4}-\\d{2}-\\d{2}';
}
```

**Warning signs:**
- User reports "I can't select a date"
- Accessibility audit fails on date input (screen reader can't activate picker)

### Pitfall 4: Toast Notification Inaccessibility

**What goes wrong:** Screen reader users don't hear toast messages; keyboard users can't focus undo button before toast auto-dismisses

**Why it happens:** Toast appears dynamically, auto-dismisses on timer, doesn't trap focus or announce to assistive tech

**How to avoid:**
- Use ARIA live region for toast container (`role="status"` or `aria-live="polite"`)
- Give toast longer timeout (4 seconds minimum, 6 seconds recommended)
- Make undo button keyboard-focusable immediately on toast appearance
- Pause auto-dismiss timer when toast has focus

```javascript
// Accessible toast
const toast = document.createElement('div');
toast.setAttribute('role', 'status');
toast.setAttribute('aria-live', 'polite');
toast.setAttribute('aria-atomic', 'true');

const undoBtn = toast.querySelector('.undo-btn');
undoBtn.focus();  // Immediate focus for keyboard users

// Pause timer on focus
toast.addEventListener('focusin', () => clearTimeout(dismissTimer));
toast.addEventListener('focusout', () => {
  dismissTimer = setTimeout(() => toast.remove(), 4000);
});
```

**Warning signs:**
- Screen reader doesn't announce toast message
- User can't tab to undo button in time
- WCAG audit fails (insufficient time to interact)

### Pitfall 5: Dismissed Jobs Confusion

**What goes wrong:** User dismisses job, doesn't see it in main view, assumes it's deleted forever, complains they can't recover it

**Why it happens:** "Dismiss" UI doesn't clarify that action is reversible or where dismissed jobs can be found

**How to avoid:**
- Use clear language: "Hide" or "Archive" instead of "Dismiss" (less permanent connotation)
- Add filter toggle to show dismissed jobs: "Show hidden jobs" checkbox
- Toast message says "Job hidden • Undo" (clarifies action)
- Settings panel shows count of hidden jobs with "View hidden" link

**Warning signs:**
- User support requests asking "how do I get back a job I dismissed?"
- User doesn't understand difference between "dismissed" and "passed"

## Code Examples

Verified patterns from official sources:

### Status Dropdown with All States

```javascript
// Source: Extending existing pattern from Phase 5 job-card.js
<select class="status-dropdown" data-job-id="${job.jobId}" aria-label="Job status">
  <option value="new" ${job.status === 'new' ? 'selected' : ''}>New</option>
  <option value="contacted" ${job.status === 'contacted' ? 'selected' : ''}>Contacted</option>
  <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>Applied</option>
  <option value="passed" ${job.status === 'passed' ? 'selected' : ''}>Passed</option>
</select>
```

### Character-Limited Textarea with Counter

```javascript
// Source: U.S. Web Design System character count pattern
function renderNotesSection(job) {
  return `
    <div class="notes-section">
      <label for="notes-${job.jobId}">Notes</label>
      <textarea
        id="notes-${job.jobId}"
        maxlength="2000"
        placeholder="Add notes about this job..."
        aria-describedby="counter-${job.jobId}"
      >${escapeHtml(job.notes || '')}</textarea>
      <div id="counter-${job.jobId}" class="char-counter" aria-live="polite">
        <span class="count">${(job.notes || '').length}</span> / 2000 characters
      </div>
    </div>
  `;
}
```

### Application Date Input (Conditional Display)

```javascript
// Source: MDN Web Docs - HTML date input
function renderApplicationDateField(job) {
  if (job.status !== 'applied') return '';

  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="app-date-field">
      <label for="app-date-${job.jobId}">Application Date</label>
      <input
        type="date"
        id="app-date-${job.jobId}"
        value="${job.applicationDate || today}"
        max="${today}"
        data-job-id="${job.jobId}"
      >
    </div>
  `;
}
```

### Dismiss with Undo Toast

```javascript
// Source: Material Design confirmation-acknowledgement pattern
async function dismissJob(jobId) {
  const jobs = await storage.getJobs();
  const job = jobs[jobId];

  // Soft delete
  job.dismissed = true;
  await storage.saveJob(jobId, job);

  // Show toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span>Job hidden</span>
    <button class="toast-undo">Undo</button>
  `;

  document.body.appendChild(toast);

  let dismissed = false;

  toast.querySelector('.toast-undo').addEventListener('click', async () => {
    job.dismissed = false;
    await storage.saveJob(jobId, job);
    toast.remove();
    await renderJobGrid();
  });

  setTimeout(() => {
    if (!dismissed) toast.remove();
  }, 4000);

  await renderJobGrid();
}
```

### Filter to Show Dismissed Jobs

```javascript
// Source: Common filter pattern for archived/hidden items
function createDismissedToggle() {
  const toggle = document.createElement('label');
  toggle.className = 'filter-toggle';
  toggle.innerHTML = `
    <input type="checkbox" id="show-dismissed" />
    <span>Show hidden jobs</span>
  `;

  toggle.querySelector('input').addEventListener('change', async (e) => {
    const showDismissed = e.target.checked;
    await renderJobGrid({ includeDismissed: showDismissed });
  });

  return toggle;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom date picker libraries (jQuery UI, flatpickr) | Native HTML5 `<input type="date">` | ~2020 (universal browser support) | Native input eliminates 50KB+ bundle size, provides automatic accessibility, works on mobile without custom touch handling |
| Lodash/Underscore debounce | Vanilla JS setTimeout pattern | 2021+ (modern bundlers, ES6 adoption) | Removes 24KB dependency for 5-line pattern; debounce is trivial with modern JavaScript |
| Confirmation modals for all destructive actions | Undo toast for reversible actions | 2023+ (Material Design 3, iOS patterns) | Faster workflow, less friction, maintains data safety; confirmation reserved for truly irreversible actions |
| Hard delete with confirmation | Soft delete with archive view | 2024+ (data retention, user trust) | Users trust product more when data is recoverable; enables future analytics/ML features |

**Deprecated/outdated:**
- **Moment.js for date formatting:** Replaced by native `Intl.DateTimeFormat` and `Date.toISOString()` (Moment.js discontinued, 70KB bundle)
- **Custom toast libraries (Toastr, Noty):** Replaced by simple vanilla JS patterns with CSS transitions (<5KB total)
- **State machine libraries (XState) for status transitions:** Overkill for simple linear workflow; plain object property updates sufficient

## Open Questions

Things that couldn't be fully resolved:

1. **Storage quota monitoring strategy**
   - What we know: Chrome storage.local has 10MB limit (higher with unlimitedStorage permission); jobs + notes + scores will accumulate over time
   - What's unclear: Exact threshold for warning user, auto-cleanup policy (delete jobs older than X days?), UI for managing storage
   - Recommendation: Implement storage monitoring utility that checks usage on popup open; warn at 80% full; provide manual cleanup UI in settings; defer automatic cleanup policies to Phase 7+

2. **Dismissed jobs and daily cap interaction**
   - What we know: Daily cap is 100 jobs fetched per day; dismissed jobs clutter storage but user doesn't see them
   - What's unclear: Should dismissed jobs count toward 100/day? Should they be auto-deleted after N days? Should they be excluded from daily cap calculations?
   - Recommendation: Dismissed jobs count toward daily cap (simpler logic); add filter to view dismissed jobs; implement manual "clear dismissed jobs" button in settings; defer automatic deletion to Phase 7

3. **Notes presence indicator on cards**
   - What we know: Users need to know which jobs have notes without opening modal; indicator should be subtle to avoid visual clutter
   - What's unclear: Icon only? Preview first 50 chars? Badge count?
   - Recommendation: Small note icon (📝) in card footer next to "View Details" button; tooltip on hover shows first 100 chars; full notes in modal. This balances discoverability with visual simplicity.

4. **Application date required vs optional**
   - What we know: Users want to track when they applied; date picker defaults to today; not all users apply immediately after marking "applied"
   - What's unclear: Should application date be required when status changes to "applied"? Or optional field that can be filled later?
   - Recommendation: Optional field shown when status is "applied"; defaults to today but can be left empty; user can backdate later. This allows for flexible workflows (user marks "applied" to track intent, fills date when actually applied).

5. **Plain text vs formatted notes**
   - What we know: 2000 char limit keeps storage manageable; most tracking notes are brief bullet points or reminders
   - What's unclear: Would basic markdown (bold, links) add value without complexity? Or keep plain text for simplicity?
   - Recommendation: Start with plain text in Phase 6; if users request formatting in feedback, add basic markdown support in Phase 7. Plain text is simpler, sufficient for 90% of use cases, and avoids security concerns (XSS from stored markdown).

## Sources

### Primary (HIGH confidence)

- [Chrome for Developers - chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Official API documentation for storage methods, limits, and patterns
- [MDN Web Docs - HTML input type="date"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date) - HTML5 date input specification and usage
- [Chrome for Developers - Storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) - Best practices for extension storage

### Secondary (MEDIUM confidence)

- [U.S. Web Design System - Character Count Component](https://designsystem.digital.gov/components/character-count/) - Government design system pattern for character counters
- [Material Design - Confirmation & Acknowledgement Patterns](https://m1.material.io/patterns/confirmation-acknowledgement.html) - UX patterns for destructive actions and undo
- [NN/G - Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/) - Research on when to use confirmation vs undo patterns
- [LogRocket - Toast Notifications Best Practices](https://blog.logrocket.com/ux-design/toast-notifications/) - UX guidelines for toast implementation
- [LogRocket - UX for Reversible Actions Framework](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework) - Decision framework for undo vs confirmation patterns

### Tertiary (LOW confidence)

- [FreeCodeCamp - JavaScript Debounce Example](https://www.freecodecamp.org/news/javascript-debounce-example/) - Tutorial on debounce implementation
- [DigitalA11Y - Input Type Date Accessibility](https://www.digitala11y.com/input-type-date-the-accessibility-of-html-date-picker/) - Accessibility analysis of HTML5 date input
- [Hassell Inclusion - Is input type="date" ready for accessible websites?](https://www.hassellinclusion.com/blog/input-type-date-ready-for-use/) - Accessibility audit of native date inputs
- [Go Make Things - Setting date input to today's date](https://gomakethings.com/setting-a-date-input-to-todays-date-with-vanilla-js/) - Vanilla JS pattern for default date values

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Chrome storage API and HTML5 form elements are official standards with comprehensive documentation
- Architecture: HIGH - Patterns are well-established in existing codebase (Phase 5) and industry best practices
- Pitfalls: MEDIUM - Based on common extension development issues and accessibility guidelines; some are inferred from similar projects rather than direct experience with this codebase

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain with mature standards)
