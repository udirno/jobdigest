import { initSettings } from './settings.js';

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
});

/**
 * Open settings panel
 */
function openSettings() {
  settingsPanel.classList.remove('hidden');
}

/**
 * Close settings panel
 */
function closeSettings() {
  settingsPanel.classList.add('hidden');
}
