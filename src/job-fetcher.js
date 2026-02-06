import { storage } from './storage.js';
import { keepAlive } from './keep-alive.js';
import { fetchAdzunaJobs } from './api/adzuna.js';
import { fetchJSearchJobs } from './api/jsearch.js';
import { calculateAdaptiveAllocation, updateAdaptiveMetrics } from './adaptive-distribution.js';
import { scoreUnscoredJobs } from './job-scorer.js';

/**
 * Main entry point for complete fetch cycle
 * @param {Object} options - { manual: boolean }
 * @returns {Promise<Object>} Fetch result with status and counts
 */
export async function runJobFetch(options = {}) {
  // Check daily cap
  const dailyStats = await storage.getDailyStats();

  if (dailyStats.jobsFetched >= 100) {
    console.log('Daily cap of 100 jobs reached');
    return {
      status: 'cap_reached',
      jobsFetched: 0,
      message: 'Daily cap of 100 jobs reached'
    };
  }

  const remaining = 100 - dailyStats.jobsFetched;

  // Create fetch history entry
  const historyEntry = {
    date: new Date().toISOString().split('T')[0],
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'in_progress',
    jobsFetched: 0,
    adzunaCount: 0,
    jsearchCount: 0,
    errors: [],
    manual: options.manual || false
  };

  // Set batch progress
  await storage.setBatchProgress({
    inProgress: true,
    stage: 'bootstrap-adzuna',
    lastBatchIndex: 0,
    totalBatches: 4,
    fetchedJobs: {}
  });

  // Wrap entire operation in keep-alive
  try {
    await keepAlive.withKeepAlive('job-fetch', async () => {
      await executeFetchPipeline(remaining, historyEntry);
    });

    // Success
    historyEntry.status = 'success';
    historyEntry.completedAt = new Date().toISOString();
    await storage.addFetchHistoryEntry(historyEntry);
    await storage.clearBatchProgress();

    console.log(`Job fetch complete: ${historyEntry.jobsFetched} jobs fetched`);

    return {
      status: 'success',
      jobsFetched: historyEntry.jobsFetched,
      adzunaCount: historyEntry.adzunaCount,
      jsearchCount: historyEntry.jsearchCount,
      errors: historyEntry.errors || [],
      scoringResult: historyEntry.scoringResult || null
    };
  } catch (error) {
    console.error('Job fetch failed:', error);

    // Determine status based on whether any jobs were saved
    historyEntry.status = historyEntry.jobsFetched > 0 ? 'partial' : 'failed';
    historyEntry.completedAt = new Date().toISOString();
    historyEntry.errors.push(error.message);
    await storage.addFetchHistoryEntry(historyEntry);
    await storage.clearBatchProgress();

    return {
      status: 'failed',
      error: error.message,
      jobsFetched: historyEntry.jobsFetched,
      errors: historyEntry.errors || [],
      scoringResult: historyEntry.scoringResult || null
    };
  }
}

/**
 * Resume fetch after service worker restart
 * @returns {Promise<Object|null>} Fetch result or null if nothing to resume
 */
export async function resumeJobFetch() {
  const progress = await storage.getBatchProgress();

  if (!progress.inProgress) {
    return null;
  }

  console.log('Resuming fetch from stage:', progress.stage);

  // Create new history entry for resumed session
  const historyEntry = {
    date: new Date().toISOString().split('T')[0],
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'in_progress',
    jobsFetched: 0,
    adzunaCount: 0,
    jsearchCount: 0,
    errors: [],
    manual: false,
    resumed: true
  };

  // Calculate remaining from daily cap
  const dailyStats = await storage.getDailyStats();
  const remaining = 100 - dailyStats.jobsFetched;

  try {
    await keepAlive.withKeepAlive('job-fetch', async () => {
      await executeFetchPipeline(remaining, historyEntry, progress.stage);
    });

    // Success
    historyEntry.status = 'success';
    historyEntry.completedAt = new Date().toISOString();
    await storage.addFetchHistoryEntry(historyEntry);
    await storage.clearBatchProgress();

    console.log(`Resumed job fetch complete: ${historyEntry.jobsFetched} jobs fetched`);

    return {
      status: 'success',
      jobsFetched: historyEntry.jobsFetched,
      adzunaCount: historyEntry.adzunaCount,
      jsearchCount: historyEntry.jsearchCount,
      errors: historyEntry.errors || [],
      scoringResult: historyEntry.scoringResult || null
    };
  } catch (error) {
    console.error('Resumed job fetch failed:', error);

    historyEntry.status = historyEntry.jobsFetched > 0 ? 'partial' : 'failed';
    historyEntry.completedAt = new Date().toISOString();
    historyEntry.errors.push(error.message);
    await storage.addFetchHistoryEntry(historyEntry);
    await storage.clearBatchProgress();

    return {
      status: 'failed',
      error: error.message,
      jobsFetched: historyEntry.jobsFetched,
      errors: historyEntry.errors || [],
      scoringResult: historyEntry.scoringResult || null
    };
  }
}

/**
 * Internal fetch pipeline with checkpoint stages
 * @param {number} maxJobs - Maximum jobs to fetch (from daily cap)
 * @param {Object} historyEntry - History entry to update
 * @param {string} startStage - Stage to start from (for resume)
 * @returns {Promise<void>}
 */
async function executeFetchPipeline(maxJobs, historyEntry, startStage = 'bootstrap-adzuna') {
  const bootstrapCount = Math.min(25, Math.floor(maxJobs / 2));
  let adzunaJobs = [];
  let jsearchJobs = [];
  const allErrors = [];

  // Load previously fetched jobs if resuming
  const progress = await storage.getBatchProgress();
  const savedJobs = progress.fetchedJobs || {};

  // Fall-through switch for checkpoint stages
  switch (startStage) {
    case 'bootstrap-adzuna': {
      await storage.setBatchProgress({
        inProgress: true,
        stage: 'bootstrap-adzuna',
        totalBatches: 4,
        fetchedJobs: savedJobs
      });

      try {
        console.log(`Fetching ${bootstrapCount} jobs from Adzuna...`);
        adzunaJobs = await fetchAdzunaJobs(bootstrapCount);

        // Deduplicate against existing stored jobs
        const existingJobs = await storage.getJobs();
        adzunaJobs = adzunaJobs.filter(j => !existingJobs[j.jobId]);

        // Save immediately (checkpoint)
        const adzunaMap = {};
        adzunaJobs.forEach(j => { adzunaMap[j.jobId] = j; });
        await storage.saveJobs(adzunaMap);

        savedJobs.adzunaBootstrap = adzunaJobs.length;
        historyEntry.adzunaCount += adzunaJobs.length;

        console.log(`Adzuna bootstrap: saved ${adzunaJobs.length} jobs`);
      } catch (error) {
        console.error('Adzuna bootstrap failed:', error);
        allErrors.push(`Adzuna: ${error.message}`);
        // Continue to JSearch even if Adzuna fails
      }
    }
    // falls through

    case 'bootstrap-jsearch': {
      await storage.setBatchProgress({
        inProgress: true,
        stage: 'bootstrap-jsearch',
        totalBatches: 4,
        fetchedJobs: savedJobs
      });

      try {
        console.log(`Fetching ${bootstrapCount} jobs from JSearch...`);
        jsearchJobs = await fetchJSearchJobs(bootstrapCount);

        // Deduplicate against existing stored jobs
        const existingJobs = await storage.getJobs();
        jsearchJobs = jsearchJobs.filter(j => !existingJobs[j.jobId]);

        // Save immediately (checkpoint)
        const jsearchMap = {};
        jsearchJobs.forEach(j => { jsearchMap[j.jobId] = j; });
        await storage.saveJobs(jsearchMap);

        savedJobs.jsearchBootstrap = jsearchJobs.length;
        historyEntry.jsearchCount += jsearchJobs.length;

        console.log(`JSearch bootstrap: saved ${jsearchJobs.length} jobs`);
      } catch (error) {
        console.error('JSearch bootstrap failed:', error);
        allErrors.push(`JSearch: ${error.message}`);
      }
    }
    // falls through

    case 'adaptive-allocation': {
      await storage.setBatchProgress({
        inProgress: true,
        stage: 'adaptive-allocation',
        totalBatches: 4,
        fetchedJobs: savedJobs
      });

      // Calculate how many more jobs to fetch from each API
      const totalBootstrap = (savedJobs.adzunaBootstrap || 0) + (savedJobs.jsearchBootstrap || 0);
      const remainingToFetch = Math.min(maxJobs - totalBootstrap, 50);

      if (remainingToFetch <= 0) {
        console.log('Already at or near cap, skipping remaining fetch');
        break;
      }

      console.log(`Calculating allocation for ${remainingToFetch} remaining jobs...`);
      const allocation = await calculateAdaptiveAllocation({ adzuna: adzunaJobs, jsearch: jsearchJobs });

      // Scale allocation to fit remaining
      const totalAlloc = allocation.adzuna + allocation.jsearch;
      savedJobs.adzunaRemaining = Math.round((allocation.adzuna / totalAlloc) * remainingToFetch);
      savedJobs.jsearchRemaining = remainingToFetch - savedJobs.adzunaRemaining;

      console.log(`Allocation: Adzuna ${savedJobs.adzunaRemaining}, JSearch ${savedJobs.jsearchRemaining}`);
    }
    // falls through

    case 'remaining-fetch': {
      await storage.setBatchProgress({
        inProgress: true,
        stage: 'remaining-fetch',
        totalBatches: 4,
        fetchedJobs: savedJobs
      });

      const adzunaRemaining = savedJobs.adzunaRemaining || 25;
      const jsearchRemaining = savedJobs.jsearchRemaining || 25;

      // Fetch remaining from Adzuna
      if (adzunaRemaining > 0) {
        try {
          console.log(`Fetching ${adzunaRemaining} additional jobs from Adzuna...`);
          let moreAdzuna = await fetchAdzunaJobs(adzunaRemaining, { page: 2 });

          const existingJobs = await storage.getJobs();
          moreAdzuna = moreAdzuna.filter(j => !existingJobs[j.jobId]);

          const map = {};
          moreAdzuna.forEach(j => { map[j.jobId] = j; });
          await storage.saveJobs(map);

          historyEntry.adzunaCount += moreAdzuna.length;
          console.log(`Adzuna remaining: saved ${moreAdzuna.length} jobs`);
        } catch (error) {
          console.error('Adzuna remaining fetch failed:', error);
          allErrors.push(`Adzuna (remaining): ${error.message}`);
        }
      }

      // Fetch remaining from JSearch
      if (jsearchRemaining > 0) {
        try {
          console.log(`Fetching ${jsearchRemaining} additional jobs from JSearch...`);
          let moreJSearch = await fetchJSearchJobs(jsearchRemaining, { page: 2 });

          const existingJobs = await storage.getJobs();
          moreJSearch = moreJSearch.filter(j => !existingJobs[j.jobId]);

          const map = {};
          moreJSearch.forEach(j => { map[j.jobId] = j; });
          await storage.saveJobs(map);

          historyEntry.jsearchCount += moreJSearch.length;
          console.log(`JSearch remaining: saved ${moreJSearch.length} jobs`);
        } catch (error) {
          console.error('JSearch remaining fetch failed:', error);
          allErrors.push(`JSearch (remaining): ${error.message}`);
        }
      }
      break;
    }
  }

  // Update daily stats
  const totalFetched = historyEntry.adzunaCount + historyEntry.jsearchCount;
  historyEntry.jobsFetched = totalFetched;
  historyEntry.errors = allErrors;
  await storage.incrementDailyCount(totalFetched);

  console.log(`Fetch pipeline complete: ${totalFetched} total jobs (${historyEntry.adzunaCount} Adzuna, ${historyEntry.jsearchCount} JSearch)`);

  // Update adaptive metrics
  await updateAdaptiveMetrics(adzunaJobs, jsearchJobs);

  // Score newly fetched jobs
  console.log('Starting AI scoring for fetched jobs...');
  try {
    const scoreResult = await scoreUnscoredJobs();
    console.log(`Scoring complete: ${scoreResult.scored} scored, ${scoreResult.failed} failed`);
    historyEntry.scoringResult = {
      scored: scoreResult.scored,
      failed: scoreResult.failed,
      status: scoreResult.status
    };
  } catch (error) {
    console.error('Scoring stage failed:', error);
    historyEntry.errors.push(`Scoring: ${error.message}`);
    // Do NOT rethrow -- fetch was successful even if scoring fails
  }
}
