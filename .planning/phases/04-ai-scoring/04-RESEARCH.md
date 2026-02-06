# Phase 4: AI Scoring - Research

**Researched:** 2026-02-05
**Domain:** Claude API integration for job-resume matching and scoring
**Confidence:** HIGH

## Summary

Phase 4 implements AI-powered job scoring by integrating Claude API to evaluate each fetched job against the user's resume, producing 0-100 match scores with detailed reasoning. The standard approach uses Claude's Messages API with structured outputs (JSON schema) to guarantee consistent scoring format, prompt caching to reduce costs for repeated resume content, and error handling with exponential backoff for rate limits.

Research focused on Claude 4.5 model family capabilities, prompt engineering best practices for scoring tasks, cost optimization strategies (prompt caching, batch processing, model selection), structured outputs for reliable JSON responses, and Chrome extension service worker integration patterns. User has locked in key decisions: skills-heavy scoring emphasis, core job description sections only (no fluff), and balanced cost-quality approach.

**Primary recommendation:** Use Claude Haiku 4.5 for scoring with structured outputs, implement prompt caching for resume content, score immediately after each fetch (not batched), and use exponential backoff with retry-after headers for rate limit handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scoring Prompt Design
- **Job description scope**: Send core sections only (job title, requirements, key responsibilities). Skip benefits, perks, and company culture fluff to reduce token usage.
- **Skills-heavy weighting**: Emphasize technical skills and tech stack match most heavily in the scoring. Skills alignment is the primary factor.
- **Prompt structure**: Claude's discretion (single-shot vs structured output)
- **Reasoning detail**: Claude's discretion (balance informativeness with readability)

#### Score Computation Strategy
- **Timing**: Claude's discretion (immediately after fetch vs batch at end)
- **Failure handling**: Claude's discretion (retry with backoff, mark unscored, or fail entire fetch)
- **Parallelization**: Claude's discretion (sequential vs parallel batches)
- **Adaptive distribution integration**: Claude's discretion (activate adaptive allocation using scores now, or defer to future)

#### Cost vs Quality Balance
- **Model selection**: Claude's discretion (Haiku/Sonnet/Opus trade-off)
- **Token limits**: Claude's discretion (set reasonable budgets based on typical job descriptions)
- **Priority**: Balanced approach - good enough scoring without excessive API spend
- **Cost warnings**: Claude's discretion (show cost estimates or let users manage via Anthropic dashboard)

#### Score Visibility and Updates
- **Display timing**: Claude's discretion (progressive updates vs wait for batch)
- **Re-scoring capability**: Claude's discretion (manual trigger, automatic on resume change, or no re-scoring)
- **Unscored job handling**: Claude's discretion (show with label, hide, or bottom-rank)
- **Reasoning presentation**: Claude's discretion (visible by default or expand on click)

### Claude's Discretion

All implementation details are at Claude's discretion to optimize for the user's priority: good quality scoring without excessive API costs.

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

## Standard Stack

The established tools for Claude API integration in Chrome extensions:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Messages API | 2023-06-01 | Direct HTTP API for Claude inference | Official Anthropic API, no SDK needed for extensions |
| Structured Outputs | GA (2026) | JSON schema validation for responses | Guarantees valid scoring output, eliminates parsing errors |
| Prompt Caching | GA (2026) | Cache resume content across scoring requests | 90% cost reduction on cached tokens (10% of base price) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Batch API | GA (2026) | Process 100K requests at 50% discount | Large-scale rescoring, non-urgent bulk operations |
| Exponential Backoff | Standard pattern | Handle rate limits and transient errors | All API calls - required for 429 responses |
| Rate Limit Headers | API response | Track remaining quota and reset times | Monitor usage, prevent hitting limits |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Haiku 4.5 | Sonnet 4.5 | 3x cost ($3 vs $1 input) but better reasoning - overkill for straightforward scoring |
| Haiku 4.5 | Opus 4.6 | 5x cost ($5 vs $1 input) with top-tier reasoning - unnecessary for job matching |
| Direct API | Official SDK | SDK requires bundling, increases extension size - API is simpler for extensions |
| Structured Outputs | Prompt-only JSON | No schema guarantees, requires retry logic - structured outputs eliminate this |

**Installation:**
```bash
# No packages needed - direct fetch() to Claude API
# API key stored via chrome.storage.local (already implemented in Phase 1)
```

## Architecture Patterns

### Recommended Integration Structure
```
src/
├── api/
│   ├── claude-client.js       # Claude API wrapper with retry logic
│   └── adzuna-client.js        # [existing]
├── job-scorer.js              # Scoring orchestration
├── background.js              # [existing] - imports job-scorer
└── storage.js                 # [existing] - stores scores
```

### Pattern 1: Structured Output Scoring
**What:** Use Claude's structured outputs feature to guarantee valid JSON scoring responses with schema enforcement at the API level.

**When to use:** All scoring requests - eliminates JSON parsing errors and ensures consistent output format.

**Example:**
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
async function scoreJob(jobDescription, resume) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              reasoning: { type: 'string' },
              skills_match: { type: 'integer', minimum: 0, maximum: 100 },
              experience_match: { type: 'integer', minimum: 0, maximum: 100 },
              tech_stack_match: { type: 'integer', minimum: 0, maximum: 100 }
            },
            required: ['score', 'reasoning', 'skills_match', 'experience_match', 'tech_stack_match'],
            additionalProperties: false
          }
        }
      },
      system: [
        {
          type: 'text',
          text: 'You are an expert job matching system. Score jobs 0-100 based on resume fit.',
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: `Resume:\n${resume}`,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Score this job:\n\n${jobDescription}`
        }
      ]
    })
  });

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}
```

### Pattern 2: Prompt Caching for Cost Efficiency
**What:** Mark resume content with cache_control to cache it across all scoring requests, reducing input token costs by 90%.

**When to use:** Every scoring request - resume is static and large, perfect for caching.

**Example:**
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
// Cache the resume in system prompt
system: [
  {
    type: 'text',
    text: 'Scoring instructions...',
    cache_control: { type: 'ephemeral' } // Caches entire prefix
  },
  {
    type: 'text',
    text: `Resume:\n${resume}`,
    cache_control: { type: 'ephemeral' } // Cache lasts 5 minutes
  }
]

// First request: cache_creation_input_tokens charged at 1.25x
// Subsequent requests (within 5 min): cache_read_input_tokens at 0.1x
// 90% savings on resume tokens after first request
```

### Pattern 3: Exponential Backoff with Retry-After
**What:** Handle rate limits by respecting retry-after header and using exponential backoff as fallback.

**When to use:** All Claude API calls - rate limits are inevitable at scale.

**Example:**
```javascript
// Source: https://platform.claude.com/docs/en/api/rate-limits
async function retryWithBackoff(apiCall, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await apiCall();

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000; // Exponential backoff fallback

        console.log(`Rate limited, waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

### Pattern 4: Score Immediately After Fetch
**What:** Score each job right after fetching it, rather than batching all jobs then scoring.

**When to use:** Recommended default - provides progressive feedback and resilience to failures.

**Example:**
```javascript
// In job-fetcher.js pipeline
async function fetchAndScoreJobs(sources) {
  const scoredJobs = [];

  for (const source of sources) {
    const jobs = await fetchFromSource(source);

    for (const job of jobs) {
      // Score immediately after fetch
      const score = await scoreJob(job, resume);
      job.score = score.score;
      job.scoreReasoning = score.reasoning;

      // Save immediately for checkpoint recovery
      await storage.saveJob(job);
      scoredJobs.push(job);
    }
  }

  return scoredJobs;
}
```

### Anti-Patterns to Avoid
- **Batch-then-score**: Fetching all jobs then scoring creates two failure domains. Score immediately for resilience.
- **No caching**: Without prompt caching, resume is reprocessed for every job at full cost (10x more expensive).
- **Ignoring retry-after**: Using only exponential backoff misses the API's explicit guidance on when to retry.
- **Prompt-only JSON**: Asking Claude to "return JSON" without structured outputs leads to parsing errors (quotes, commas, etc).
- **Inline system prompt**: Not using cache_control on system prompt wastes caching opportunity.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Manual JSON.parse + validation | Structured Outputs (output_config) | Claude guarantees valid JSON matching schema at inference time, eliminates parsing errors |
| Rate limit handling | Simple setTimeout retry | Exponential backoff + retry-after headers | Claude provides exact retry timing in headers, exponential backoff alone is suboptimal |
| Token counting | Character estimation (x4) | Token Counting API (/v1/messages/count_tokens) | Accurate pre-flight token counts prevent over-budget requests |
| Prompt caching | Manual deduplication | Prompt Caching (cache_control) | Built-in caching with 5min TTL, 90% cost reduction, automatic invalidation |
| Batch processing | Custom queue + worker | Batch API (/v1/messages/batches) | 50% cost discount, handles 100K requests, automatic retry logic |

**Key insight:** Claude's API has evolved to solve common integration problems. Using built-in features (structured outputs, caching, batch API) eliminates entire categories of bugs while reducing costs. Don't rebuild what Claude provides.

## Common Pitfalls

### Pitfall 1: Prompt Caching Miss Due to Cache Invalidation
**What goes wrong:** Cache doesn't hit even though resume hasn't changed, wasting 90% of potential savings.

**Why it happens:** Cache is invalidated by changes earlier in the prompt hierarchy (tools → system → messages). Even small differences break the cache.

**How to avoid:**
- Place static content first, variable content last
- Use identical cache_control placement across requests
- Don't change system prompt text between requests
- Stable key ordering in JSON objects (some languages randomize)

**Warning signs:**
- `cache_creation_input_tokens` non-zero on every request
- `cache_read_input_tokens` always 0
- Costs don't drop after first request

### Pitfall 2: Service Worker Lifecycle Breaking Long-Running Scoring
**What goes wrong:** Scoring operation interrupted mid-process because Chrome extension service worker goes idle and terminates.

**Why it happens:** Manifest V3 service workers terminate after 30 seconds of inactivity. API calls to Claude can take 5-20 seconds each.

**How to avoid:**
- Keep service worker alive during scoring with chrome.alarms or message passing
- Use existing keep-alive mechanism from Phase 1 (dual alarms + setTimeout)
- Save progress after each job scored (checkpoint pattern)
- Design for interruption - store partial results

**Warning signs:**
- Scoring stops after first few jobs
- "Service worker inactive" errors in logs
- Jobs without scores after fetch completes

### Pitfall 3: Haiku Minimum Token Requirement for Caching
**What goes wrong:** Attempting to cache content that's too short results in cache_creation_input_tokens = 0, no caching benefit.

**Why it happens:** Haiku 4.5 requires minimum 4096 tokens to cache. Short resumes (< 3000 words) won't be cached.

**How to avoid:**
- Check resume token count before enabling caching (use Token Counting API)
- For short resumes (< 4096 tokens), skip caching - cost difference minimal
- Consider padding system prompt to reach minimum if close

**Warning signs:**
- cache_creation_input_tokens = 0 despite cache_control
- No error message, just silent non-caching
- Costs remain flat across all requests

### Pitfall 4: Rate Limit Tier Assumptions
**What goes wrong:** Planning for Tier 4 limits (4000 RPM) but account is actually Tier 1 (50 RPM), causing constant rate limiting.

**Why it happens:** Usage tiers require cumulative credit purchases to unlock. New accounts start at Tier 1 regardless of credit added.

**How to avoid:**
- Check current tier in Console (/settings/limits)
- Tier 1: $5 deposit → 50 RPM, 50K ITPM (Haiku)
- Tier 2: $40 cumulative → 1000 RPM, 450K ITPM
- Design scoring to handle Tier 1 limits gracefully (1 request/second)
- Show user-friendly progress instead of rate limit errors

**Warning signs:**
- 429 errors on every request despite respecting retry-after
- Headers show very low remaining quota
- Scoring takes hours for 100 jobs

### Pitfall 5: Structured Output Incompatibility with Message Prefilling
**What goes wrong:** Using output_config (structured outputs) with assistant message prefilling returns 400 error.

**Why it happens:** Structured outputs and prefilled responses are incompatible as of Claude Opus 4.6. Cannot use both features simultaneously.

**How to avoid:**
- Don't use assistant message prefilling when using output_config
- Use structured outputs alone - it's more reliable than prefilling for JSON
- If prefilling needed, use prompt-only approach (no output_config)

**Warning signs:**
- 400 "incompatible features" error
- Documentation warns about prefill deprecation
- Assistant messages in request body

## Code Examples

Verified patterns from official sources:

### Complete Scoring Function with All Best Practices
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// Combines: structured outputs, prompt caching, retry logic, error handling

async function scoreJobWithResume(job, resume, apiKey) {
  const maxRetries = 3;

  // Extract core job sections (user decision: skip fluff)
  const jobCore = `
Title: ${job.title}
Company: ${job.company}
Requirements: ${job.description.match(/requirements:[\s\S]*?(?=\n\n|benefits:|$)/i)?.[0] || job.description}
Responsibilities: ${job.description.match(/responsibilities:[\s\S]*?(?=\n\n|benefits:|$)/i)?.[0] || ''}
Tech Stack: ${job.description.match(/technologies?:[\s\S]*?(?=\n\n|$)/i)?.[0] || ''}
  `.trim();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 512, // Reasoning + scores fit in 512
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
              cache_control: { type: 'ephemeral' } // Cache resume for 5 minutes
            }
          ],
          messages: [
            {
              role: 'user',
              content: `Evaluate this job opportunity:\n\n${jobCore}`
            }
          ]
        })
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000;

        console.log(`Rate limited (attempt ${attempt + 1}), waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.content[0].text);

      // Log usage for monitoring
      console.log('Scoring usage:', {
        input_tokens: data.usage.input_tokens,
        cache_creation: data.usage.cache_creation_input_tokens,
        cache_read: data.usage.cache_read_input_tokens,
        output_tokens: data.usage.output_tokens
      });

      return result;

    } catch (error) {
      console.error(`Scoring attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        // Final attempt failed - return unscored marker
        return {
          score: null,
          reasoning: 'Scoring failed after retries',
          error: error.message
        };
      }

      // Exponential backoff for non-429 errors
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### Token Counting Before Caching
```javascript
// Source: https://platform.claude.com/docs/en/api/messages-count-tokens
// Check if resume is long enough to benefit from caching

async function checkCachingViability(resume, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      system: `You are an expert technical recruiter.\n\nResume:\n${resume}`,
      messages: [{ role: 'user', content: 'Score this job: ...' }]
    })
  });

  const { input_tokens } = await response.json();
  const HAIKU_MIN_CACHE_TOKENS = 4096;

  return {
    tokenCount: input_tokens,
    shouldCache: input_tokens >= HAIKU_MIN_CACHE_TOKENS,
    savingsEstimate: input_tokens >= HAIKU_MIN_CACHE_TOKENS
      ? (input_tokens * 0.9 * 99) // 90% savings on 99 jobs after first
      : 0
  };
}
```

### Batch Rescoring (Future Enhancement)
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/batch-processing
// For rescoring all jobs when resume changes (not Phase 4, but shows path)

async function batchRescoreJobs(jobs, resume, apiKey) {
  const batchRequests = jobs.map(job => ({
    custom_id: job.jobId,
    params: {
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      output_config: { /* same as above */ },
      system: [ /* same as above */ ],
      messages: [{
        role: 'user',
        content: `Evaluate this job:\n\n${extractJobCore(job)}`
      }]
    }
  }));

  // Create batch (50% cost discount)
  const batchResponse = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ requests: batchRequests })
  });

  const batch = await batchResponse.json();

  // Poll for completion (most finish in < 1 hour)
  let batchStatus;
  do {
    await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
    const statusResponse = await fetch(
      `https://api.anthropic.com/v1/messages/batches/${batch.id}`,
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } }
    );
    batchStatus = await statusResponse.json();
  } while (batchStatus.processing_status !== 'ended');

  // Retrieve results
  const resultsResponse = await fetch(batchStatus.results_url, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  });

  const results = await resultsResponse.text();
  return results.split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt-only JSON requests | Structured Outputs (output_config) | GA Nov 2025 | Eliminates JSON parsing errors, guaranteed schema compliance |
| Manual caching/dedup | Prompt Caching with cache_control | GA Aug 2024 | 90% cost reduction on repeated content, automatic invalidation |
| Fixed backoff only | Retry-after header + backoff | Always available | Respects API guidance, faster recovery from rate limits |
| Prefilled responses | Structured Outputs | Deprecated Feb 2026 | Prefilling incompatible with output_config, use structured outputs |
| 3.x models (Opus 3, Haiku 3) | 4.5 models (Haiku 4.5, Sonnet 4.5) | Released 2025 | Better instruction following, lower cost (Haiku: $0.25→$1 MTok) |

**Deprecated/outdated:**
- **Prompt-only JSON**: Use structured outputs instead - guarantees valid JSON at inference time
- **Prefilled assistant messages**: Incompatible with structured outputs as of Opus 4.6, less reliable than schema validation
- **Beta headers for structured outputs**: Now GA, no beta headers needed
- **Claude 3.x models**: Use 4.5 family for better performance and cost (Haiku 4.5 is 4x price of Haiku 3 but much better quality)

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal cache TTL for extension use case**
   - What we know: 5-minute default TTL, 1-hour available at 2x cache write cost
   - What's unclear: Whether 100 jobs scored in <5 minutes or users pause between fetches
   - Recommendation: Start with 5-minute TTL (default), monitor cache hit rates. If hit rate <50%, consider 1-hour TTL.

2. **Service worker keep-alive duration needed**
   - What we know: Scoring 100 jobs takes ~100-300 seconds at 1-3 sec/job
   - What's unclear: Existing keep-alive (20s setTimeout + 25s alarms) sufficient or needs adjustment
   - Recommendation: Test with production load. If timeouts occur, extend keep-alive to 10 minutes during scoring.

3. **Progressive vs batch scoring UX**
   - What we know: User wants to see results, immediate scoring provides progressive feedback
   - What's unclear: Whether showing jobs as they're scored is better than waiting for all to complete
   - Recommendation: Implement progressive display - show each job as scored. User can see results immediately instead of waiting minutes.

## Sources

### Primary (HIGH confidence)
- Claude API Getting Started - https://platform.claude.com/docs/en/api/getting-started
- Messages API Reference - https://platform.claude.com/docs/en/api/messages
- Structured Outputs Documentation - https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Prompt Caching Documentation - https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Prompt Engineering Best Practices - https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- Rate Limits Documentation - https://platform.claude.com/docs/en/api/rate-limits
- Batch Processing Documentation - https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Pricing Page - https://platform.claude.com/docs/en/about-claude/pricing
- Models Overview - https://platform.claude.com/docs/en/about-claude/models/overview

### Secondary (MEDIUM confidence)
- [Claude API Pricing 2026](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration) - Cost breakdown verified against official docs
- [Claude API Rate Limits Guide](https://www.aifreeapi.com/en/posts/fix-claude-api-429-rate-limit-error) - Rate limit handling patterns
- [Claude Prompt Engineering Guide 2026](https://promptbuilder.cc/blog/claude-prompt-engineering-best-practices-2026) - Scoring task best practices
- [Building Chrome Extension with Claude](https://claude-ai.chat/guides/building-chrome-extension/) - Extension integration patterns

### Tertiary (LOW confidence)
- [Chrome Extension Service Worker Patterns](https://www.mellowtel.com/blog/create-service-worker-chrome-extension) - General service worker guidance (not Claude-specific)
- [Resume Job Matching with Claude](https://www.firecrawl.dev/blog/ai-resume-parser-job-matcher-python) - Python example, not JavaScript

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Anthropic documentation, API specifications verified
- Architecture: HIGH - Official docs + existing codebase patterns from Phase 1-3
- Pitfalls: HIGH - Based on official documentation warnings and common integration issues
- Cost optimization: HIGH - Pricing page, prompt caching docs, verified calculations
- Service worker integration: MEDIUM - Chrome extension patterns + Claude API (no official integration guide)
- Rate limit handling: HIGH - Official rate limit docs, retry-after header specification

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - API stable, pricing may change quarterly)

**Key findings summary:**
1. **Model choice**: Haiku 4.5 ($1 input / $5 output per MTok) is optimal for scoring - 5x cheaper than Opus, sufficient intelligence for job matching
2. **Cost optimization**: Prompt caching reduces resume processing to 10% cost after first request (90% savings)
3. **Schema guarantee**: Structured outputs eliminate JSON parsing errors - use output_config with json_schema type
4. **Rate limits**: Tier 1 starts at 50 RPM (1 req/sec), requires $5 deposit. Plan for sequential scoring at this tier.
5. **Timing strategy**: Score immediately after fetch (not batched) for progressive feedback and failure resilience
6. **Chrome integration**: Use existing keep-alive mechanism from Phase 1, save after each job scored for checkpoint recovery
7. **Batch API**: Available for future rescoring at 50% discount, most batches complete <1 hour
