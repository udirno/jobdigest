// Storage key constants
export const STORAGE_KEYS = {
  API_KEYS: 'apiKeys',       // { claude: string, adzuna: { appId: string, appKey: string }, jsearch: string }
  SETTINGS: 'settings',       // { fetchHour: number, fetchMinute: number, timezone: string, searchKeywords: [], location: '', salaryMin: number|null, datePosted: string, employmentType: string, remoteOnly: boolean }
  RESUME: 'resume',           // { text: string, fileName: string, uploadedAt: string }
  JOBS: 'jobs',               // { [jobId]: { ...jobData, generated?: { coverLetter, recruiterMsg } } }
  DAILY_STATS: 'dailyStats',  // { date: 'YYYY-MM-DD', jobsFetched: number }
  ONBOARDING: 'onboarding',   // { completed: boolean, completedAt: string }
  BATCH_PROGRESS: 'batchProgress', // { inProgress: boolean, lastBatchIndex: number, totalBatches: number }
  FETCH_HISTORY: 'fetchHistory', // Array of { date: string, startedAt: string, completedAt: string|null, status: string, jobsFetched: number, adzunaCount: number, jsearchCount: number, errors: string[] }
  ADAPTIVE_METRICS: 'adaptiveMetrics' // { adzuna: { recentWindow: [] }, jsearch: { recentWindow: [] }, lastCalibration: string|null }
};

// Storage abstraction layer
export const storage = {
  /**
   * Get a value from storage by key
   * @param {string} key - Storage key
   * @returns {Promise<any>} Value or null if not found
   */
  async get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== undefined ? result[key] : null;
    } catch (error) {
      if (chrome.runtime.lastError) {
        console.error('Storage get error:', chrome.runtime.lastError);
        throw new Error(chrome.runtime.lastError.message);
      }
      console.error('Storage get error:', error);
      throw error;
    }
  },

  /**
   * Set a value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      if (chrome.runtime.lastError) {
        console.error('Storage set error:', chrome.runtime.lastError);
        throw new Error(chrome.runtime.lastError.message);
      }
      console.error('Storage set error:', error);
      throw error;
    }
  },

  /**
   * Get API keys with defaults
   * @returns {Promise<Object>} API keys object
   */
  async getApiKeys() {
    const keys = await this.get(STORAGE_KEYS.API_KEYS);
    return keys || {
      claude: '',
      adzuna: { appId: '', appKey: '' },
      jsearch: ''
    };
  },

  /**
   * Save API keys (merges with existing)
   * @param {Object} keys - API keys object (partial update safe)
   * @returns {Promise<void>}
   */
  async setApiKeys(keys) {
    const existing = await this.getApiKeys();
    const merged = {
      ...existing,
      ...keys,
      // Deep merge for adzuna object
      adzuna: {
        ...existing.adzuna,
        ...(keys.adzuna || {})
      }
    };
    await this.set(STORAGE_KEYS.API_KEYS, merged);
  },

  /**
   * Get jobs object map
   * @returns {Promise<Object>} Jobs map indexed by jobId
   */
  async getJobs() {
    const jobs = await this.get(STORAGE_KEYS.JOBS);
    return jobs || {};
  },

  /**
   * Save a single job (read-modify-write pattern)
   * @param {string} jobId - Job ID
   * @param {Object} jobData - Job data object
   * @returns {Promise<void>}
   */
  async saveJob(jobId, jobData) {
    const jobs = await this.getJobs();
    jobs[jobId] = jobData;
    await this.set(STORAGE_KEYS.JOBS, jobs);
  },

  /**
   * Save multiple jobs (merges with existing map)
   * @param {Object} jobsMap - Jobs object map
   * @returns {Promise<void>}
   */
  async saveJobs(jobsMap) {
    const existing = await this.getJobs();
    const merged = { ...existing, ...jobsMap };
    await this.set(STORAGE_KEYS.JOBS, merged);
  },

  /**
   * Get today's daily stats (auto-resets if date changed)
   * @returns {Promise<Object>} Daily stats with date and count
   */
  async getDailyStats() {
    const stats = await this.get(STORAGE_KEYS.DAILY_STATS);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Auto-reset if date changed
    if (!stats || stats.date !== today) {
      return { date: today, jobsFetched: 0 };
    }

    return stats;
  },

  /**
   * Increment today's job fetch count
   * @param {number} count - Number of jobs to add to count
   * @returns {Promise<void>}
   */
  async incrementDailyCount(count) {
    const stats = await this.getDailyStats();
    stats.jobsFetched += count;
    await this.set(STORAGE_KEYS.DAILY_STATS, stats);
  },

  /**
   * Get onboarding status
   * @returns {Promise<Object>} Onboarding status
   */
  async getOnboarding() {
    const status = await this.get(STORAGE_KEYS.ONBOARDING);
    return status || { completed: false, completedAt: null };
  },

  /**
   * Set onboarding status
   * @param {Object} status - Onboarding status object
   * @returns {Promise<void>}
   */
  async setOnboarding(status) {
    await this.set(STORAGE_KEYS.ONBOARDING, status);
  },

  /**
   * Get batch progress for service worker restart recovery
   * @returns {Promise<Object>} Batch progress
   */
  async getBatchProgress() {
    const progress = await this.get(STORAGE_KEYS.BATCH_PROGRESS);
    return progress || { inProgress: false, lastBatchIndex: 0, totalBatches: 0 };
  },

  /**
   * Set batch progress
   * @param {Object} progress - Batch progress object
   * @returns {Promise<void>}
   */
  async setBatchProgress(progress) {
    await this.set(STORAGE_KEYS.BATCH_PROGRESS, progress);
  },

  /**
   * Clear batch progress on completion
   * @returns {Promise<void>}
   */
  async clearBatchProgress() {
    await this.set(STORAGE_KEYS.BATCH_PROGRESS, {
      inProgress: false,
      lastBatchIndex: 0,
      totalBatches: 0
    });
  },

  /**
   * Get resume data
   * @returns {Promise<Object|null>} Resume object or null if not set
   */
  async getResume() {
    return await this.get(STORAGE_KEYS.RESUME);
  },

  /**
   * Save resume data
   * @param {Object} resume - Resume object { text: string, fileName: string, uploadedAt: string }
   * @returns {Promise<void>}
   */
  async setResume(resume) {
    await this.set(STORAGE_KEYS.RESUME, resume);
  },

  /**
   * Clear resume data
   * @returns {Promise<void>}
   */
  async clearResume() {
    await this.set(STORAGE_KEYS.RESUME, null);
  },

  /**
   * Get settings with defaults
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return settings || {
      fetchHour: 6,
      fetchMinute: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      searchKeywords: [],
      location: '',
      salaryMin: null,
      datePosted: 'all',
      employmentType: 'FULLTIME',
      remoteOnly: false
    };
  },

  /**
   * Save settings (merges with existing)
   * @param {Object} settings - Settings object (partial update safe)
   * @returns {Promise<void>}
   */
  async setSettings(settings) {
    const existing = await this.getSettings();
    const merged = {
      ...existing,
      ...settings
    };
    await this.set(STORAGE_KEYS.SETTINGS, merged);
  },

  /**
   * Get fetch history
   * @returns {Promise<Array>} Fetch history array (last 7 entries)
   */
  async getFetchHistory() {
    const history = await this.get(STORAGE_KEYS.FETCH_HISTORY);
    return history || [];
  },

  /**
   * Add fetch history entry (keeps last 7 entries)
   * @param {Object} entry - Fetch history entry
   * @returns {Promise<void>}
   */
  async addFetchHistoryEntry(entry) {
    const history = await this.getFetchHistory();
    history.push(entry);

    // Keep only last 7 entries
    const trimmed = history.slice(-7);

    await this.set(STORAGE_KEYS.FETCH_HISTORY, trimmed);
  },

  /**
   * Get adaptive metrics
   * @returns {Promise<Object>} Adaptive metrics object
   */
  async getAdaptiveMetrics() {
    const metrics = await this.get(STORAGE_KEYS.ADAPTIVE_METRICS);
    return metrics || {
      adzuna: { recentWindow: [] },
      jsearch: { recentWindow: [] },
      lastCalibration: null
    };
  },

  /**
   * Save adaptive metrics
   * @param {Object} metrics - Adaptive metrics object
   * @returns {Promise<void>}
   */
  async setAdaptiveMetrics(metrics) {
    await this.set(STORAGE_KEYS.ADAPTIVE_METRICS, metrics);
  },

  /**
   * Update individual job fields (convenience method)
   * @param {string} jobId - Job ID
   * @param {Object} updates - Fields to update (e.g., { notes: '...', dismissed: true })
   * @returns {Promise<Object|null>} Updated job object or null if job not found
   */
  async updateJob(jobId, updates) {
    const jobs = await this.getJobs();
    if (!jobs[jobId]) return null;
    Object.assign(jobs[jobId], updates);
    await this.set(STORAGE_KEYS.JOBS, jobs);
    return jobs[jobId];
  }
};
