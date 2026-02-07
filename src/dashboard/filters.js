/**
 * Dashboard filter and sort controls
 * Handles filtering, sorting, and grid rendering
 */

import { storage } from '../storage.js';
import { createJobCard } from './job-card.js';
import { updateEmptyState } from './empty-state.js';

// Filter and sort state
let currentFilter = 'all';
let currentSort = 'score';
let showHidden = false;

/**
 * Initialize dashboard controls (filter and sort dropdowns)
 * Call this after DOM is loaded
 */
export function initDashboardControls() {
  const filterDropdown = document.getElementById('filter-status');
  const sortDropdown = document.getElementById('sort-by');
  const showHiddenCheckbox = document.getElementById('show-hidden');

  if (!filterDropdown || !sortDropdown) {
    console.warn('Dashboard controls not found in DOM');
    return;
  }

  // Filter change handler
  filterDropdown.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderJobGrid();
  });

  // Sort change handler
  sortDropdown.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderJobGrid();
  });

  // Show hidden checkbox handler
  if (showHiddenCheckbox) {
    showHiddenCheckbox.addEventListener('change', (e) => {
      showHidden = e.target.checked;
      renderJobGrid();
    });
  }

  // Set default values
  filterDropdown.value = currentFilter;
  sortDropdown.value = currentSort;
}

/**
 * Get filtered and sorted jobs array
 * @returns {Array} Filtered and sorted jobs
 */
export function getFilteredAndSortedJobs() {
  return new Promise(async (resolve) => {
    const jobsMap = await storage.getJobs();
    let jobs = Object.values(jobsMap);

    // Filter out dismissed jobs unless showHidden is true
    if (!showHidden) {
      jobs = jobs.filter(job => job.dismissed !== true);
    }

    // Apply status filter
    if (currentFilter !== 'all') {
      jobs = jobs.filter(job => job.status === currentFilter);
    } else {
      // When on "all" filter, also hide passed jobs unless showHidden is true
      if (!showHidden) {
        jobs = jobs.filter(job => job.status !== 'passed');
      }
    }

    // Apply sort
    jobs.sort((a, b) => {
      switch (currentSort) {
        case 'score':
          // Handle null/undefined/-1 scores (unscored jobs go to bottom)
          const scoreA = a.score === null || a.score === undefined || a.score === -1 ? -999 : a.score;
          const scoreB = b.score === null || b.score === undefined || b.score === -1 ? -999 : b.score;
          return scoreB - scoreA; // High to low

        case 'date':
          return new Date(b.postedAt) - new Date(a.postedAt); // Newest first

        case 'company':
          return a.company.localeCompare(b.company); // A-Z

        case 'title':
          return a.title.localeCompare(b.title); // A-Z

        default:
          return 0;
      }
    });

    resolve(jobs);
  });
}

/**
 * Render job grid with current filter and sort
 * Handles empty state display
 */
export async function renderJobGrid() {
  const grid = document.getElementById('job-grid');
  const emptyState = document.getElementById('empty-state');
  const jobCountEl = document.getElementById('job-count');
  const toolbar = document.getElementById('dashboard-toolbar');

  if (!grid || !emptyState) {
    console.warn('Dashboard elements not found');
    return;
  }

  const jobs = await getFilteredAndSortedJobs();

  // Update job count
  if (jobCountEl) {
    const countText = jobs.length === 1 ? '1 job' : `${jobs.length} jobs`;
    jobCountEl.textContent = countText;
  }

  // Handle empty state
  if (jobs.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    toolbar.style.display = 'flex'; // Keep toolbar visible even with no jobs
    updateEmptyState(currentFilter);
    return;
  }

  // Show grid and toolbar, hide empty state
  grid.style.display = 'grid';
  emptyState.style.display = 'none';
  toolbar.style.display = 'flex';

  // Clear existing cards
  grid.innerHTML = '';

  // Use DocumentFragment for batch DOM update (performance optimization)
  const fragment = document.createDocumentFragment();

  jobs.forEach(job => {
    const card = createJobCard(job);

    // Add click handler to open modal
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking on buttons/links/select
      if (e.target.closest('.status-dropdown, .btn-view-original, .btn-view-details')) {
        return;
      }
      // Dispatch custom event to trigger modal
      const event = new CustomEvent('open-job-modal', { detail: { jobId: job.jobId } });
      grid.dispatchEvent(event);
    });

    // Add keyboard handler
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Dispatch custom event to trigger modal
        const event = new CustomEvent('open-job-modal', { detail: { jobId: job.jobId } });
        grid.dispatchEvent(event);
      }
    });

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

/**
 * Get current filter value (for use by other modules)
 * @returns {string} Current filter value
 */
export function getCurrentFilter() {
  return currentFilter;
}

/**
 * Get current sort value (for use by other modules)
 * @returns {string} Current sort value
 */
export function getCurrentSort() {
  return currentSort;
}

/**
 * Set show hidden state and re-render
 * @param {boolean} value - Whether to show hidden jobs
 */
export function setShowHidden(value) {
  showHidden = value;
  renderJobGrid();
}

/**
 * Get show hidden state
 * @returns {boolean} Current show hidden state
 */
export function getShowHidden() {
  return showHidden;
}
