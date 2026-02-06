/**
 * Job card rendering module
 * Creates rich job cards with score badges, metadata, and description previews
 */

import { storage } from '../storage.js';

/**
 * Create a job card DOM element
 * @param {Object} job - Normalized job object
 * @returns {HTMLElement} Job card element
 */
export function createJobCard(job) {
  const card = document.createElement('div');
  card.className = 'job-card';
  card.dataset.jobId = job.jobId;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  // Determine score badge class
  const scoreClass = job.score === null || job.score === undefined || job.score === -1
    ? 'unscored'
    : job.score >= 80
    ? 'high'
    : job.score >= 60
    ? 'medium'
    : 'low';

  const scoreDisplay = job.score === null || job.score === undefined || job.score === -1
    ? 'N/A'
    : job.score;

  // Format salary
  const salaryText = formatSalary(job.salary);

  // Build card HTML
  card.innerHTML = `
    <div class="card-header">
      <div class="score-badge ${scoreClass}" tabindex="0" aria-describedby="tooltip-${job.jobId}">
        ${scoreDisplay}
        <span class="score-tooltip" role="tooltip" id="tooltip-${job.jobId}">Score based on skills, experience, tech stack, title, and industry fit</span>
      </div>
      <select class="status-dropdown" data-job-id="${job.jobId}" aria-label="Job status">
        <option value="new" ${job.status === 'new' ? 'selected' : ''}>New</option>
        <option value="contacted" ${job.status === 'contacted' ? 'selected' : ''}>Contacted</option>
        <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>Applied</option>
        <option value="passed" ${job.status === 'passed' ? 'selected' : ''}>Passed</option>
      </select>
    </div>

    <div class="card-body">
      <h3 class="job-title">${escapeHtml(job.title)}</h3>
      <p class="job-company">${escapeHtml(job.company)}</p>
      <p class="job-location">${escapeHtml(job.location)}</p>
      <p class="job-meta">
        ${formatRelativeDate(job.postedAt)}${salaryText ? ` • ${salaryText}` : ''}
      </p>
      <p class="job-description-preview">
        ${escapeHtml(extractKeyRequirements(job.description))}
      </p>
    </div>

    <div class="card-footer">
      <button class="btn-card-action btn-view-details" data-job-id="${job.jobId}">View Details</button>
      <a href="${job.url}" target="_blank" class="btn-view-original" rel="noopener noreferrer">
        View Original ↗
      </a>
    </div>
  `;

  // Add status dropdown change handler
  const statusDropdown = card.querySelector('.status-dropdown');
  statusDropdown.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click
  });
  statusDropdown.addEventListener('change', async (e) => {
    e.stopPropagation(); // Prevent card click
    const newStatus = e.target.value;

    // Update job in storage
    const jobs = await storage.getJobs();
    if (jobs[job.jobId]) {
      jobs[job.jobId].status = newStatus;
      await storage.saveJob(job.jobId, jobs[job.jobId]);
      console.log(`Updated ${job.jobId} status to ${newStatus}`);
    }
  });

  // Prevent card click on View Original link
  const viewOriginalLink = card.querySelector('.btn-view-original');
  viewOriginalLink.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click
  });

  return card;
}

/**
 * HTML escape utility
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format salary object to display string
 * @param {Object} salary - Salary object with min/max
 * @returns {string} Formatted salary string
 */
export function formatSalary(salary) {
  if (!salary || !salary.min) return '';
  const minK = Math.round(salary.min / 1000);
  const maxK = salary.max ? Math.round(salary.max / 1000) : null;
  return maxK ? `$${minK}k-$${maxK}k` : `$${minK}k+`;
}

/**
 * Extract key requirements from job description
 * Uses keyword matching to find requirement sentences
 * @param {string} description - Full job description
 * @returns {string} Key requirements preview
 */
export function extractKeyRequirements(description) {
  if (!description) return '';

  // Keywords that indicate requirements/qualifications
  const keywords = [
    'require', 'must have', 'experience with', 'experience in',
    'skills', 'knowledge of', 'proficiency', 'expertise',
    'qualifications', 'responsibilities', 'looking for'
  ];

  // Split into sentences (handle various punctuation)
  const sentences = description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Find first sentence containing requirement keywords
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (keywords.some(keyword => lower.includes(keyword))) {
      // Limit to 150 chars
      return sentence.length > 150 ? sentence.substring(0, 147) + '...' : sentence;
    }
  }

  // Fallback: First 150 characters of description
  return description.substring(0, 150) + (description.length > 150 ? '...' : '');
}

/**
 * Format date as relative string (Today, Yesterday, N days ago)
 * @param {string} dateString - ISO date string
 * @returns {string} Relative date string
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  // Calculate difference in days
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  // Fallback to formatted date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
