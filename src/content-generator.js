import { retryWithBackoff, createApiError } from './errors.js';
import { storage } from './storage.js';

/**
 * Generate personalized content (cover letter or recruiter message) using Claude API
 * @param {string} contentType - 'coverLetter' or 'recruiterMessage'
 * @param {Object} job - Job object from storage
 * @param {string} apiKey - Claude API key
 * @param {string} customInstructions - Optional user-provided generation guidance
 * @returns {Promise<Object>} { content: string, usage: object }
 */
export async function generateContent(contentType, job, apiKey, customInstructions = '') {
  // Load resume from storage
  const resume = await storage.getResume();
  if (!resume) {
    throw new Error('No resume uploaded. Please upload your resume in Settings first.');
  }

  // Build system prompt with anti-cliche constraints
  const systemPrompt = buildSystemPrompt(contentType);

  // Build user prompt with job details
  const userPrompt = buildUserPrompt(contentType, job, customInstructions);

  // Configure request body
  const requestBody = {
    model: 'claude-haiku-4-5',
    max_tokens: contentType === 'coverLetter' ? 800 : 200,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `Candidate Resume:\n\n${resume.text}`,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  // Make API call with retry logic
  const result = await retryWithBackoff(async () => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw await createApiError(response, 'claude');
    }

    return response.json();
  });

  // Extract generated content
  const content = result.content[0].text;

  // Log usage stats for monitoring
  console.log('Content generation usage:', {
    input_tokens: result.usage.input_tokens,
    cache_creation_input_tokens: result.usage.cache_creation_input_tokens || 0,
    cache_read_input_tokens: result.usage.cache_read_input_tokens || 0,
    output_tokens: result.usage.output_tokens
  });

  // Save generated content to job record with metadata
  const generated = {
    ...(job.generated || {}),
    [contentType]: {
      content,
      generatedAt: new Date().toISOString(),
      editedAt: null,
      isEdited: false
    }
  };

  await storage.updateJob(job.jobId, { generated });

  return { content, usage: result.usage };
}

/**
 * Build system prompt with tone and structure guidance
 * @param {string} contentType - 'coverLetter' or 'recruiterMessage'
 * @returns {string} System prompt text
 */
function buildSystemPrompt(contentType) {
  const isCoverLetter = contentType === 'coverLetter';

  return `You are an expert career advisor. Write a ${isCoverLetter ? 'cover letter (3-4 paragraphs)' : 'short recruiter message (under 100 words)'} that sounds like a real person wrote it.

TONE: Professional but conversational. Approachable and natural, not stiff or robotic. Write like you're emailing a colleague, not writing a formal letter.

${isCoverLetter
  ? `STRUCTURE:
- Opening: Connect your experience to their specific needs (1-2 sentences)
- Body: 2-3 concrete examples of relevant work with numbers when possible (2 paragraphs)
- Close: Clear next step, keep it casual (1-2 sentences)
- Total: 3-4 paragraphs`
  : `STRUCTURE:
- Hook: Why you are reaching out about this specific role (1 sentence)
- Relevance: 1-2 specific points connecting your background to the role
- Ask: Simple, low-pressure call to action
- Total: Under 100 words`}

CRITICAL RULES:
1. Reference specific skills and experiences from the resume that match the job
2. Use concrete examples with numbers and specifics when possible
3. Keep sentences varied in length (mix short and long)
4. Start with a relevant insight or connection, NOT a generic opener

NEVER use these phrases (they sound robotic and AI-generated):
- "I am writing to express my interest"
- "I am excited to apply"
- "Leverage my skills"
- "Proven track record"
- "Results-driven"
- "Think outside the box"
- "Hit the ground running"
- "I would love the opportunity"
- "I am confident that"
- "Passionate about"
- "Dynamic team"
- "Fast-paced environment"
- "Strong communication skills"

Write ONLY the ${isCoverLetter ? 'cover letter' : 'message'} text. No subject line, no greeting like "Dear Hiring Manager" for recruiter messages. For cover letters, include a natural greeting and sign-off.`;
}

/**
 * Build user prompt with job details and custom instructions
 * @param {string} contentType - 'coverLetter' or 'recruiterMessage'
 * @param {Object} job - Job object
 * @param {string} customInstructions - Optional user instructions
 * @returns {string} User prompt text
 */
function buildUserPrompt(contentType, job, customInstructions) {
  const isCoverLetter = contentType === 'coverLetter';
  const jobRequirements = extractKeyRequirements(job.description);

  let prompt = `Write a ${isCoverLetter ? 'cover letter' : 'recruiter message'} for this position:

Job Title: ${job.title}
Company: ${job.company}`;

  if (job.location) {
    prompt += `\nLocation: ${job.location}`;
  }

  prompt += `\n\nJob Description:\n${jobRequirements}`;

  if (customInstructions) {
    prompt += `\n\nAdditional instructions: ${customInstructions}`;
  }

  return prompt;
}

/**
 * Extract key requirements from job description to reduce token costs
 * @param {string} description - Full job description
 * @returns {string} Key requirements (capped at 1000 chars)
 */
function extractKeyRequirements(description) {
  if (!description) {
    return 'No job description provided.';
  }

  // Patterns to find requirements/qualifications/responsibilities sections
  const sectionPatterns = [
    /(?:^|\n)(requirements?|qualifications?|required skills?|must have|you must|you should|you have)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(responsibilities|duties|what you(?:'ll| will) do|role responsibilities|your role)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(skills?|technical skills?|technologies?|tech stack|tools?)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis,
    /(?:^|\n)(experience|years of experience|background)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/gis
  ];

  let extractedSections = [];
  let hasStructuredSections = false;

  // Try to extract structured sections
  for (const pattern of sectionPatterns) {
    const matches = [...description.matchAll(pattern)];
    for (const match of matches) {
      if (match[0].trim().length > 20) {
        extractedSections.push(match[0].trim());
        hasStructuredSections = true;
      }
    }
  }

  if (hasStructuredSections) {
    // Found structured sections - join and cap at 1000 chars
    const combined = extractedSections.join('\n\n');
    return combined.substring(0, 1000);
  }

  // No clear sections found - take first 1000 chars
  return description.trim().substring(0, 1000);
}
