# Phase 8: Export & Polish - Research

**Researched:** 2026-02-07
**Domain:** Client-side CSV generation, Chrome extension downloads, storage monitoring, user feedback patterns
**Confidence:** HIGH

## Summary

Phase 8 adds data export and storage management capabilities to the job tracking extension. Users export tracked jobs (including metadata and generated content) to CSV files and receive warnings when chrome.storage.local approaches capacity. Research focused on: (1) RFC 4180 CSV formatting with proper escaping for special characters, (2) Chrome downloads API for triggering file downloads from generated data, (3) chrome.storage.local quota monitoring with getBytesInUse(), and (4) user-friendly warning patterns for storage limits.

Key findings: CSV generation requires no external libraries—vanilla JavaScript handles RFC 4180 escaping with simple quoting rules. Chrome extensions use chrome.downloads.download() with blob URLs or data URLs for file downloads. Storage monitoring uses getBytesInUse() to track usage against the 10MB quota (extension already has unlimitedStorage permission, which raises limit but doesn't eliminate it). Warning users at 80% capacity prevents data loss from quota exceeded errors.

The existing codebase provides all necessary infrastructure: storage.js for data access, job data model with nested generated content, and established UI patterns for warnings (toast notifications from Phase 6). The main challenge is flattening nested job objects (with generated.coverLetter and generated.recruiterMessage) into flat CSV columns while preserving readability.

**Primary recommendation:** Implement vanilla JavaScript CSV generation with RFC 4180 escaping, use chrome.downloads.download() with blob URLs for file export, monitor storage on popup open with getBytesInUse(), and show persistent warning banner (not dismissible toast) when usage exceeds 80% threshold.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JavaScript | ES6+ | CSV generation with RFC 4180 escaping | No dependencies needed—CSV format is simple enough for manual implementation with proper quoting rules |
| chrome.downloads.download() | Manifest v3 | Trigger file download from blob URL | Built-in extension API, handles file picker and downloads folder automatically |
| chrome.storage.local.getBytesInUse() | Manifest v3 | Monitor storage quota usage | Official API for tracking storage consumption, returns bytes used by specific keys or all storage |
| URL.createObjectURL() | Web API | Create blob URL for CSV data | Standard browser API for generating downloadable URLs from in-memory data |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrome.notifications | Manifest v3 API | System-level notifications for critical warnings | Alternative to in-app warnings for storage alerts (requires "notifications" permission) |
| Blob | Web API | Create downloadable file from string data | Convert CSV string to blob for chrome.downloads.download() |
| URL.revokeObjectURL() | Web API | Clean up blob URLs after use | Prevent memory leaks from unreleased blob URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla CSV generation | Papa Parse library (45KB) | Papa Parse handles edge cases automatically but adds bundle size; vanilla is sufficient with proper RFC 4180 implementation |
| Blob URL | Data URL (base64 encoded) | Data URLs work for small files but have size limits and poor performance for large datasets; blob URLs handle any size efficiently |
| In-app warning banner | chrome.notifications system tray | System notifications are more intrusive but easier to miss; in-app banner is persistent and visible when user opens extension |
| Single-pass CSV generation | Streaming CSV (chunked writes) | Streaming avoids memory spikes but adds complexity; single-pass is fine for <1000 jobs (~2MB of CSV) |

**Installation:**
No additional npm packages required—all functionality uses native browser and Chrome extension APIs.

## Architecture Patterns

### Recommended Module Structure
```
src/
├── csv-exporter.js            # NEW: CSV generation, flattening, escaping
├── dashboard/
│   └── job-modal.js           # Extend with Export button
├── settings.js                # Add storage usage display, cleanup controls
└── storage.js                 # Add getStorageUsage() helper method
```

### Pattern 1: RFC 4180 CSV Escaping with Quoting
**What:** Escape special characters (commas, quotes, newlines) by wrapping fields in double quotes and doubling internal quotes
**When to use:** All CSV generation to ensure spreadsheet compatibility
**Example:**
```javascript
// Source: RFC 4180 (https://datatracker.ietf.org/doc/html/rfc4180)
function escapeCSVField(value) {
  if (value == null) return '';

  const stringValue = String(value);

  // Check if field needs quoting (contains comma, quote, or newline)
  const needsQuoting = /[",\n\r]/.test(stringValue);

  if (!needsQuoting) return stringValue;

  // Escape double quotes by doubling them
  const escaped = stringValue.replace(/"/g, '""');

  // Wrap in double quotes
  return `"${escaped}"`;
}

// Examples:
escapeCSVField('Simple text')              // → Simple text
escapeCSVField('Text with, comma')         // → "Text with, comma"
escapeCSVField('Text with "quotes"')       // → "Text with ""quotes"""
escapeCSVField('Multi\nline\ntext')        // → "Multi\nline\ntext"
escapeCSVField('Complex: "quoted, text"')  // → "Complex: ""quoted, text"""
```

### Pattern 2: Flattening Nested Objects for CSV Columns
**What:** Convert nested job objects with generated content into flat structure with dot-notation column names
**When to use:** Exporting job data that includes nested generated content (coverLetter, recruiterMessage)
**Example:**
```javascript
// Source: Common JSON-to-CSV pattern with dot notation
function flattenJobForCSV(job) {
  return {
    // Core job fields
    jobId: job.jobId,
    title: job.title,
    company: job.company,
    location: job.location || '',
    score: job.score || '',
    status: job.status || 'new',

    // Application tracking fields
    applicationDate: job.applicationDate || '',
    notes: job.notes || '',
    dismissed: job.dismissed ? 'Yes' : 'No',

    // Flattened generated content
    coverLetter: job.generated?.coverLetter?.content || '',
    coverLetterGenerated: job.generated?.coverLetter?.generatedAt || '',
    coverLetterEdited: job.generated?.coverLetter?.isEdited ? 'Yes' : 'No',

    recruiterMessage: job.generated?.recruiterMessage?.content || '',
    recruiterMessageGenerated: job.generated?.recruiterMessage?.generatedAt || '',
    recruiterMessageEdited: job.generated?.recruiterMessage?.isEdited ? 'Yes' : 'No'
  };
}

// Alternative approach: generic flatten function with dot notation
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursively flatten nested objects
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}
```

### Pattern 3: CSV Generation from Job Array
**What:** Convert array of job objects to CSV string with header row and escaped fields
**When to use:** Export all tracked jobs to downloadable CSV file
**Example:**
```javascript
// Source: Vanilla JavaScript CSV generation pattern
function generateCSV(jobs) {
  if (!jobs || jobs.length === 0) {
    throw new Error('No jobs to export');
  }

  // Flatten all jobs
  const flatJobs = jobs.map(flattenJobForCSV);

  // Extract headers from first job (all jobs have same structure)
  const headers = Object.keys(flatJobs[0]);

  // Build header row
  const headerRow = headers.map(escapeCSVField).join(',');

  // Build data rows
  const dataRows = flatJobs.map(job => {
    return headers.map(header => escapeCSVField(job[header])).join(',');
  });

  // Combine header + data rows with CRLF line endings (RFC 4180)
  return [headerRow, ...dataRows].join('\r\n');
}
```

### Pattern 4: Chrome Downloads API with Blob URL
**What:** Create blob URL from CSV string and trigger download using chrome.downloads.download()
**When to use:** Download generated CSV file to user's Downloads folder
**Example:**
```javascript
// Source: Chrome Downloads API docs (https://developer.chrome.com/docs/extensions/reference/api/downloads)
async function downloadCSV(csvString, filename = 'job-export.csv') {
  // Create blob from CSV string
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  // Create object URL
  const blobUrl = URL.createObjectURL(blob);

  try {
    // Trigger download
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: true  // Show file picker dialog
    });

    console.log('Download started:', downloadId);

    // Clean up blob URL after download starts
    // Wait a bit to ensure download initiated
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    return downloadId;

  } catch (error) {
    // Clean up on error
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
}

// Alternative: Data URL approach (for smaller files)
async function downloadCSVWithDataURL(csvString, filename = 'job-export.csv') {
  const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);

  return chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}
```

### Pattern 5: Storage Quota Monitoring
**What:** Check storage usage against quota and warn user at 80% threshold
**When to use:** On popup open, after bulk operations (job fetch, content generation)
**Example:**
```javascript
// Source: chrome.storage.local API docs (https://developer.chrome.com/docs/extensions/reference/api/storage)
async function getStorageUsage() {
  // Get bytes used by all storage
  const bytesInUse = await chrome.storage.local.getBytesInUse(null);

  // chrome.storage.local quota is 10MB (10,485,760 bytes)
  // With unlimitedStorage permission, quota is higher but still finite
  // Conservative estimate: 50MB for unlimitedStorage
  const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB default

  const percentUsed = (bytesInUse / QUOTA_BYTES) * 100;

  return {
    bytesInUse,
    quotaBytes: QUOTA_BYTES,
    percentUsed: Math.round(percentUsed),
    shouldWarn: percentUsed >= 80
  };
}

// Add to storage.js
export const storage = {
  // ... existing methods

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Usage stats with warning flag
   */
  async getStorageUsage() {
    const bytesInUse = await chrome.storage.local.getBytesInUse(null);
    const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB
    const percentUsed = (bytesInUse / QUOTA_BYTES) * 100;

    return {
      bytesInUse,
      quotaBytes: QUOTA_BYTES,
      megabytesUsed: (bytesInUse / (1024 * 1024)).toFixed(2),
      percentUsed: Math.round(percentUsed),
      shouldWarn: percentUsed >= 80
    };
  }
};
```

### Pattern 6: Persistent Warning Banner for Storage
**What:** Show non-dismissible banner at top of dashboard when storage exceeds 80% capacity
**When to use:** Critical warnings that require user action (storage cleanup)
**Example:**
```javascript
// Source: Material Design inline alerts, adapted for vanilla JS
function showStorageWarning(usageStats) {
  const existingBanner = document.getElementById('storage-warning-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'storage-warning-banner';
  banner.className = 'warning-banner';
  banner.innerHTML = `
    <div class="warning-banner-content">
      <span class="warning-icon">⚠️</span>
      <div class="warning-text">
        <strong>Storage almost full (${usageStats.percentUsed}%)</strong>
        <span>Extension may stop saving data soon. Consider exporting and archiving old jobs.</span>
      </div>
      <button class="warning-action" data-action="manage-storage">Manage Storage</button>
    </div>
  `;

  // Insert at top of dashboard
  const dashboard = document.getElementById('dashboard');
  dashboard.insertBefore(banner, dashboard.firstChild);

  // Action handler
  banner.querySelector('[data-action="manage-storage"]').addEventListener('click', () => {
    // Open settings panel to storage management section
    showSettings('storage');
  });
}

// Check on popup open
async function initDashboard() {
  const usageStats = await storage.getStorageUsage();

  if (usageStats.shouldWarn) {
    showStorageWarning(usageStats);
  }

  // ... rest of dashboard init
}
```

### Anti-Patterns to Avoid
- **Unescaped CSV fields:** Raw field values with commas or quotes break spreadsheet parsing—always escape with RFC 4180 rules
- **Forgetting UTF-8 BOM:** CSV files with special characters need UTF-8 byte order mark (\uFEFF) at start for Excel compatibility
- **Blob URL memory leaks:** Not calling URL.revokeObjectURL() after download leaves blob in memory indefinitely
- **Dismissible storage warnings:** Users dismiss warnings and forget—use persistent banner for critical alerts
- **Exporting all fields blindly:** API keys or sensitive data may be in job objects—explicitly whitelist exported fields
- **QUOTA_BYTES exceeded errors ignored:** Silent failures when storage is full lead to data loss—check quota before large writes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing libraries | Custom parser for reading CSV | Papa Parse only if needed for import | Phase 8 only exports (one-way), no import needed; if import added later, use battle-tested parser |
| Streaming CSV for large datasets | Chunked write with Web Streams API | Single-pass generation | Extension data is <1000 jobs (~2MB CSV), fits in memory easily; streaming adds complexity without benefit |
| Complex flattening with arrays | Generic recursive flatten function | Manual flattenJobForCSV() | Job schema is known and stable; hand-written flattening is clearer and controls column names/order |
| Storage quota detection | Custom calculation from object size | chrome.storage.local.getBytesInUse() | Official API accounts for serialization overhead, metadata, and internal storage structure |
| File save dialog | <a download> trick or hidden iframe | chrome.downloads.download() | Extension API integrates with browser's download manager, shows progress, handles conflicts |

**Key insight:** Chrome extension APIs and vanilla JavaScript provide all necessary primitives for CSV export and storage monitoring. External libraries add bundle size and complexity without meaningful benefit for this use case.

## Common Pitfalls

### Pitfall 1: CSV Injection Vulnerability
**What goes wrong:** User notes or job titles starting with `=`, `+`, `-`, `@` execute as formulas when CSV opens in Excel
**Why it happens:** Spreadsheet applications interpret cells starting with `=` as formulas, enabling code execution or data exfiltration
**How to avoid:** Prefix vulnerable fields with single quote (`'`) or tab (`\t`) to force text interpretation, or sanitize input to remove formula characters
**Warning signs:** Security audit flags formula injection risk; user reports unexpected formula evaluation in exported CSV

```javascript
function sanitizeForCSV(value) {
  if (value == null) return '';

  const stringValue = String(value);

  // Check if value starts with formula character
  if (/^[=+\-@]/.test(stringValue)) {
    // Prefix with single quote to force text interpretation
    return "'" + stringValue;
  }

  return stringValue;
}

// Apply before escaping
function escapeCSVField(value) {
  const sanitized = sanitizeForCSV(value);
  // ... rest of escaping logic
}
```

### Pitfall 2: Missing UTF-8 BOM for Excel Compatibility
**What goes wrong:** CSV opens in Excel with garbled characters for non-ASCII text (emoji, accented characters, non-Latin scripts)
**Why it happens:** Excel defaults to system encoding (Windows-1252 on Windows) unless UTF-8 BOM (\uFEFF) is present at file start
**How to avoid:** Prepend UTF-8 BOM to CSV string before creating blob: `const csv = '\uFEFF' + generateCSV(jobs);`
**Warning signs:** User reports "weird characters" in exported CSV when opened in Excel; non-ASCII text displays correctly in text editor but not spreadsheet

```javascript
function generateCSV(jobs) {
  const headers = Object.keys(flattenJobForCSV(jobs[0]));
  const headerRow = headers.map(escapeCSVField).join(',');
  const dataRows = jobs.map(job => {
    const flat = flattenJobForCSV(job);
    return headers.map(h => escapeCSVField(flat[h])).join(',');
  });

  // Prepend UTF-8 BOM for Excel compatibility
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}
```

### Pitfall 3: Blob URL Not Revoked After Download
**What goes wrong:** Memory usage grows with each export as blob URLs accumulate without cleanup
**Why it happens:** URL.createObjectURL() creates persistent mapping until explicitly revoked; not calling URL.revokeObjectURL() leaks memory
**How to avoid:** Call URL.revokeObjectURL() after download starts (wait ~1 second for browser to initiate download) or on error
**Warning signs:** Memory usage increases with repeated exports; browser dev tools show growing blob URL count

```javascript
async function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({ url: blobUrl, filename, saveAs: true });

    // Clean up after download initiated
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

  } catch (error) {
    // Clean up on error immediately
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
}
```

### Pitfall 4: Downloads Permission Missing
**What goes wrong:** chrome.downloads.download() fails with permission error despite code being correct
**Why it happens:** Extension manifest doesn't declare "downloads" permission required for chrome.downloads API
**How to avoid:** Add `"permissions": ["downloads"]` to manifest.json
**Warning signs:** Console error "Cannot read property 'download' of undefined" or "Extension does not have permission to use chrome.downloads"

```json
// manifest.json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "downloads"  // Required for chrome.downloads.download()
  ]
}
```

### Pitfall 5: Storage Warning Only Shown Once
**What goes wrong:** User dismisses storage warning toast and never sees it again, hits quota limit later
**Why it happens:** Warning implemented as dismissible toast (like Phase 6 undo toast) instead of persistent banner
**How to avoid:** Use persistent banner that reappears on every popup open until user takes action (exports/deletes jobs). Toast is for transient info; banner is for critical persistent state.
**Warning signs:** User reports "extension stopped saving data" with no prior warning; storage usage > 90% but user never saw warning

### Pitfall 6: Exporting Sensitive Data (API Keys)
**What goes wrong:** CSV export includes chrome.storage.local keys like apiKeys, exposing credentials in exported file
**Why it happens:** Blindly exporting all storage or using generic flattening on full job objects without field whitelisting
**How to avoid:** Explicitly whitelist exported fields in flattenJobForCSV(); never export entire storage; exclude job fields that may contain sensitive data
**Warning signs:** Security audit finds credentials in sample CSV export; user shares exported CSV publicly and leaks API keys

```javascript
// GOOD: Explicit whitelist of safe fields
function flattenJobForCSV(job) {
  return {
    jobId: job.jobId,
    title: job.title,
    company: job.company,
    location: job.location || '',
    score: job.score || '',
    status: job.status || 'new',
    applicationDate: job.applicationDate || '',
    notes: job.notes || '',
    coverLetter: job.generated?.coverLetter?.content || '',
    recruiterMessage: job.generated?.recruiterMessage?.content || ''
    // Explicitly do NOT export: apiKeys, internal IDs, source URLs
  };
}

// BAD: Blind flattening of all fields
function flattenJobForCSV(job) {
  return flattenObject(job); // Could expose sensitive fields
}
```

## Code Examples

Verified patterns from official sources:

### Complete CSV Export Flow
```javascript
// Source: RFC 4180 + Chrome Downloads API
// File: src/csv-exporter.js

/**
 * Escape CSV field according to RFC 4180
 * @param {any} value - Field value to escape
 * @returns {string} Escaped field value
 */
function escapeCSVField(value) {
  if (value == null) return '';

  let stringValue = String(value);

  // Sanitize formula injection
  if (/^[=+\-@]/.test(stringValue)) {
    stringValue = "'" + stringValue;
  }

  // Check if field needs quoting
  const needsQuoting = /[",\n\r]/.test(stringValue);

  if (!needsQuoting) return stringValue;

  // Escape double quotes by doubling them
  const escaped = stringValue.replace(/"/g, '""');

  // Wrap in double quotes
  return `"${escaped}"`;
}

/**
 * Flatten job object for CSV export
 * @param {Object} job - Job object with nested fields
 * @returns {Object} Flat object with all fields at root level
 */
function flattenJobForCSV(job) {
  return {
    // Core job metadata
    jobId: job.jobId,
    title: job.title,
    company: job.company,
    location: job.location || '',
    score: job.score || '',
    status: job.status || 'new',

    // Application tracking
    applicationDate: job.applicationDate || '',
    notes: job.notes || '',
    dismissed: job.dismissed ? 'Yes' : 'No',

    // Generated content
    coverLetter: job.generated?.coverLetter?.content || '',
    coverLetterGenerated: job.generated?.coverLetter?.generatedAt || '',
    coverLetterEdited: job.generated?.coverLetter?.isEdited ? 'Yes' : 'No',

    recruiterMessage: job.generated?.recruiterMessage?.content || '',
    recruiterMessageGenerated: job.generated?.recruiterMessage?.generatedAt || '',
    recruiterMessageEdited: job.generated?.recruiterMessage?.isEdited ? 'Yes' : 'No'
  };
}

/**
 * Generate CSV string from jobs array
 * @param {Array<Object>} jobs - Array of job objects
 * @returns {string} CSV string with UTF-8 BOM
 */
export function generateCSV(jobs) {
  if (!jobs || jobs.length === 0) {
    throw new Error('No jobs to export');
  }

  // Flatten all jobs
  const flatJobs = jobs.map(flattenJobForCSV);

  // Extract headers from first job
  const headers = Object.keys(flatJobs[0]);

  // Build header row
  const headerRow = headers.map(escapeCSVField).join(',');

  // Build data rows
  const dataRows = flatJobs.map(job => {
    return headers.map(header => escapeCSVField(job[header])).join(',');
  });

  // Combine with CRLF line endings (RFC 4180)
  const csv = [headerRow, ...dataRows].join('\r\n');

  // Prepend UTF-8 BOM for Excel compatibility
  return '\uFEFF' + csv;
}

/**
 * Download CSV file using Chrome downloads API
 * @param {string} csvString - CSV content
 * @param {string} filename - Suggested filename
 * @returns {Promise<number>} Download ID
 */
export async function downloadCSV(csvString, filename = 'job-export.csv') {
  // Create blob with UTF-8 encoding
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    // Trigger download with file picker
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: true
    });

    // Clean up blob URL after download initiated
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    return downloadId;

  } catch (error) {
    // Clean up immediately on error
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
}

/**
 * Export all tracked jobs to CSV
 * @returns {Promise<number>} Download ID
 */
export async function exportJobs() {
  const jobs = await storage.getJobs();
  const jobArray = Object.values(jobs);

  if (jobArray.length === 0) {
    throw new Error('No jobs to export');
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `job-digest-export-${timestamp}.csv`;

  // Generate and download CSV
  const csvString = generateCSV(jobArray);
  return downloadCSV(csvString, filename);
}
```

### Storage Usage Monitoring
```javascript
// Source: chrome.storage.local API
// Add to src/storage.js

/**
 * Get storage usage statistics
 * @returns {Promise<Object>} Usage stats with warning threshold
 */
export async function getStorageUsage() {
  const bytesInUse = await chrome.storage.local.getBytesInUse(null);

  // chrome.storage.local default quota: 10MB
  // With unlimitedStorage permission: higher limit (typically 50MB+)
  // Use conservative estimate for warnings
  const QUOTA_BYTES = 10 * 1024 * 1024; // 10MB

  const percentUsed = (bytesInUse / QUOTA_BYTES) * 100;

  return {
    bytesInUse,
    quotaBytes: QUOTA_BYTES,
    megabytesUsed: (bytesInUse / (1024 * 1024)).toFixed(2),
    megabytesQuota: (QUOTA_BYTES / (1024 * 1024)).toFixed(2),
    percentUsed: Math.round(percentUsed),
    shouldWarn: percentUsed >= 80,
    isCritical: percentUsed >= 95
  };
}
```

### Storage Warning Banner
```javascript
// Source: Material Design inline alerts pattern
// Add to src/dashboard/job-modal.js or src/popup.js

/**
 * Show persistent storage warning banner
 * @param {Object} usageStats - Storage usage statistics
 */
function showStorageWarning(usageStats) {
  // Remove existing banner if present
  const existingBanner = document.getElementById('storage-warning-banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'storage-warning-banner';
  banner.className = usageStats.isCritical ? 'warning-banner critical' : 'warning-banner';
  banner.innerHTML = `
    <div class="warning-banner-content">
      <span class="warning-icon">⚠️</span>
      <div class="warning-text">
        <strong>Storage ${usageStats.isCritical ? 'critically' : 'almost'} full (${usageStats.percentUsed}%)</strong>
        <p>${usageStats.megabytesUsed}MB of ${usageStats.megabytesQuota}MB used. ${usageStats.isCritical ? 'Extension may fail to save new data.' : 'Consider exporting and deleting old jobs.'}</p>
      </div>
      <div class="warning-actions">
        <button class="btn-secondary" data-action="export">Export Jobs</button>
        <button class="btn-secondary" data-action="manage">Manage Storage</button>
      </div>
    </div>
  `;

  // Insert at top of dashboard
  const dashboard = document.getElementById('dashboard');
  dashboard.insertBefore(banner, dashboard.firstChild);

  // Action handlers
  banner.querySelector('[data-action="export"]').addEventListener('click', async () => {
    try {
      await exportJobs();
      showToast('Export started. Check your Downloads folder.', 'success');
    } catch (error) {
      showToast('Export failed: ' + error.message, 'error');
    }
  });

  banner.querySelector('[data-action="manage"]').addEventListener('click', () => {
    // Open settings panel to storage management section
    showSettings({ initialTab: 'storage' });
  });
}

/**
 * Check storage usage on dashboard load
 */
async function initDashboard() {
  // Check storage usage
  const usageStats = await getStorageUsage();

  if (usageStats.shouldWarn) {
    showStorageWarning(usageStats);
  }

  // ... rest of dashboard initialization
}
```

### Export Button in Modal/Dashboard
```javascript
// Source: Existing button patterns from Phase 6
// Add to src/dashboard/job-modal.js

function createExportButton() {
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-secondary export-btn';
  exportBtn.textContent = 'Export All Jobs to CSV';
  exportBtn.addEventListener('click', async () => {
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';

      const downloadId = await exportJobs();

      showToast('CSV export started. Check your Downloads folder.', 'success');

      exportBtn.disabled = false;
      exportBtn.textContent = 'Export All Jobs to CSV';

    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed: ' + error.message, 'error');

      exportBtn.disabled = false;
      exportBtn.textContent = 'Export All Jobs to CSV';
    }
  });

  return exportBtn;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV libraries (Papa Parse, csv-parser) | Vanilla JavaScript with RFC 4180 rules | 2024+ (bundle size optimization) | Libraries add 45KB+ for functionality achievable in 50 lines of vanilla JS with proper escaping |
| <a download> trick for file downloads | chrome.downloads.download() API | Manifest V3 (2021+) | Extension API integrates with download manager, shows progress, handles conflicts automatically |
| Data URLs for downloads | Blob URLs with URL.createObjectURL() | 2020+ (large file support) | Blob URLs handle any size efficiently; data URLs have size limits and poor performance |
| Toast notifications for storage warnings | Persistent banner for critical alerts | 2023+ (UX research on critical warnings) | Dismissible toasts are missed; persistent banners ensure user awareness of critical state |

**Deprecated/outdated:**
- **<a download> attribute for extensions:** Works in web pages but not reliable in extensions; use chrome.downloads API instead
- **document.execCommand('copy') for clipboard:** Deprecated; use navigator.clipboard API (though not needed for file downloads)
- **Ignoring CSV injection:** Security best practice now requires sanitizing formula characters in exported data

## Open Questions

Things that couldn't be fully resolved:

1. **Actual storage quota with unlimitedStorage permission**
   - What we know: Default chrome.storage.local quota is 10MB; unlimitedStorage permission raises limit but exact value is undocumented and may vary
   - What's unclear: Whether to use 10MB or higher threshold (50MB? 100MB?) for warnings with unlimitedStorage
   - Recommendation: Use conservative 10MB threshold for warnings even with unlimitedStorage permission; better to warn early than hit actual quota

2. **CSV column ordering preference**
   - What we know: Object.keys() order is insertion order in modern JavaScript, but CSV column order affects usability
   - What's unclear: Whether to prioritize core fields (title, company) first or alphabetical order, or let Object.keys() dictate
   - Recommendation: Manually define column order in flattenJobForCSV() return object—put core fields first (jobId, title, company, status), then tracking (notes, applicationDate), then generated content last

3. **Export scope (all jobs vs filtered)**
   - What we know: Requirement says "export all tracked jobs"; users may want to export subset (only applied, only dismissed)
   - What's unclear: Whether export button should always export all jobs or respect current filter state (if filtered view is implemented)
   - Recommendation: Start with "Export All" button that exports entire jobs collection; if user feedback requests filtered export, add "Export Filtered" option in Phase 9+

4. **Storage cleanup strategy**
   - What we know: Warning at 80% prompts user action, but no automated cleanup exists
   - What's unclear: Whether to provide manual "Delete dismissed jobs" button, auto-archive jobs older than X days, or require manual job deletion
   - Recommendation: Add "Delete All Dismissed Jobs" button in settings storage section; avoid auto-deletion to prevent data loss; let user control cleanup timing

5. **Notification vs banner for storage warnings**
   - What we know: In-app banner is persistent and visible when popup open; chrome.notifications shows system tray notification
   - What's unclear: Whether system notification (requires "notifications" permission) is better UX than in-app banner
   - Recommendation: Use in-app persistent banner only—no additional permission, visible when user interacts with extension, less intrusive than system notifications

## Sources

### Primary (HIGH confidence)
- [RFC 4180 - CSV Format Specification](https://datatracker.ietf.org/doc/html/rfc4180) - Official CSV format standard with quoting and escaping rules
- [Chrome Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads) - Official documentation for chrome.downloads.download()
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Official documentation for chrome.storage.local.getBytesInUse()
- [Chrome Notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) - Official documentation for chrome.notifications (alternative to in-app warnings)
- [MDN - Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob) - Standard Blob constructor for creating downloadable files
- [MDN - URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL) - Standard API for creating blob URLs

### Secondary (MEDIUM confidence)
- [Papa Parse](https://www.papaparse.com/) - Popular CSV parsing library (45KB, not needed for Phase 8 export-only)
- [CSV Generate Usage](https://csv.js.org/generate/) - Node.js CSV generation patterns
- [GeeksforGeeks - Create and Download CSV in JavaScript](https://www.geeksforgeeks.org/javascript/how-to-create-and-download-csv-file-in-javascript/) - Tutorial on vanilla JS CSV generation
- [JSON Utils - Flattening Nested JSON for CSV](https://jsonutils.online/en/blog/flattening-nested-json-to-csv) - Guide to flattening nested objects
- [CSV42 GitHub](https://github.com/josdejong/csv42) - Modern CSV parser with nested JSON support (reference for flattening patterns)
- [Compile7 - CSV Escaping in JavaScript](https://compile7.org/escaping/how-to-use-csv-escaping-in-javascript-in-browser/) - CSV escaping techniques
- [Chrome Extensions - Export to CSV Discussion](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5kmauz9qKJs) - Community discussion on CSV export in Manifest V3
- [DEV Community - Download File from Blob](https://dev.to/nombrekeff/download-file-from-blob-21ho) - Blob download patterns

### Tertiary (LOW confidence)
- WebSearch: chrome.storage.local quota is 10MB default, higher with unlimitedStorage (exact limit undocumented)
- WebSearch: UTF-8 BOM (\uFEFF) required for Excel to properly detect UTF-8 encoding
- WebSearch: CSV injection vulnerability via formula characters (=, +, -, @) in cell values
- WebSearch: blob URLs vs data URLs for downloads (blob URLs preferred for performance and size)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - RFC 4180, Chrome extension APIs, and Web APIs are official standards with comprehensive documentation
- Architecture: HIGH - CSV generation patterns are well-established; flattening approach is straightforward for known job schema
- Pitfalls: HIGH - CSV injection, UTF-8 BOM, blob URL cleanup, and permissions are documented best practices

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable domain with mature standards)
