import { storage } from './storage.js';

// State
let currentStep = 1;
const totalSteps = 3;

// DOM elements (will be initialized on DOMContentLoaded)
let stepContents, stepIndicators, backBtn, continueBtn, skipLink, completionMessage;

// Initialize onboarding
document.addEventListener('DOMContentLoaded', async () => {
  // Check if onboarding already completed
  const onboardingStatus = await storage.getOnboarding();
  if (onboardingStatus.completed) {
    showAlreadyCompleted();
    return;
  }

  // Initialize DOM elements
  stepContents = document.querySelectorAll('.step-content');
  stepIndicators = document.querySelectorAll('.step');
  backBtn = document.getElementById('back-btn');
  continueBtn = document.getElementById('continue-btn');
  skipLink = document.getElementById('skip-link');
  completionMessage = document.getElementById('completion-message');

  // Attach event listeners
  attachEventListeners();

  // Show initial step
  updateStepDisplay();
});

/**
 * Show already completed message
 */
function showAlreadyCompleted() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <h2 style="color: var(--accent); margin-bottom: 16px;">Already Set Up</h2>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">
        Your onboarding is complete. You can close this tab.
      </p>
      <button onclick="window.close()" style="
        padding: 12px 24px;
        background-color: var(--accent);
        color: var(--bg-primary);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      ">Close Tab</button>
    </div>
  `;
}

/**
 * Attach all event listeners
 */
function attachEventListeners() {
  // Navigation buttons
  backBtn.addEventListener('click', handleBack);
  continueBtn.addEventListener('click', handleContinue);
  skipLink.addEventListener('click', handleSkip);

  // Toggle visibility buttons
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', handleToggleVisibility);
  });

  // Test connection buttons
  document.getElementById('test-claude').addEventListener('click', () => testConnection('claude'));
  document.getElementById('test-adzuna').addEventListener('click', () => testConnection('adzuna'));
  document.getElementById('test-jsearch').addEventListener('click', () => testConnection('jsearch'));
}

/**
 * Update step display based on current step
 */
function updateStepDisplay() {
  // Update step contents visibility
  stepContents.forEach((content, index) => {
    if (index + 1 === currentStep) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });

  // Update step indicators
  stepIndicators.forEach((indicator, index) => {
    if (index + 1 < currentStep) {
      indicator.classList.add('completed');
      indicator.classList.remove('active');
    } else if (index + 1 === currentStep) {
      indicator.classList.add('active');
      indicator.classList.remove('completed');
    } else {
      indicator.classList.remove('active', 'completed');
    }
  });

  // Update buttons
  backBtn.disabled = currentStep === 1;
  continueBtn.textContent = currentStep === totalSteps ? 'Finish' : 'Continue';
}

/**
 * Handle back button click
 */
function handleBack() {
  if (currentStep > 1) {
    currentStep--;
    updateStepDisplay();
  }
}

/**
 * Handle continue/finish button click
 */
async function handleContinue() {
  // Save current step's API key
  await saveCurrentStep();

  if (currentStep === totalSteps) {
    // Finish onboarding
    await completeOnboarding();
  } else {
    // Move to next step
    currentStep++;
    updateStepDisplay();
  }
}

/**
 * Handle skip link click
 */
async function handleSkip(e) {
  e.preventDefault();

  // Save empty key for current step
  await saveCurrentStep(true);

  if (currentStep === totalSteps) {
    // Finish onboarding
    await completeOnboarding();
  } else {
    // Move to next step
    currentStep++;
    updateStepDisplay();
  }
}

/**
 * Save current step's API key to storage
 * @param {boolean} skipEmpty - Whether to save empty keys (from skip action)
 */
async function saveCurrentStep(skipEmpty = false) {
  try {
    if (currentStep === 1) {
      // Claude API key
      const claudeKey = skipEmpty ? '' : document.getElementById('claude-key').value.trim();
      await storage.setApiKeys({ claude: claudeKey });
    } else if (currentStep === 2) {
      // Adzuna API key
      const appId = skipEmpty ? '' : document.getElementById('adzuna-app-id').value.trim();
      const appKey = skipEmpty ? '' : document.getElementById('adzuna-app-key').value.trim();
      await storage.setApiKeys({ adzuna: { appId, appKey } });
    } else if (currentStep === 3) {
      // JSearch API key
      const jsearchKey = skipEmpty ? '' : document.getElementById('jsearch-key').value.trim();
      await storage.setApiKeys({ jsearch: jsearchKey });
    }
  } catch (error) {
    console.error('Error saving API keys:', error);
  }
}

/**
 * Complete onboarding process
 */
async function completeOnboarding() {
  // Mark onboarding as completed
  await storage.setOnboarding({
    completed: true,
    completedAt: new Date().toISOString()
  });

  // Hide step content and navigation
  stepContents.forEach(content => content.classList.add('hidden'));
  document.querySelector('.navigation').style.display = 'none';
  document.querySelector('.step-indicator').style.display = 'none';

  // Show completion message
  completionMessage.classList.remove('hidden');

  // Close tab after 3 seconds
  setTimeout(() => {
    window.close();
  }, 3000);
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
 * @param {string} service - Service name ('claude', 'adzuna', 'jsearch')
 */
async function testConnection(service) {
  const statusEl = document.getElementById(`status-${service}`);
  const testBtn = document.getElementById(`test-${service}`);

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
  testBtn.disabled = true;

  try {
    // Send message to background script to test connection
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API_CONNECTION',
      service,
      credentials
    });

    // Clear loading state
    statusEl.classList.remove('loading');
    testBtn.disabled = false;

    if (response.success) {
      showSuccess(statusEl, 'Connected');
    } else {
      showError(statusEl, response.message || response.error || 'Connection failed');
    }
  } catch (error) {
    statusEl.classList.remove('loading');
    testBtn.disabled = false;
    showError(statusEl, error.message || 'Connection test failed');
  }
}

/**
 * Get credentials for a service from input fields
 * @param {string} service - Service name
 * @returns {Object} Credentials object
 */
function getCredentials(service) {
  if (service === 'claude') {
    const key = document.getElementById('claude-key').value.trim();
    if (!key) return null;
    return { apiKey: key };
  } else if (service === 'adzuna') {
    const appId = document.getElementById('adzuna-app-id').value.trim();
    const appKey = document.getElementById('adzuna-app-key').value.trim();
    if (!appId || !appKey) return null;
    return { appId, appKey };
  } else if (service === 'jsearch') {
    const key = document.getElementById('jsearch-key').value.trim();
    if (!key) return null;
    return { apiKey: key };
  }
  return null;
}

/**
 * Show success status
 */
function showSuccess(statusEl, message) {
  statusEl.classList.add('success');
  statusEl.textContent = message;
}

/**
 * Show error status
 */
function showError(statusEl, message) {
  statusEl.classList.add('error');
  statusEl.textContent = message;
}
