import { retryWithBackoff, createApiError } from '../errors.js';

/**
 * Extract core job sections, stripping benefits/perks/culture fluff
 * @param {Object} job - Job object
 * @returns {string} Core job content for scoring
 */
export function extractJobCore(job) {
  const description = job.description || '';

  // Core metadata (always include)
  let core = `Job Title: ${job.title}\nCompany: ${job.company}`;

  if (job.location) {
    core += `\nLocation: ${job.location}`;
  }

  if (job.salary && (job.salary.min || job.salary.max)) {
    const salaryParts = [];
    if (job.salary.min) salaryParts.push(`$${job.salary.min.toLocaleString()}`);
    if (job.salary.max) salaryParts.push(`$${job.salary.max.toLocaleString()}`);
    core += `\nSalary: ${salaryParts.join(' - ')}`;
  }

  core += '\n\nJob Description:\n';

  // Section patterns to keep (requirements, skills, responsibilities)
  const keepPatterns = [
    /(?:^|\n)(requirements?|qualifications?|required skills?|must have|you must|you should|you have)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(responsibilities|duties|what you(?:'ll| will) do|role responsibilities|your role)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(skills?|technical skills?|technologies?|tech stack|tools?)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(experience|years of experience|background)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(about (?:the|this) (?:role|position|job))[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis
  ];

  // Section patterns to strip (benefits, perks, culture fluff)
  const stripPatterns = [
    /(?:^|\n)(benefits?|perks?|what we offer|compensation|we offer)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(why (?:join|work at)|about (?:us|our company|the company))[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(company culture|our culture|our values|diversity)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(equal opportunity|eeo statement)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis
  ];

  let extractedSections = [];
  let hasStructuredSections = false;

  // Try to extract keep sections
  for (const pattern of keepPatterns) {
    const matches = [...description.matchAll(pattern)];
    for (const match of matches) {
      if (match[0].trim().length > 20) { // Ignore tiny matches
        extractedSections.push(match[0].trim());
        hasStructuredSections = true;
      }
    }
  }

  if (hasStructuredSections) {
    // Found structured sections - use them
    core += extractedSections.join('\n\n');
  } else {
    // No clear sections found - strip unwanted sections and truncate
    let cleanedDesc = description;

    for (const pattern of stripPatterns) {
      cleanedDesc = cleanedDesc.replace(pattern, '');
    }

    // Truncate to first 2000 chars (requirements typically appear first)
    core += cleanedDesc.trim().substring(0, 2000);
  }

  return core;
}

/**
 * Score a job against a resume using Claude API
 * @param {Object} job - Job object to score
 * @param {string} resume - Resume text content
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} Scoring result with score, reasoning, and dimension scores
 */
export async function scoreJob(job, resume, apiKey) {
  // Extract core job content (strip fluff per user decision)
  const jobCore = extractJobCore(job);

  // Build request body
  const requestBody = {
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            score: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Overall match score 0-100'
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of score focusing on key factors'
            },
            skills_match: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Technical skills alignment score'
            },
            experience_level: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Years of experience match'
            },
            tech_stack_alignment: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Technology/framework match'
            },
            title_relevance: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Job title relevance to career path'
            },
            industry_fit: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Industry and domain alignment'
            }
          },
          required: ['score', 'reasoning', 'skills_match', 'experience_level',
                    'tech_stack_alignment', 'title_relevance', 'industry_fit'],
          additionalProperties: false
        }
      }
    },
    system: [
      {
        type: 'text',
        text: `You are an expert technical recruiter evaluating job-candidate fit.

Score jobs 0-100 based on this weighting:
- Skills & Tech Stack: 60% (primary factor - technical skills and technologies)
- Experience Level: 15%
- Job Title Relevance: 10%
- Industry Fit: 10%
- Other Factors: 5%

Scoring guidelines:
- 90-100: Excellent match, highly qualified
- 70-89: Strong match, well qualified
- 50-69: Moderate match, some gaps
- 30-49: Weak match, significant gaps
- 0-29: Poor match, misaligned

Keep reasoning concise (2-3 sentences) focusing on strengths and gaps.`,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `Candidate Resume:\n\n${resume}`,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Evaluate this job opportunity:\n\n${jobCore}`
      }
    ]
  };

  // Make API call with retry logic
  try {
    const result = await retryWithBackoff(async () => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Handle errors
      if (!response.ok) {
        throw await createApiError(response, 'claude');
      }

      return response.json();
    });

    // Parse structured output
    const scoringResult = JSON.parse(result.content[0].text);

    // Log usage for monitoring cache hit rates
    console.log('Claude scoring usage:', {
      input_tokens: result.usage.input_tokens,
      cache_creation_input_tokens: result.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: result.usage.cache_read_input_tokens || 0,
      output_tokens: result.usage.output_tokens
    });

    return scoringResult;

  } catch (error) {
    console.error('Scoring failed:', error);

    // Return null score marker on failure (don't throw)
    return {
      score: null,
      reasoning: 'Scoring failed after retries',
      error: error.message
    };
  }
}
