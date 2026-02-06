import { storage } from '../storage.js';
import { retryWithBackoff, createApiError, ApiError } from '../errors.js';

/**
 * Fetch jobs from Adzuna API
 * @param {number} count - Number of jobs to fetch
 * @param {Object} searchParams - Search parameters (optional)
 * @returns {Promise<Array>} Array of normalized job objects
 */
export async function fetchAdzunaJobs(count, searchParams = {}) {
  // Get API keys
  const apiKeys = await storage.getApiKeys();
  const { appId, appKey } = apiKeys.adzuna || {};

  // Validate API keys
  if (!appId || !appKey) {
    throw new ApiError('Adzuna API keys not configured', {
      service: 'adzuna',
      status: null,
      retryable: false
    });
  }

  // Get search settings
  const settings = await storage.getSettings();

  // Destructure searchParams with settings fallbacks
  const query = searchParams.query || (settings.searchKeywords.length > 0
    ? settings.searchKeywords.join(' ')
    : 'software engineer');
  const location = searchParams.location !== undefined
    ? searchParams.location
    : settings.location;
  const salaryMin = searchParams.salaryMin !== undefined
    ? searchParams.salaryMin
    : settings.salaryMin;

  const resultsPerPage = Math.min(count, 50); // Adzuna max per page is 50
  const numPages = Math.ceil(count / 50);

  const allResults = [];

  // Fetch pages
  for (let page = 1; page <= numPages; page++) {
    const url = new URL('https://api.adzuna.com/v1/api/jobs/us/search/' + page);

    // Set required query params
    url.searchParams.set('app_id', appId);
    url.searchParams.set('app_key', appKey);
    url.searchParams.set('results_per_page', resultsPerPage);
    url.searchParams.set('what', query);
    url.searchParams.set('content-type', 'application/json');
    url.searchParams.set('sort_by', 'date');

    // Optional params
    if (location) {
      url.searchParams.set('where', location);
    }
    if (salaryMin !== null && salaryMin !== undefined) {
      url.searchParams.set('salary_min', salaryMin);
    }

    // Fetch with retry
    const response = await retryWithBackoff(async () => {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw await createApiError(res, 'adzuna');
      }
      return res.json();
    });

    // Handle empty or missing results
    if (!response.results || response.results.length === 0) {
      break;
    }

    // Transform to normalized format
    const normalizedJobs = response.results.map(job => ({
      jobId: `adzuna-${job.id}`,
      source: 'adzuna',
      title: job.title,
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || '',
      salary: {
        min: job.salary_min || null,
        max: job.salary_max || null,
        predicted: job.salary_is_predicted || false
      },
      description: job.description || '',
      url: job.redirect_url,
      postedAt: job.created,
      contractType: job.contract_type || null,
      fetchedAt: new Date().toISOString(),
      status: 'new',
      score: null,
      scoreReasoning: null
    }));

    allResults.push(...normalizedJobs);

    // Stop if we have enough results
    if (allResults.length >= count) {
      break;
    }
  }

  // Slice to exact count requested
  const results = allResults.slice(0, count);

  console.log(`Adzuna: fetched ${results.length} jobs`);

  return results;
}
