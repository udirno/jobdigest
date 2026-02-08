import { initSettings } from './settings.js';
import { initDashboardControls, renderJobGrid } from './dashboard/filters.js';
import { initJobModal, openJobModal } from './dashboard/job-modal.js';
import { exportJobs } from './csv-exporter.js';
import { storage } from './storage.js';

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

  // Check storage usage and show warning if needed
  const usageStats = await storage.getStorageUsage();
  if (usageStats.shouldWarn) {
    showStorageWarning(usageStats);
  }

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
 * Show storage warning banner when usage exceeds 80%
 * @param {Object} usageStats - Storage usage statistics
 */
function showStorageWarning(usageStats) {
  const warningDiv = document.getElementById('storage-warning');
  if (!warningDiv) return;

  // Build warning message
  const warningLevel = usageStats.isCritical ? 'critically' : 'almost';
  const warningMessage = usageStats.isCritical
    ? 'Extension may fail to save new data.'
    : 'Consider exporting and clearing old jobs.';

  // Set banner content
  warningDiv.innerHTML = `
    <span class="warning-icon">&#9888;</span>
    <div class="warning-text">
      <strong>Storage ${warningLevel} full (${usageStats.percentUsed}%)</strong>
      <span>${usageStats.megabytesUsed}MB of ${usageStats.megabytesQuota}MB used. ${warningMessage}</span>
    </div>
    <div class="warning-actions">
      <button class="btn-warning-action" id="warning-export-btn">Export Jobs</button>
      <button class="btn-warning-action" id="warning-manage-btn">Manage Storage</button>
    </div>
  `;

  // Add critical class if needed
  if (usageStats.isCritical) {
    warningDiv.classList.add('critical');
  }

  // Show the banner
  warningDiv.style.display = 'flex';

  // Add event listeners to action buttons
  const exportBtn = document.getElementById('warning-export-btn');
  const manageBtn = document.getElementById('warning-manage-btn');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        await exportJobs();
        // Show brief success feedback
        exportBtn.textContent = 'Exported!';
        setTimeout(() => {
          exportBtn.textContent = 'Export Jobs';
        }, 1500);
      } catch (error) {
        console.error('Export from warning banner failed:', error);
        exportBtn.textContent = 'Export failed';
        setTimeout(() => {
          exportBtn.textContent = 'Export Jobs';
        }, 2000);
      }
    });
  }

  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      openSettings();
    });
  }
}

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
