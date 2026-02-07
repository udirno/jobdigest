/**
 * Job detail modal module
 * Handles modal display, navigation, and score breakdown
 */

import { getFilteredAndSortedJobs, renderJobGrid } from './filters.js';
import { escapeHtml, formatRelativeDate, formatSalary, showUndoToast } from './job-card.js';
import { storage } from '../storage.js';

// Module state
let currentJobs = [];
let currentIndex = 0;
let modal, modalBody, prevBtn, nextBtn, counterEl, viewOriginalLink, dismissBtn;

// Debounce state for notes auto-save
let saveTimeout = null;
let pendingJobId = null;
let pendingNotes = null;

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
  dismissBtn = document.getElementById('modal-dismiss');

  if (!modal || !modalBody) {
    console.warn('Modal elements not found in DOM');
    return;
  }

  // Attach navigation listeners
  prevBtn.addEventListener('click', handlePrevious);
  nextBtn.addEventListener('click', handleNext);

  // Attach dismiss handler
  dismissBtn.addEventListener('click', async () => {
    const job = currentJobs[currentIndex];
    if (!job) return;

    // Dismiss the job
    await storage.updateJob(job.jobId, { dismissed: true });

    // Close modal
    modal.close();

    // Refresh grid
    await renderJobGrid();

    // Show undo toast
    showUndoToast('Job hidden', async () => {
      await storage.updateJob(job.jobId, { dismissed: false });
      await renderJobGrid();
    });
  });

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
  modal.addEventListener('close', async () => {
    // Flush pending notes save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (pendingJobId && pendingNotes !== null) {
      await storage.updateJob(pendingJobId, { notes: pendingNotes });
      pendingJobId = null;
      pendingNotes = null;
    }
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
      <select class="modal-status-dropdown" data-job-id="${job.jobId}" aria-label="Job status">
        <option value="new" ${job.status === 'new' ? 'selected' : ''}>New</option>
        <option value="contacted" ${job.status === 'contacted' ? 'selected' : ''}>Contacted</option>
        <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>Applied</option>
        <option value="passed" ${job.status === 'passed' ? 'selected' : ''}>Passed</option>
      </select>
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

  // Notes section (always shown)
  html += `
    <div class="notes-section">
      <h3 class="notes-section-title">Notes</h3>
      <textarea
        id="modal-notes"
        class="modal-notes-textarea"
        maxlength="2000"
        placeholder="Add notes about this job..."
        aria-describedby="notes-counter"
        data-job-id="${job.jobId}"
      >${escapeHtml(job.notes || '')}</textarea>
      <div id="notes-counter" class="char-counter" aria-live="polite">
        ${2000 - (job.notes || '').length} characters remaining
      </div>
    </div>
  `;

  // Application date section (shown only when status is 'applied')
  if (job.status === 'applied') {
    html += `
      <div class="app-date-section">
        <label for="modal-app-date" class="app-date-label">Application Date</label>
        <input
          type="date"
          id="modal-app-date"
          class="modal-date-input"
          value="${job.applicationDate || new Date().toISOString().split('T')[0]}"
          max="${new Date().toISOString().split('T')[0]}"
          data-job-id="${job.jobId}"
        >
      </div>
    `;
  }

  modalBody.innerHTML = html;

  // Attach event listeners after DOM is ready

  // Notes textarea handler
  const textarea = modalBody.querySelector('#modal-notes');
  if (textarea) {
    textarea.addEventListener('input', (e) => {
      const notes = e.target.value;
      const counter = modalBody.querySelector('#notes-counter');
      if (counter) {
        counter.textContent = `${2000 - notes.length} characters remaining`;
        // Add warning class if under 100 chars remaining
        if (2000 - notes.length < 100) {
          counter.classList.add('warning');
        } else {
          counter.classList.remove('warning');
        }
      }

      // Debounced save
      pendingJobId = e.target.dataset.jobId;
      pendingNotes = notes;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await storage.updateJob(pendingJobId, { notes: pendingNotes });
        pendingJobId = null;
        pendingNotes = null;
      }, 1000);
    });
  }

  // Application date handler
  const dateInput = modalBody.querySelector('#modal-app-date');
  if (dateInput) {
    dateInput.addEventListener('change', async (e) => {
      const jobId = e.target.dataset.jobId;
      const applicationDate = e.target.value;
      await storage.updateJob(jobId, { applicationDate });
      // Update current job object
      currentJobs[currentIndex].applicationDate = applicationDate;
    });
  }

  // Status dropdown handler
  const statusDropdown = modalBody.querySelector('.modal-status-dropdown');
  if (statusDropdown) {
    statusDropdown.addEventListener('change', async (e) => {
      const jobId = e.target.dataset.jobId;
      const newStatus = e.target.value;

      // Prepare update object
      const updates = { status: newStatus };

      // If changing to Applied and no applicationDate, set to today
      if (newStatus === 'applied' && !currentJobs[currentIndex].applicationDate) {
        updates.applicationDate = new Date().toISOString().split('T')[0];
      }

      // Save to storage
      await storage.updateJob(jobId, updates);

      // Update current job object
      Object.assign(currentJobs[currentIndex], updates);

      // Re-render modal content to show/hide date field
      renderModalContent(currentJobs[currentIndex]);

      // Update navigation state after re-render
      updateNavigation();

      // Refresh grid to update card status
      await renderJobGrid();
    });
  }

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
