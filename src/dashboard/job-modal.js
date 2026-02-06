/**
 * Job detail modal module
 * Handles modal display, navigation, and score breakdown
 */

import { getFilteredAndSortedJobs } from './filters.js';
import { escapeHtml, formatRelativeDate, formatSalary } from './job-card.js';

// Module state
let currentJobs = [];
let currentIndex = 0;
let modal, modalBody, prevBtn, nextBtn, counterEl, viewOriginalLink;

/**
 * Initialize job modal
 * Call this after DOM is loaded
 */
export function initJobModal() {
  // Cache DOM references
  modal = document.getElementById('job-detail-modal');
  modalBody = document.getElementById('modal-body');
  prevBtn = document.getElementById('prev-job');
  nextBtn = document.getElementById('next-job');
  counterEl = document.getElementById('modal-counter');
  viewOriginalLink = document.getElementById('modal-view-original');

  if (!modal || !modalBody) {
    console.warn('Modal elements not found in DOM');
    return;
  }

  // Attach navigation listeners
  prevBtn.addEventListener('click', handlePrevious);
  nextBtn.addEventListener('click', handleNext);

  // Keyboard navigation in modal
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  });

  // Clean up on close
  modal.addEventListener('close', () => {
    currentJobs = [];
    currentIndex = 0;
  });
}

/**
 * Open job modal for specific job
 * @param {string} jobId - Job ID to display
 */
export async function openJobModal(jobId) {
  if (!modal) {
    console.error('Modal not initialized');
    return;
  }

  // Get current filtered/sorted jobs array for navigation
  currentJobs = await getFilteredAndSortedJobs();
  currentIndex = currentJobs.findIndex(j => j.jobId === jobId);

  if (currentIndex === -1) {
    console.error('Job not found:', jobId);
    return;
  }

  // Render modal content
  renderModalContent(currentJobs[currentIndex]);

  // Update navigation state
  updateNavigation();

  // Show modal
  modal.showModal();
}

/**
 * Render modal content for a job
 * @param {Object} job - Job object
 */
function renderModalContent(job) {
  const salaryText = formatSalary(job.salary);
  const dateText = formatRelativeDate(job.postedAt);

  // Build modal body HTML
  let html = `
    <h2 class="modal-job-title">${escapeHtml(job.title)}</h2>
    <p class="modal-job-company">${escapeHtml(job.company)}</p>
    <div class="modal-meta-row">
      <span>${escapeHtml(job.location)}</span>
      <span>${dateText}</span>
      ${salaryText ? `<span>${salaryText}</span>` : ''}
      <span class="source-badge">${job.source}</span>
    </div>
  `;

  // Score section (only if scored)
  if (job.score !== null && job.score !== undefined && job.score >= 0) {
    const scoreClass = getScoreClass(job.score);

    html += `
      <div class="score-section">
        <div class="score-section-header">
          <span class="score-overall ${scoreClass}">${job.score}</span>
          <span class="score-label">Overall Match Score</span>
        </div>
    `;

    // AI reasoning
    if (job.scoreReasoning) {
      html += `<div class="score-reasoning">"${escapeHtml(job.scoreReasoning)}"</div>`;
    }

    // 5-dimension breakdown
    if (job.scoreDetails) {
      html += `<div class="dimension-grid">`;

      const dimensions = [
        { key: 'skills_match', label: 'Skills Match' },
        { key: 'experience_level', label: 'Experience Level' },
        { key: 'tech_stack_alignment', label: 'Tech Stack' },
        { key: 'title_relevance', label: 'Title Relevance' },
        { key: 'industry_fit', label: 'Industry Fit' }
      ];

      dimensions.forEach(dim => {
        const score = job.scoreDetails[dim.key];
        if (score !== null && score !== undefined) {
          const color = getDimensionColor(score);
          html += `
            <div class="dimension-item">
              <div class="dimension-name">${dim.label}</div>
              <div class="dimension-score" style="color: ${color};">${score}</div>
              <div class="dimension-bar">
                <div class="dimension-bar-fill" style="width: ${score}%; background: ${color};"></div>
              </div>
            </div>
          `;
        }
      });

      html += `</div>`;
    }

    html += `</div>`;
  } else {
    // Unscored job
    html += `
      <div class="score-section">
        <p style="color: var(--text-secondary); font-size: 13px;">This job has not been scored yet.</p>
      </div>
    `;
  }

  // Description section
  html += `
    <div class="description-section">
      <h3 class="description-section-title">Job Description</h3>
      <div class="description-text">${escapeHtml(job.description || '')}</div>
    </div>
  `;

  modalBody.innerHTML = html;

  // Update view original link
  viewOriginalLink.href = job.url;
}

/**
 * Update navigation button states and counter
 */
function updateNavigation() {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === currentJobs.length - 1;
  counterEl.textContent = `${currentIndex + 1} of ${currentJobs.length}`;
}

/**
 * Handle previous button
 */
function handlePrevious() {
  if (currentIndex > 0) {
    currentIndex--;
    renderModalContent(currentJobs[currentIndex]);
    updateNavigation();
  }
}

/**
 * Handle next button
 */
function handleNext() {
  if (currentIndex < currentJobs.length - 1) {
    currentIndex++;
    renderModalContent(currentJobs[currentIndex]);
    updateNavigation();
  }
}

/**
 * Get dimension color based on score
 * @param {number} score - Score value (0-100)
 * @returns {string} Color hex code
 */
function getDimensionColor(score) {
  if (score >= 80) return '#81c784';  // green
  if (score >= 60) return '#ffd54f';  // amber
  return '#e57373';  // red
}

/**
 * Get score class for styling
 * @param {number} score - Score value
 * @returns {string} CSS class name
 */
function getScoreClass(score) {
  if (score === null || score === undefined || score < 0) return 'unscored';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}
