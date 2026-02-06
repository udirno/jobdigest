import { storage } from './storage.js';
import { ApiError } from './errors.js';
import { keepAlive } from './keep-alive.js';

console.log('JobDigest service worker started');

// TEMPORARY TEST CODE - will be removed after verification
async function testKeepAlive() {
  const cleanup = keepAlive.start('test');
  // Check alarm was created
  const alarm = await chrome.alarms.get('keepalive-test');
  console.log('Keep-alive alarm:', alarm ? 'PASS' : 'FAIL');

  keepAlive.stop('test');
  const alarmAfter = await chrome.alarms.get('keepalive-test');
  console.log('Keep-alive stopped:', !alarmAfter ? 'PASS' : 'FAIL');

  // Test withKeepAlive wrapper
  const result = await keepAlive.withKeepAlive('test2', async () => {
    return 'done';
  });
  console.log('withKeepAlive:', result === 'done' ? 'PASS' : 'FAIL');
  const alarmAfter2 = await chrome.alarms.get('keepalive-test2');
  console.log('Cleaned up:', !alarmAfter2 ? 'PASS' : 'FAIL');
}
testKeepAlive();
