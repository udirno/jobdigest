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

/**
 * Initialize dashboard controls (filter and sort dropdowns)
 * Call this after DOM is loaded
 */
export function initDashboardControls() {
  const filterDropdown = document.getElementById('filter-status');
  const sortDropdown = document.getElementById('sort-by');

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

    // Apply filter
    if (currentFilter !== 'all') {
      jobs = jobs.filter(job => job.status === currentFilter);
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

    // Hide toolbar if no jobs at all
    const allJobs = await storage.getJobs();
    if (Object.keys(allJobs).length === 0) {
      toolbar.style.display = 'none';
    } else {
      toolbar.style.display = 'flex';
    }

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

    // Add click handler to open modal (Plan 02 will implement openJobModal)
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking on buttons/links/select
      if (e.target.closest('.status-dropdown, .btn-view-original, .btn-view-details')) {
        return;
      }
      // Modal opening will be implemented in Plan 02
      console.log('Card clicked:', job.jobId);
    });

    // Add keyboard handler
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Modal opening will be implemented in Plan 02
        console.log('Card activated via keyboard:', job.jobId);
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
