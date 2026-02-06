import { storage } from '../storage.js';
import { retryWithBackoff, createApiError, ApiError } from '../errors.js';

/**
 * Fetch jobs from JSearch API (RapidAPI)
 * @param {number} count - Number of jobs to fetch
 * @param {Object} searchParams - Search parameters (optional)
 * @returns {Promise<Array>} Array of normalized job objects
 */
export async function fetchJSearchJobs(count, searchParams = {}) {
  // Get API keys
  const apiKeys = await storage.getApiKeys();
  const apiKey = apiKeys.jsearch;

  // Validate API key
  if (!apiKey) {
    throw new ApiError('JSearch API key not configured', {
      service: 'jsearch',
      status: null,
      retryable: false
    });
  }

  // Get search settings
  const settings = await storage.getSettings();

  // Build query string with location
  let defaultQuery = 'software engineer';
  if (settings.searchKeywords.length > 0) {
    defaultQuery = settings.searchKeywords.join(' ');
    if (settings.location) {
      defaultQuery += ` in ${settings.location}`;
    }
  }

  // Destructure searchParams with settings fallbacks
  const query = searchParams.query || defaultQuery;
  const datePosted = searchParams.datePosted !== undefined
    ? searchParams.datePosted
    : settings.datePosted;
  const remoteOnly = searchParams.remoteOnly !== undefined
    ? searchParams.remoteOnly
    : settings.remoteOnly;
  const employmentType = searchParams.employmentType !== undefined
    ? searchParams.employmentType
    : settings.employmentType;

  const numPages = Math.ceil(count / 10); // JSearch returns ~10 per page

  // Build URL
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', query);
  url.searchParams.set('page', '1');
  url.searchParams.set('num_pages', numPages.toString());

  // Optional params
  if (datePosted && datePosted !== 'all') {
    url.searchParams.set('date_posted', datePosted);
  }
  if (remoteOnly) {
    url.searchParams.set('remote_jobs_only', 'true');
  }
  if (employmentType) {
    url.searchParams.set('employment_types', employmentType);
  }

  // Headers
  const headers = {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
  };

  // Fetch with retry
  const response = await retryWithBackoff(async () => {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw await createApiError(res, 'jsearch');
    }
    return res.json();
  });

  // Handle empty or missing data
  if (!response.data || response.data.length === 0) {
    console.log('JSearch: fetched 0 jobs');
    return [];
  }

  // Transform to normalized format
  const normalizedJobs = response.data.map(job => ({
    jobId: `jsearch-${job.job_id}`,
    source: 'jsearch',
    title: job.job_title,
    company: job.employer_name || 'Unknown',
    location: (job.job_city && job.job_state)
      ? `${job.job_city}, ${job.job_state}`
      : (job.job_country || ''),
    salary: {
      min: job.job_min_salary || null,
      max: job.job_max_salary || null,
      predicted: false
    },
    description: job.job_description || '',
    url: job.job_apply_link || job.job_google_link,
    postedAt: job.job_posted_at_datetime_utc,
    employmentType: job.job_employment_type || null,
    isRemote: job.job_is_remote || false,
    fetchedAt: new Date().toISOString(),
    status: 'new',
    score: null,
    scoreReasoning: null
  }));

  // Slice to exact count requested
  const results = normalizedJobs.slice(0, count);

  console.log(`JSearch: fetched ${results.length} jobs`);

  return results;
}
