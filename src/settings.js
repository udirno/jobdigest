import { storage } from './storage.js';

/**
 * Initialize settings panel
 * @param {HTMLElement} container - Container element to render settings into
 */
export async function initSettings(container) {
  // Load current API keys
  const apiKeys = await loadApiKeys();

  // Render settings form
  container.innerHTML = `
    <div class="settings-section">
      <h3 class="section-title">API Keys</h3>
      <p class="section-description">Manage your API credentials for job fetching and AI scoring.</p>

      <!-- Claude API Key -->
      <div class="api-section">
        <label class="api-label" for="settings-claude-key">Claude API Key</label>
        <div class="input-group">
          <div class="input-wrapper">
            <input type="password" id="settings-claude-key" class="settings-input" value="${apiKeys.claude || ''}" placeholder="sk-ant-api03-...">
            <button type="button" class="toggle-visibility" data-target="settings-claude-key" aria-label="Toggle visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <button type="button" class="btn-test" data-service="claude">Test</button>
        </div>
        <div class="status-indicator" id="status-settings-claude"></div>
      </div>

      <!-- Adzuna API Key -->
      <div class="api-section">
        <label class="api-label" for="settings-adzuna-app-id">Adzuna API Key</label>
        <div class="input-group">
          <div class="input-wrapper">
            <input type="password" id="settings-adzuna-app-id" class="settings-input" value="${apiKeys.adzuna.appId || ''}" placeholder="App ID">
            <button type="button" class="toggle-visibility" data-target="settings-adzuna-app-id" aria-label="Toggle visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
        </div>
        <div class="input-group" style="margin-top: 8px;">
          <div class="input-wrapper">
            <input type="password" id="settings-adzuna-app-key" class="settings-input" value="${apiKeys.adzuna.appKey || ''}" placeholder="App Key">
            <button type="button" class="toggle-visibility" data-target="settings-adzuna-app-key" aria-label="Toggle visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <button type="button" class="btn-test" data-service="adzuna">Test</button>
        </div>
        <div class="status-indicator" id="status-settings-adzuna"></div>
      </div>

      <!-- JSearch API Key -->
      <div class="api-section">
        <label class="api-label" for="settings-jsearch-key">JSearch API Key</label>
        <div class="input-group">
          <div class="input-wrapper">
            <input type="password" id="settings-jsearch-key" class="settings-input" value="${apiKeys.jsearch || ''}" placeholder="RapidAPI Key">
            <button type="button" class="toggle-visibility" data-target="settings-jsearch-key" aria-label="Toggle visibility">
              <span class="eye-icon">👁️</span>
            </button>
          </div>
          <button type="button" class="btn-test" data-service="jsearch">Test</button>
        </div>
        <div class="status-indicator" id="status-settings-jsearch"></div>
      </div>

      <!-- Save button -->
      <div class="actions">
        <button type="button" id="save-settings-btn" class="btn-primary">Save Changes</button>
        <div class="save-status" id="save-status"></div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachEventListeners(container);
}

/**
 * Load API keys from storage and mask for display
 * @returns {Promise<Object>} API keys object
 */
export async function loadApiKeys() {
  const keys = await storage.getApiKeys();

  // Mask keys for display (show first 8 + ... + last 4 chars)
  const maskKey = (key) => {
    if (!key || key.length < 12) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  return {
    claude: maskKey(keys.claude),
    adzuna: {
      appId: maskKey(keys.adzuna?.appId || ''),
      appKey: maskKey(keys.adzuna?.appKey || '')
    },
    jsearch: maskKey(keys.jsearch)
  };
}

/**
 * Attach event listeners to settings elements
 * @param {HTMLElement} container - Container element
 */
function attachEventListeners(container) {
  // Toggle visibility buttons
  container.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', handleToggleVisibility);
  });

  // Test connection buttons
  container.querySelectorAll('.btn-test').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const service = e.target.dataset.service;
      testConnection(service);
    });
  });

  // Save button
  const saveBtn = container.querySelector('#save-settings-btn');
  saveBtn.addEventListener('click', saveSettings);
}

/**
 * Toggle password visibility
 */
function handleToggleVisibility(e) {
  const targetId = e.currentTarget.dataset.target;
  const input = document.getElementById(targetId);

  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

/**
 * Test API connection
 * @param {string} service - Service name
 */
async function testConnection(service) {
  const statusEl = document.getElementById(`status-settings-${service}`);

  // Clear previous status
  statusEl.className = 'status-indicator';
  statusEl.innerHTML = '';

  // Get credentials
  let credentials;
  try {
    credentials = getCredentials(service);
    if (!credentials) {
      showError(statusEl, 'Please enter API key');
      return;
    }
  } catch (error) {
    showError(statusEl, error.message);
    return;
  }

  // Show loading state
  statusEl.classList.add('loading');
  statusEl.textContent = 'Testing...';

  try {
    // Send message to background script to test connection
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API_CONNECTION',
      service,
      credentials
    });

    // Clear loading state
    statusEl.classList.remove('loading');

    if (response.success) {
      showSuccess(statusEl, 'Connected');
    } else {
      showError(statusEl, response.message || response.error || 'Connection failed');
    }
  } catch (error) {
    statusEl.classList.remove('loading');
    showError(statusEl, error.message || 'Connection test failed');
  }
}

/**
 * Get credentials from input fields
 * @param {string} service - Service name
 * @returns {Object} Credentials object
 */
function getCredentials(service) {
  if (service === 'claude') {
    const key = document.getElementById('settings-claude-key').value.trim();
    if (!key) return null;
    return { apiKey: key };
  } else if (service === 'adzuna') {
    const appId = document.getElementById('settings-adzuna-app-id').value.trim();
    const appKey = document.getElementById('settings-adzuna-app-key').value.trim();
    if (!appId || !appKey) return null;
    return { appId, appKey };
  } else if (service === 'jsearch') {
    const key = document.getElementById('settings-jsearch-key').value.trim();
    if (!key) return null;
    return { apiKey: key };
  }
  return null;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const saveStatus = document.getElementById('save-status');

  // Clear previous status
  saveStatus.className = 'save-status';
  saveStatus.innerHTML = '';

  try {
    // Get values from inputs
    const claudeKey = document.getElementById('settings-claude-key').value.trim();
    const adzunaAppId = document.getElementById('settings-adzuna-app-id').value.trim();
    const adzunaAppKey = document.getElementById('settings-adzuna-app-key').value.trim();
    const jsearchKey = document.getElementById('settings-jsearch-key').value.trim();

    // Save to storage (only save non-masked values)
    // Check if values are masked (contain '...')
    const updates = {};

    if (claudeKey && !claudeKey.includes('...')) {
      updates.claude = claudeKey;
    }

    if (adzunaAppId || adzunaAppKey) {
      updates.adzuna = {};
      if (adzunaAppId && !adzunaAppId.includes('...')) {
        updates.adzuna.appId = adzunaAppId;
      }
      if (adzunaAppKey && !adzunaAppKey.includes('...')) {
        updates.adzuna.appKey = adzunaAppKey;
      }
    }

    if (jsearchKey && !jsearchKey.includes('...')) {
      updates.jsearch = jsearchKey;
    }

    // Only save if there are updates
    if (Object.keys(updates).length > 0) {
      await storage.setApiKeys(updates);
      showSuccess(saveStatus, 'Saved');

      // Clear save status after 2 seconds
      setTimeout(() => {
        saveStatus.className = 'save-status';
        saveStatus.innerHTML = '';
      }, 2000);
    } else {
      showError(saveStatus, 'No changes to save');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showError(saveStatus, 'Failed to save');
  }
}

/**
 * Show success status
 */
function showSuccess(el, message) {
  el.classList.add('success');
  el.textContent = message;
}

/**
 * Show error status
 */
function showError(el, message) {
  el.classList.add('error');
  el.textContent = message;
}
