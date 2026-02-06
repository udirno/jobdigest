import { storage } from './storage.js';

/**
 * Calculate adaptive API allocation based on quality metrics
 * @param {Object|null} bootstrapResults - { adzuna: jobArray, jsearch: jobArray }
 * @returns {Promise<Object>} { adzuna: number, jsearch: number }
 */
export async function calculateAdaptiveAllocation(bootstrapResults = null) {
  // Default: even split of remaining 50 jobs
  const defaultAllocation = { adzuna: 25, jsearch: 25 };

  // No bootstrap results or empty arrays
  if (!bootstrapResults ||
      !bootstrapResults.adzuna?.length ||
      !bootstrapResults.jsearch?.length) {
    return defaultAllocation;
  }

  const { adzuna, jsearch } = bootstrapResults;

  // Check if any jobs have scores (Phase 4 will provide them)
  const adzunaHasScores = adzuna.some(job => job.score !== null && job.score !== undefined);
  const jsearchHasScores = jsearch.some(job => job.score !== null && job.score !== undefined);

  if (!adzunaHasScores && !jsearchHasScores) {
    console.log('No scores available yet, using even split');
    return defaultAllocation;
  }

  // Calculate quality metrics per API
  const calculateQuality = (jobs) => {
    const jobsWithScores = jobs.filter(j => j.score !== null && j.score !== undefined);

    if (jobsWithScores.length === 0) {
      return 0;
    }

    // Average score
    const avgScore = jobsWithScores.reduce((sum, j) => sum + j.score, 0) / jobsWithScores.length;

    // High-value job count (score >= 80)
    const highValueCount = jobsWithScores.filter(j => j.score >= 80).length;

    // Hybrid quality metric: 70% avg score + 30% high-value percentage
    const highValuePercentage = (highValueCount / jobsWithScores.length) * 100;
    const quality = (avgScore * 0.7) + (highValuePercentage * 0.3);

    return quality;
  };

  const adzunaQuality = calculateQuality(adzuna);
  const jsearchQuality = calculateQuality(jsearch);

  const totalQuality = adzunaQuality + jsearchQuality;

  // If total quality is 0 (no scores), fall back to default
  if (totalQuality === 0) {
    return defaultAllocation;
  }

  // Allocate remaining 50 jobs proportionally
  let adzunaAlloc = Math.round((adzunaQuality / totalQuality) * 50);
  let jsearchAlloc = 50 - adzunaAlloc;

  // Enforce minimum allocation of 10 per API (never starve)
  if (adzunaAlloc < 10) {
    adzunaAlloc = 10;
    jsearchAlloc = 40;
  } else if (jsearchAlloc < 10) {
    jsearchAlloc = 10;
    adzunaAlloc = 40;
  }

  console.log(`Adaptive allocation: Adzuna ${adzunaAlloc}, JSearch ${jsearchAlloc} (quality: ${adzunaQuality.toFixed(1)} vs ${jsearchQuality.toFixed(1)})`);

  return { adzuna: adzunaAlloc, jsearch: jsearchAlloc };
}

/**
 * Update adaptive metrics with latest fetch results
 * @param {Array} adzunaJobs - Adzuna jobs from bootstrap
 * @param {Array} jsearchJobs - JSearch jobs from bootstrap
 * @returns {Promise<void>}
 */
export async function updateAdaptiveMetrics(adzunaJobs, jsearchJobs) {
  const metrics = await storage.getAdaptiveMetrics();
  const today = new Date().toISOString().split('T')[0];

  // Calculate entry for Adzuna
  const calculateEntry = (jobs) => {
    const jobsWithScores = jobs.filter(j => j.score !== null && j.score !== undefined);

    const entry = {
      date: today,
      avgScore: null,
      highValueCount: 0,
      jobCount: jobs.length
    };

    if (jobsWithScores.length > 0) {
      entry.avgScore = jobsWithScores.reduce((sum, j) => sum + j.score, 0) / jobsWithScores.length;
      entry.highValueCount = jobsWithScores.filter(j => j.score >= 80).length;
    }

    return entry;
  };

  // Add entries to recent windows
  const adzunaEntry = calculateEntry(adzunaJobs);
  const jsearchEntry = calculateEntry(jsearchJobs);

  metrics.adzuna.recentWindow.push(adzunaEntry);
  metrics.jsearch.recentWindow.push(jsearchEntry);

  // Trim to last 7 entries (rolling 7-day window)
  metrics.adzuna.recentWindow = metrics.adzuna.recentWindow.slice(-7);
  metrics.jsearch.recentWindow = metrics.jsearch.recentWindow.slice(-7);

  // Update calibration timestamp
  metrics.lastCalibration = new Date().toISOString();

  // Save metrics
  await storage.setAdaptiveMetrics(metrics);

  console.log('Adaptive metrics updated');
}
