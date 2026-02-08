import { initSettings } from './settings.js';
import { initDashboardControls, renderJobGrid } from './dashboard/filters.js';
import { initJobModal, openJobModal } from './dashboard/job-modal.js';
import { exportJobs } from './csv-exporter.js';

// DOM elements
let settingsBtn, closeSettingsBtn, settingsPanel, mainView;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Check onboarding status
  const onboardingStatus = await chrome.runtime.sendMessage({
    type: 'GET_ONBOARDING_STATUS'
  });

  // If onboarding not completed, redirect to onboarding page
  if (!onboardingStatus.completed) {
    const onboardingUrl = chrome.runtime.getURL('src/onboarding.html');
    await chrome.tabs.create({ url: onboardingUrl });
    window.close();
    return;
  }

  // Initialize DOM elements
  settingsBtn = document.getElementById('settings-btn');
  closeSettingsBtn = document.getElementById('close-settings-btn');
  settingsPanel = document.getElementById('settings-panel');
  mainView = document.getElementById('main-view');

  // Attach event listeners
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);

  // Initialize settings panel
  const settingsContent = document.getElementById('settings-content');
  initSettings(settingsContent);

  // Initialize dashboard
  initDashboardControls();
  await renderJobGrid();

  // Initialize modal
  initJobModal();

  // Listen for job modal open events from cards
  document.getElementById('job-grid').addEventListener('open-job-modal', (e) => {
    openJobModal(e.detail.jobId);
  });

  // Add empty state action button handler
  const emptyStateBtn = document.getElementById('empty-state-action');
  if (emptyStateBtn) {
    emptyStateBtn.addEventListener('click', openSettings);
  }

  // Add export button handler
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
});

/**
 * Open settings panel
 */
function openSettings() {
  settingsPanel.classList.remove('hidden');
}

/**
 * Close settings panel
 * Refresh dashboard when closing settings (in case jobs were fetched)
 */
async function closeSettings() {
  settingsPanel.classList.add('hidden');

  // Refresh dashboard to show any newly fetched jobs
  await renderJobGrid();
}

/**
 * Handle export button click
 */
async function handleExport() {
  const exportBtn = document.getElementById('export-btn');
  const originalText = exportBtn.textContent;

  // Disable button and show loading state
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';

  try {
    await exportJobs();

    // Show success feedback
    exportBtn.textContent = 'Exported!';
    setTimeout(() => {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }, 1500);
  } catch (error) {
    // Handle error
    if (error.message.includes('No jobs')) {
      exportBtn.textContent = 'No jobs to export';
    } else {
      exportBtn.textContent = 'Export failed';
      console.error('Export error:', error);
    }

    // Restore button after showing error
    setTimeout(() => {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }, 2000);
  }
}
