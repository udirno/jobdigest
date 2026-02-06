/**
 * Empty state module
 * Provides context-aware empty state messages
 */

/**
 * Update empty state message based on current filter
 * @param {string} currentFilter - Current filter value ('all', 'new', 'contacted', 'applied', 'passed')
 */
export function updateEmptyState(currentFilter) {
  const emptyState = document.getElementById('empty-state');
  if (!emptyState) return;

  const titleEl = emptyState.querySelector('.empty-state-title');
  const descEl = emptyState.querySelector('.empty-state-description');

  if (!titleEl || !descEl) return;

  // Context-aware messages
  if (currentFilter === 'all') {
    // No jobs exist at all
    titleEl.textContent = 'No jobs yet';
    descEl.textContent = 'Jobs will appear here after your first fetch. Try triggering a manual fetch or check your search settings.';
  } else {
    // Filtered but no matches
    const filterLabels = {
      'new': 'New',
      'contacted': 'Contacted',
      'applied': 'Applied',
      'passed': 'Passed'
    };

    const filterLabel = filterLabels[currentFilter] || currentFilter;
    titleEl.textContent = `No ${filterLabel} jobs`;
    descEl.textContent = 'Try adjusting your filter to see more jobs.';
  }
}
