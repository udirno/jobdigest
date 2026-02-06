import { storage } from './storage.js';
import { scoreJob } from './api/claude-client.js';

/**
 * Score all unscored jobs sequentially
 * @returns {Promise<Object>} Result with status, scored count, failed count
 */
export async function scoreUnscoredJobs() {
  // Load resume
  const resume = await storage.getResume();
  if (!resume || !resume.text) {
    return {
      status: 'no_resume',
      scored: 0,
      message: 'No resume uploaded. Upload a resume in Settings to enable scoring.'
    };
  }

  // Load API key
  const apiKeys = await storage.getApiKeys();
  if (!apiKeys.claude) {
    return {
      status: 'no_api_key',
      scored: 0,
      message: 'Claude API key not configured. Add it in Settings.'
    };
  }

  // Load all jobs and filter to unscored
  const allJobs = await storage.getJobs();
  const unscoredJobs = Object.entries(allJobs).filter(
    ([_, job]) => job.score === null || job.score === undefined
  );

  if (unscoredJobs.length === 0) {
    return {
      status: 'none_to_score',
      scored: 0,
      message: 'All jobs already scored.'
    };
  }

  let scored = 0;
  let failed = 0;

  // Score sequentially with delay for rate limit safety
  for (const [jobId, job] of unscoredJobs) {
    console.log(`Scoring job ${scored + 1}/${unscoredJobs.length}: ${job.title} at ${job.company}`);

    // Score the job
    const result = await scoreJob(job, resume.text, apiKeys.claude);

    // Update job with scoring result
    if (result.score !== null) {
      // Successful scoring
      job.score = result.score;
      job.scoreReasoning = result.reasoning;
      job.scoredAt = new Date().toISOString();
      job.scoreDetails = {
        skills_match: result.skills_match,
        experience_level: result.experience_level,
        tech_stack_alignment: result.tech_stack_alignment,
        title_relevance: result.title_relevance,
        industry_fit: result.industry_fit
      };
      scored++;
    } else {
      // Scoring failed - use sentinel value
      job.score = -1;
      job.scoreReasoning = result.reasoning || 'Scoring failed';
      job.scoredAt = new Date().toISOString();
      failed++;
    }

    // Save immediately for checkpoint resilience
    await storage.saveJob(jobId, job);

    // Delay between requests (500ms = 120 RPM, well under 50 RPM Tier 1 limit)
    if (scored + failed < unscoredJobs.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Scoring complete: ${scored} scored, ${failed} failed, ${unscoredJobs.length} total`);

  return {
    status: 'complete',
    scored,
    failed,
    total: unscoredJobs.length
  };
}

/**
 * Score or re-score a single job
 * @param {string} jobId - Job ID to score
 * @returns {Promise<Object>} Updated job object
 */
export async function scoreSingleJob(jobId) {
  // Load resume
  const resume = await storage.getResume();
  if (!resume || !resume.text) {
    throw new Error('No resume uploaded. Upload a resume in Settings to enable scoring.');
  }

  // Load API key
  const apiKeys = await storage.getApiKeys();
  if (!apiKeys.claude) {
    throw new Error('Claude API key not configured. Add it in Settings.');
  }

  // Load job
  const allJobs = await storage.getJobs();
  const job = allJobs[jobId];

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Score the job
  const result = await scoreJob(job, resume.text, apiKeys.claude);

  // Update job with scoring result
  if (result.score !== null) {
    job.score = result.score;
    job.scoreReasoning = result.reasoning;
    job.scoredAt = new Date().toISOString();
    job.scoreDetails = {
      skills_match: result.skills_match,
      experience_level: result.experience_level,
      tech_stack_alignment: result.tech_stack_alignment,
      title_relevance: result.title_relevance,
      industry_fit: result.industry_fit
    };
  } else {
    job.score = -1;
    job.scoreReasoning = result.reasoning || 'Scoring failed';
    job.scoredAt = new Date().toISOString();
  }

  // Save updated job
  await storage.saveJob(jobId, job);

  return job;
}
