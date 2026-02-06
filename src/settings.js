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

    <!-- Job Fetching Section -->
    <div class="settings-section">
      <h3 class="section-title">Job Fetching</h3>
      <p class="section-description">Configure when jobs are fetched automatically.</p>

      <!-- Fetch time -->
      <div class="setting-row">
        <label class="setting-label">Daily fetch time</label>
        <div class="time-picker">
          <select id="fetch-hour" class="settings-select">
            <!-- Options 0-23, populated by JS -->
          </select>
          <span>:</span>
          <select id="fetch-minute" class="settings-select">
            <option value="0">00</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
          </select>
        </div>
      </div>

      <!-- Next fetch display -->
      <div class="setting-row">
        <span class="setting-label">Next fetch</span>
        <span id="next-fetch-time" class="setting-value">Loading...</span>
      </div>

      <!-- Daily stats -->
      <div class="setting-row">
        <span class="setting-label">Today's jobs</span>
        <span id="daily-cap-status" class="setting-value">Loading...</span>
      </div>

      <!-- Fetch history (last 5) -->
      <div class="fetch-history" id="fetch-history">
        <span class="setting-label">Recent fetches</span>
        <div id="fetch-history-list" class="history-list">Loading...</div>
      </div>

      <!-- Manual trigger button -->
      <div class="actions" style="margin-top: 12px;">
        <button type="button" id="fetch-now-btn" class="btn-primary">Fetch Jobs Now</button>
        <div class="status-indicator" id="fetch-now-status"></div>
      </div>
    </div>

    <!-- Search Preferences Section -->
    <div class="settings-section">
      <h3 class="section-title">Search Preferences</h3>
      <p class="section-description">Customize what jobs to search for.</p>

      <div class="setting-row">
        <label class="setting-label" for="search-keywords">Keywords / Job Titles</label>
        <input type="text" id="search-keywords" class="settings-input" placeholder="e.g., software engineer, frontend developer" value="">
        <span class="input-hint">Comma-separated keywords</span>
      </div>

      <div class="setting-row">
        <label class="setting-label" for="search-location">Location</label>
        <input type="text" id="search-location" class="settings-input" placeholder="e.g., San Francisco, CA" value="">
      </div>

      <div class="setting-row">
        <label class="setting-label" for="search-salary-min">Minimum Salary</label>
        <input type="number" id="search-salary-min" class="settings-input" placeholder="e.g., 100000" value="">
        <span class="input-hint">Annual salary in USD (optional)</span>
      </div>

      <div class="setting-row">
        <label class="setting-label" for="search-date-posted">Date Posted</label>
        <select id="search-date-posted" class="settings-select">
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="3days">Last 3 days</option>
          <option value="week">Last week</option>
          <option value="month">Last month</option>
        </select>
      </div>

      <div class="setting-row">
        <label class="setting-label" for="search-employment-type">Employment Type</label>
        <select id="search-employment-type" class="settings-select">
          <option value="FULLTIME">Full-time</option>
          <option value="PARTTIME">Part-time</option>
          <option value="CONTRACTOR">Contract</option>
          <option value="FULLTIME,PARTTIME,CONTRACTOR">All types</option>
        </select>
      </div>

      <div class="setting-row checkbox-row">
        <input type="checkbox" id="search-remote-only">
        <label for="search-remote-only" class="setting-label">Remote jobs only</label>
      </div>

      <div class="actions">
        <button type="button" id="save-search-btn" class="btn-primary btn-sm">Save Search Preferences</button>
        <div class="status-indicator" id="search-save-status"></div>
      </div>
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

  // Populate hour options (0-23)
  const hourSelect = container.querySelector('#fetch-hour');
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    hourSelect.appendChild(opt);
  }

  // Load fetch settings
  const settings = await storage.getSettings();
  hourSelect.value = settings.fetchHour;
  container.querySelector('#fetch-minute').value = settings.fetchMinute;
  container.querySelector('#search-keywords').value = (settings.searchKeywords || []).join(', ');
  container.querySelector('#search-location').value = settings.location || '';
  container.querySelector('#search-salary-min').value = settings.salaryMin || '';
  container.querySelector('#search-date-posted').value = settings.datePosted || 'all';
  container.querySelector('#search-employment-type').value = settings.employmentType || 'FULLTIME';
  container.querySelector('#search-remote-only').checked = settings.remoteOnly || false;

  // Attach event listeners
  attachEventListeners(container);

  // Load resume status
  await loadResumeStatus();

  // Load fetch status
  await loadFetchStatus();
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

  // Fetch time change
  const hourEl = container.querySelector('#fetch-hour');
  const minuteEl = container.querySelector('#fetch-minute');
  const updateSchedule = async () => {
    const hour = parseInt(hourEl.value, 10);
    const minute = parseInt(minuteEl.value, 10);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_FETCH_SCHEDULE',
        hour,
        minute
      });
      // Also save to settings
      await storage.setSettings({ fetchHour: hour, fetchMinute: minute });
      // Update next fetch display
      if (response.nextFetchTime) {
        document.getElementById('next-fetch-time').textContent =
          new Date(response.nextFetchTime).toLocaleString();
      }
    } catch (error) {
      console.error('Failed to update schedule:', error);
    }
  };
  hourEl.addEventListener('change', updateSchedule);
  minuteEl.addEventListener('change', updateSchedule);

  // Fetch Now button
  const fetchNowBtn = container.querySelector('#fetch-now-btn');
  fetchNowBtn.addEventListener('click', handleFetchNow);

  // Save search preferences
  const saveSearchBtn = container.querySelector('#save-search-btn');
  saveSearchBtn.addEventListener('click', handleSaveSearchPrefs);
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

/**
 * Handle Fetch Now button
 */
async function handleFetchNow() {
  const btn = document.getElementById('fetch-now-btn');
  const statusEl = document.getElementById('fetch-now-status');

  // Clear previous status
  statusEl.className = 'status-indicator';
  statusEl.innerHTML = '';

  // Disable button and show loading state
  btn.disabled = true;
  btn.textContent = 'Fetching...';
  statusEl.classList.add('loading');
  statusEl.textContent = 'Starting fetch...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRIGGER_FETCH'
    });

    // Clear loading state
    statusEl.classList.remove('loading');

    if (response.success) {
      if (response.cap_reached) {
        showError(statusEl, 'Daily cap reached (100 jobs). Try again tomorrow.');
      } else {
        const totalJobs = response.adzunaCount + response.jsearchCount;
        showSuccess(statusEl, `Fetched ${totalJobs} jobs (Adzuna: ${response.adzunaCount}, JSearch: ${response.jsearchCount})`);
      }

      // Clear success message after 5 seconds
      setTimeout(() => {
        statusEl.className = 'status-indicator';
        statusEl.innerHTML = '';
      }, 5000);

      // Refresh fetch status display
      await loadFetchStatus();
    } else {
      showError(statusEl, response.message || response.error || 'Fetch failed');
    }
  } catch (error) {
    console.error('Fetch now error:', error);
    statusEl.classList.remove('loading');
    showError(statusEl, error.message || 'Failed to trigger fetch');
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = 'Fetch Jobs Now';
  }
}

/**
 * Handle save search preferences
 */
async function handleSaveSearchPrefs() {
  const statusEl = document.getElementById('search-save-status');

  // Clear previous status
  statusEl.className = 'status-indicator';
  statusEl.innerHTML = '';

  try {
    // Get values from inputs
    const keywordsInput = document.getElementById('search-keywords').value.trim();
    const searchKeywords = keywordsInput
      ? keywordsInput.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : [];
    const location = document.getElementById('search-location').value.trim();
    const salaryMinInput = document.getElementById('search-salary-min').value.trim();
    const salaryMin = salaryMinInput ? parseInt(salaryMinInput, 10) : null;
    const datePosted = document.getElementById('search-date-posted').value;
    const employmentType = document.getElementById('search-employment-type').value;
    const remoteOnly = document.getElementById('search-remote-only').checked;

    // Save to storage
    await storage.setSettings({
      searchKeywords,
      location,
      salaryMin,
      datePosted,
      employmentType,
      remoteOnly
    });

    // Show success
    showSuccess(statusEl, 'Saved');

    // Clear success message after 2 seconds
    setTimeout(() => {
      statusEl.className = 'status-indicator';
      statusEl.innerHTML = '';
    }, 2000);
  } catch (error) {
    console.error('Save search preferences error:', error);
    showError(statusEl, 'Failed to save');
  }
}

/**
 * Load and display fetch status
 */
async function loadFetchStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_FETCH_STATUS'
    });

    // Update next fetch time
    const nextFetchEl = document.getElementById('next-fetch-time');
    if (nextFetchEl && response.nextFetchTime) {
      nextFetchEl.textContent = new Date(response.nextFetchTime).toLocaleString();
    }

    // Update daily cap status
    const dailyCapEl = document.getElementById('daily-cap-status');
    if (dailyCapEl && response.dailyStats) {
      dailyCapEl.textContent = `${response.dailyStats.jobsFetched} / 100 jobs fetched`;
    }

    // Update fetch history
    const historyListEl = document.getElementById('fetch-history-list');
    if (historyListEl && response.recentHistory) {
      if (response.recentHistory.length === 0) {
        historyListEl.innerHTML = '<div>No fetches yet</div>';
      } else {
        historyListEl.innerHTML = response.recentHistory
          .slice(-5) // Last 5 entries
          .map(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            return `<div>${date}: ${entry.jobsFetched} jobs (${entry.status})</div>`;
          })
          .join('');
      }
    }

    // If fetch in progress, update UI
    if (response.inProgress) {
      const fetchNowBtn = document.getElementById('fetch-now-btn');
      const fetchNowStatus = document.getElementById('fetch-now-status');
      if (fetchNowBtn) {
        fetchNowBtn.disabled = true;
        fetchNowBtn.textContent = 'Fetching...';
      }
      if (fetchNowStatus) {
        fetchNowStatus.classList.add('loading');
        fetchNowStatus.textContent = `Fetching (stage: ${response.currentStage || 'unknown'})...`;
      }
    }
  } catch (error) {
    console.error('Load fetch status error:', error);
  }
}
