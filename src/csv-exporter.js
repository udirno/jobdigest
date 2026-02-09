import { storage } from './storage.js';

/**
 * Escape CSV field per RFC 4180
 * @param {any} value - Field value
 * @returns {string} Escaped field
 */
function escapeCSVField(value) {
  // Return empty string for null/undefined
  if (value == null) return '';

  // Convert to string
  const str = String(value);

  // CSV injection prevention: prefix fields starting with =, +, -, @ with single quote
  const dangerousChars = ['=', '+', '-', '@'];
  let sanitized = str;
  if (dangerousChars.some(char => str.startsWith(char))) {
    sanitized = `'${str}`;
  }

  // If field contains comma, double-quote, newline, or carriage-return, wrap in quotes
  // and double any internal quotes
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n') || sanitized.includes('\r')) {
    // Double any existing quotes
    const escaped = sanitized.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return sanitized;
}

/**
 * Flatten job object to single-level object with explicit field whitelist
 * @param {Object} job - Job object
 * @returns {Object} Flattened job object
 */
function flattenJobForCSV(job) {
  return {
    jobId: job.jobId ?? '',
    title: job.title ?? '',
    company: job.company ?? '',
    location: job.location ?? '',
    url: job.url ?? '',
    source: job.source ?? '',
    postedAt: job.postedAt ?? '',
    fetchedAt: job.fetchedAt ?? '',
    score: job.score ?? '',
    scoreReasoning: job.scoreReasoning ?? '',
    status: job.status ?? 'new',
    applicationDate: job.applicationDate ?? '',
    notes: job.notes ?? '',
    dismissed: job.dismissed ? 'Yes' : 'No',
    coverLetter: job.generated?.coverLetter?.content ?? '',
    coverLetterGenerated: job.generated?.coverLetter?.generatedAt ?? '',
    coverLetterEdited: job.generated?.coverLetter?.isEdited ? 'Yes' : 'No',
    recruiterMessage: job.generated?.recruiterMessage?.content ?? '',
    recruiterMessageGenerated: job.generated?.recruiterMessage?.generatedAt ?? '',
    recruiterMessageEdited: job.generated?.recruiterMessage?.isEdited ? 'Yes' : 'No'
  };
}

/**
 * Generate CSV string from array of job objects
 * @param {Array<Object>} jobs - Array of job objects
 * @returns {string} CSV string with UTF-8 BOM
 * @throws {Error} If jobs array is empty or null
 */
export function generateCSV(jobs) {
  if (!jobs || jobs.length === 0) {
    throw new Error('No jobs to export');
  }

  // Flatten all jobs
  const flattenedJobs = jobs.map(flattenJobForCSV);

  // Extract headers from first job (Object.keys preserves insertion order)
  const headers = Object.keys(flattenedJobs[0]);

  // Build header row
  const headerRow = headers.map(escapeCSVField).join(',');

  // Build data rows
  const dataRows = flattenedJobs.map(job => {
    return headers.map(header => escapeCSVField(job[header])).join(',');
  });

  // Join all rows with CRLF per RFC 4180
  const csvContent = [headerRow, ...dataRows].join('\r\n');

  // Prepend UTF-8 BOM for Excel compatibility
  return '\uFEFF' + csvContent;
}

/**
 * Trigger file download via Chrome downloads API
 * @param {string} csvString - CSV content
 * @param {string} filename - Filename for download
 * @returns {Promise<number>} Download ID
 */
export async function downloadCSV(csvString, filename) {
  // Convert CSV string to base64-encoded data URL
  // The encodeURIComponent + unescape + btoa chain handles UTF-8 characters correctly
  const base64Content = btoa(unescape(encodeURIComponent(csvString)));
  const dataUrl = `data:text/csv;charset=utf-8;base64,${base64Content}`;

  try {
    // Trigger download with data URL (works in Manifest V3, unlike blob URLs)
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });

    return downloadId;
  } catch (error) {
    throw error;
  }
}

/**
 * Export all jobs to CSV file
 * @returns {Promise<number>} Download ID
 * @throws {Error} If no jobs to export
 */
export async function exportJobs() {
  // Get all jobs from storage
  const jobsMap = await storage.getJobs();
  const allJobs = Object.values(jobsMap);

  // Filter out dismissed and passed jobs (matches dashboard visibility logic in filters.js)
  const jobs = allJobs.filter(job => job.dismissed !== true && job.status !== 'passed');

  if (jobs.length === 0) {
    throw new Error('No jobs to export');
  }

  // Generate timestamped filename
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `job-digest-export-${date}.csv`;

  // Generate CSV and trigger download
  const csvString = generateCSV(jobs);
  return await downloadCSV(csvString, filename);
}
