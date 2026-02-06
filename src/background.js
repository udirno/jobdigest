import { storage, STORAGE_KEYS } from './storage.js';
import { retryWithBackoff, ApiError, getUserMessage } from './errors.js';

console.log('JobDigest service worker started');

// Test storage layer
async function testStorage() {
  await storage.set(STORAGE_KEYS.ONBOARDING, { completed: false });
  const result = await storage.getOnboarding();
  console.log('Storage test:', result.completed === false ? 'PASS' : 'FAIL');
}

// Test error handling
async function testErrors() {
  // Test 1: retryWithBackoff succeeds on first try
  const result = await retryWithBackoff(async () => 'ok');
  console.log('Backoff immediate:', result === 'ok' ? 'PASS' : 'FAIL');

  // Test 2: getUserMessage for 401
  const err = new ApiError('Unauthorized', { status: 401, service: 'claude' });
  const msg = getUserMessage(err);
  console.log('User message:', msg.includes('API key') ? 'PASS' : 'FAIL');

  // Test 3: retryWithBackoff retries then succeeds
  let attempt = 0;
  const result2 = await retryWithBackoff(async () => {
    attempt++;
    if (attempt < 3) throw new ApiError('fail', { status: 500, retryable: true });
    return 'recovered';
  }, { maxRetries: 3, baseDelay: 100 });
  console.log('Backoff retry:', result2 === 'recovered' ? 'PASS' : 'FAIL');
}

// Run tests
testStorage();
testErrors();

// Service worker will be extended in future plans with alarm management
// and job fetching orchestration
