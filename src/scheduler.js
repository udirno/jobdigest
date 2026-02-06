import { storage } from './storage.js';

/**
 * Schedule daily job fetch at specified time
 * @param {number|null} hour - Hour (0-23), defaults to stored setting
 * @param {number|null} minute - Minute (0-59), defaults to stored setting
 * @returns {Promise<Date>} Next fetch time
 */
export async function scheduleDailyFetch(hour = null, minute = null) {
  // Load settings
  const settings = await storage.getSettings();
  const fetchHour = hour ?? settings.fetchHour;
  const fetchMinute = minute ?? settings.fetchMinute;

  // Calculate next occurrence of preferred time in local timezone
  const now = new Date();
  const nextFetch = new Date();
  nextFetch.setHours(fetchHour, fetchMinute, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (nextFetch <= now) {
    nextFetch.setDate(nextFetch.getDate() + 1);
  }

  // Clear existing alarm first
  await chrome.alarms.clear('daily-job-fetch');

  // Create alarm with next fetch time and 24-hour period
  chrome.alarms.create('daily-job-fetch', {
    when: nextFetch.getTime(),
    periodInMinutes: 1440 // 24 hours
  });

  console.log(`Daily fetch scheduled for ${nextFetch.toLocaleString()}`);

  return nextFetch;
}

/**
 * Verify daily fetch alarm exists, recreate if missing
 * @returns {Promise<Object>} Alarm status { exists, scheduledTime, recreated? }
 */
export async function verifyAlarmExists() {
  const alarm = await chrome.alarms.get('daily-job-fetch');

  if (alarm) {
    return {
      exists: true,
      scheduledTime: new Date(alarm.scheduledTime)
    };
  }

  // Alarm missing, recreate it
  console.warn('Daily fetch alarm missing, recreating...');
  const nextFetch = await scheduleDailyFetch();

  return {
    exists: false,
    recreated: true,
    scheduledTime: nextFetch
  };
}

/**
 * Get next scheduled fetch time
 * @returns {Promise<Date|null>} Next fetch time or null if no alarm
 */
export async function getNextFetchTime() {
  const alarm = await chrome.alarms.get('daily-job-fetch');

  if (alarm) {
    return new Date(alarm.scheduledTime);
  }

  return null;
}
