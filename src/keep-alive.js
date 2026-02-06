/**
 * Keep-alive utilities for Chrome Manifest V3 service workers
 *
 * Service workers terminate after 30 seconds of inactivity.
 * This module provides dual keep-alive mechanisms:
 * 1. chrome.alarms API (primary) - creates recurring alarm every 25 seconds
 * 2. setTimeout self-ping (backup) - calls lightweight API every 20 seconds
 */

// Track active keep-alive intervals
const activeIntervals = new Map();

export const keepAlive = {
  /**
   * Start keep-alive for a tagged operation
   * @param {string} tag - Operation identifier (e.g., 'job-fetch', 'ai-scoring')
   * @returns {Function} Cleanup function
   */
  start(tag) {
    const alarmName = `keepalive-${tag}`;

    // Create recurring alarm every 25 seconds (service worker times out at 30s)
    chrome.alarms.create(alarmName, {
      delayInMinutes: 25 / 60, // 25 seconds
      periodInMinutes: 25 / 60
    });

    // Set up setTimeout self-ping as backup (every 20 seconds)
    const intervalId = setInterval(() => {
      // Lightweight API call to reset idle timer
      chrome.runtime.getPlatformInfo().catch(err => {
        console.warn('Keep-alive ping failed:', err);
      });
    }, 20000); // 20 seconds

    // Store interval ID for cleanup
    activeIntervals.set(tag, intervalId);

    console.log(`Keep-alive started for ${tag}`);

    // Return cleanup function
    return () => this.stop(tag);
  },

  /**
   * Stop keep-alive for a tagged operation
   * @param {string} tag - Operation identifier
   */
  stop(tag) {
    const alarmName = `keepalive-${tag}`;

    // Clear the alarm
    chrome.alarms.clear(alarmName);

    // Clear the setTimeout interval
    const intervalId = activeIntervals.get(tag);
    if (intervalId) {
      clearInterval(intervalId);
      activeIntervals.delete(tag);
    }

    console.log(`Keep-alive stopped for ${tag}`);
  },

  /**
   * Convenience wrapper: run async function with keep-alive
   * @param {string} tag - Operation identifier
   * @param {Function} asyncFn - Async function to run
   * @returns {Promise<any>} Result of asyncFn
   */
  async withKeepAlive(tag, asyncFn) {
    const cleanup = this.start(tag);

    try {
      const result = await asyncFn();
      return result;
    } finally {
      cleanup();
    }
  }
};
