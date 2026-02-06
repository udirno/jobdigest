import { storage } from './storage.js';
import { processResumeFile } from './resume-parser.js';

/**
 * Initialize settings panel
 * @param {HTMLElement} container - Container element to render settings into
 */
export async function initSettings(container) {
  // Load current API keys
  const apiKeys = await loadApiKeys();

  // Render settings form
  container.innerHTML = `
    <!-- Resume Section -->
    <div class="settings-section resume-section">
      <h3 class="section-title">Resume</h3>
      <p class="section-description">Upload your resume for AI job matching.</p>

      <!-- Current resume status -->
      <div class="resume-status" id="resume-status">
        <span class="status-text">Loading...</span>
      </div>

      <!-- File upload area -->
      <div class="upload-area">
        <input type="file" id="resume-upload" accept=".pdf,.docx" class="file-input">
        <label for="resume-upload" class="btn-upload">Upload PDF or DOCX</label>
        <span class="upload-hint">PDF or DOCX, max 5MB</span>
      </div>

      <!-- Text paste area -->
      <div class="text-paste-area">
        <div class="divider-text">Or paste resume text:</div>
        <textarea id="resume-text" class="resume-textarea" rows="6" placeholder="Paste your resume content here..."></textarea>
        <button id="save-resume-text" class="btn-primary btn-sm">Save Text</button>
      </div>

      <!-- Processing/status feedback -->
      <div class="status-indicator" id="resume-feedback"></div>
    </div>

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

  // Load resume status
  await loadResumeStatus();
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
  // Resume file upload handler
  const fileInput = container.querySelector('#resume-upload');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  // Resume text paste handler
  const saveTextBtn = container.querySelector('#save-resume-text');
  if (saveTextBtn) {
    saveTextBtn.addEventListener('click', handleSaveResumeText);
  }

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

/**
 * Load and display resume status
 */
async function loadResumeStatus() {
  const statusEl = document.getElementById('resume-status');
  if (!statusEl) return;

  const resume = await storage.getResume();

  if (resume && resume.text) {
    // Calculate relative date
    const uploadedDate = new Date(resume.uploadedAt);
    const now = new Date();
    const daysDiff = Math.floor((now - uploadedDate) / (1000 * 60 * 60 * 24));

    let relativeDate;
    if (daysDiff === 0) {
      relativeDate = 'today';
    } else if (daysDiff === 1) {
      relativeDate = 'yesterday';
    } else {
      relativeDate = `${daysDiff} days ago`;
    }

    statusEl.innerHTML = `
      <span class="status-text">Current: <span class="file-name">${resume.fileName}</span> (uploaded ${relativeDate})</span>
      <button id="remove-resume-btn" class="btn-remove">Remove</button>
    `;

    // Attach remove button listener
    const removeBtn = document.getElementById('remove-resume-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', handleRemoveResume);
    }
  } else {
    statusEl.innerHTML = '<span class="status-text">No resume uploaded</span>';
  }
}

/**
 * Handle file upload
 */
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const feedbackEl = document.getElementById('resume-feedback');
  feedbackEl.className = 'status-indicator loading';
  feedbackEl.textContent = `Processing ${file.name}...`;

  try {
    // Process file using resume-parser
    const result = await processResumeFile(file);

    // Save to storage
    await storage.setResume(result);

    // Update status display
    await loadResumeStatus();

    // Show success message
    feedbackEl.className = 'status-indicator success';
    feedbackEl.textContent = `Resume uploaded: ${result.fileName} (${result.text.length} characters)`;

    // Clear success message after 3 seconds
    setTimeout(() => {
      feedbackEl.className = 'status-indicator';
      feedbackEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Resume upload error:', error);
    feedbackEl.className = 'status-indicator error';
    feedbackEl.textContent = error.message || 'Failed to process resume';
  }

  // Reset file input
  e.target.value = '';
}

/**
 * Handle save resume text
 */
async function handleSaveResumeText() {
  const textarea = document.getElementById('resume-text');
  const text = textarea.value.trim();
  const feedbackEl = document.getElementById('resume-feedback');

  // Validate minimum length
  if (text.length < 50) {
    feedbackEl.className = 'status-indicator error';
    feedbackEl.textContent = 'Resume text too short. Please provide at least 50 characters.';
    return;
  }

  feedbackEl.className = 'status-indicator loading';
  feedbackEl.textContent = 'Saving...';

  try {
    // Save to storage
    const resume = {
      text,
      fileName: 'pasted-text.txt',
      uploadedAt: new Date().toISOString()
    };
    await storage.setResume(resume);

    // Update status display
    await loadResumeStatus();

    // Show success message
    feedbackEl.className = 'status-indicator success';
    feedbackEl.textContent = `Resume text saved (${text.length} characters)`;

    // Clear textarea
    textarea.value = '';

    // Clear success message after 3 seconds
    setTimeout(() => {
      feedbackEl.className = 'status-indicator';
      feedbackEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Save text error:', error);
    feedbackEl.className = 'status-indicator error';
    feedbackEl.textContent = 'Failed to save resume text';
  }
}

/**
 * Handle remove resume
 */
async function handleRemoveResume() {
  const feedbackEl = document.getElementById('resume-feedback');

  try {
    await storage.clearResume();
    await loadResumeStatus();

    feedbackEl.className = 'status-indicator success';
    feedbackEl.textContent = 'Resume removed';

    // Clear message after 3 seconds
    setTimeout(() => {
      feedbackEl.className = 'status-indicator';
      feedbackEl.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Remove resume error:', error);
    feedbackEl.className = 'status-indicator error';
    feedbackEl.textContent = 'Failed to remove resume';
  }
}
