# Phase 7: AI Content Generation - Research

**Researched:** 2026-02-06
**Domain:** Claude API text generation, prompt engineering for natural writing, Chrome extension content editing
**Confidence:** HIGH

## Summary

Phase 7 generates personalized cover letters and recruiter messages using Claude API. The extension already has Claude API integration from Phase 4 (job scoring), so the core infrastructure exists. Research focused on: (1) prompt engineering techniques for natural, human-like writing that avoids AI cliches, (2) Chrome Clipboard API for copy-to-clipboard functionality, (3) textarea auto-resize and debounced auto-save patterns, and (4) storage strategies for generated content.

Key findings: Use Haiku 4.5 for cost-effectiveness (5x cheaper than Sonnet at $1/$5 per MTok), leverage existing prompt caching infrastructure, employ multishot prompting with negative examples to avoid AI tells, and implement debounced auto-save (1-second delay with flush-on-close) for edited content.

**Primary recommendation:** Reuse Phase 4's Claude API client patterns (prompt caching, structured outputs, error handling) and focus prompt engineering on role-based system prompts with explicit negative constraints to eliminate AI-sounding language.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Generation triggers & workflow:**
- Buttons in job detail modal trigger generation (not separate tab or context menu)
- Regeneration allowed: Show 'Regenerate' button after initial generation to create new versions
- Content quality: Prompt engineering focused on natural, human-like writing that doesn't sound AI-generated
- Avoid AI tells: No cliches, buzzwords, generic phrases like "I am writing to express" or "leverage my skills"

**Content display & editing:**
- Editing: Yes, inline editing via textarea — users can modify content before copying, changes are saved

**Tone & customization:**
- Cover letter tone: Professional but conversational (balance formality with approachability, natural language)
- Recruiter message tone: Same tone as cover letter for consistency
- Custom instructions: Yes, provide text field for custom instructions (e.g., "emphasize leadership", "mention relocation")
- Instructions location: Claude has discretion on whether custom instructions are global (settings), per-job (modal), or both

**Storage & history:**
- Metadata tracking: Yes, track both generation timestamp and distinguish AI-generated vs user-edited content

### Claude's Discretion

- Button design (separate vs combined generation buttons)
- Loading feedback during generation (spinner, overlay, progress indicator)
- Display layout (expandable sections, tabs, side-by-side panels)
- Copy-to-clipboard interaction pattern
- Copy feedback mechanism (toast, button state change, both)
- Custom instructions location (global settings, per-job modal, or both)
- Version history strategy (all versions, latest only, or latest + original)
- Storage space handling (character limits, compression, user-triggered cleanup)
- Content persistence approach (when/how users access previously generated content)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude API | 2023-06-01 | Text generation via Messages endpoint | Already integrated in Phase 4, proven for job scoring |
| navigator.clipboard | Web API | Copy generated text to clipboard | Native browser API, no dependencies required |
| chrome.storage.local | Chrome Extension API | Persist generated content with jobs | Already used for job storage, 10MB quota sufficient |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prompt caching | Anthropic feature | Cache resume + system prompt (90% cost savings) | Already implemented in Phase 4, reuse for content generation |
| Structured outputs | output_config with json_schema | Guarantee valid JSON responses | Use for metadata (e.g., content stats) not for text generation itself |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Haiku 4.5 | Sonnet 4.5 | Sonnet is 3x more expensive ($3/$15 vs $1/$5 per MTok) but higher quality; use Haiku first, upgrade if quality insufficient |
| Native textarea | contenteditable div | Textarea is simpler for plain text, contenteditable adds complexity without benefit for this use case |
| chrome.storage.local | chrome.storage.sync | Sync has 100KB quota (too small for cover letters), local has 10MB quota sufficient for hundreds of jobs |

**Installation:**
No new dependencies required — all APIs are native to Chrome extensions or already integrated.

## Architecture Patterns

### Recommended Module Structure
```
src/
├── api/
│   └── claude-client.js           # Reuse from Phase 4, add generateContent() function
├── content-generator.js            # New: orchestrates generation, caching, storage
├── dashboard/
│   └── job-modal.js                # Extend with content generation UI
└── storage.js                      # Extend job schema with generated content
```

### Pattern 1: Reuse Existing Claude Client Infrastructure
**What:** Extend `src/api/claude-client.js` with new `generateContent()` function alongside existing `scoreJob()` function
**When to use:** All Claude API calls (scoring + content generation)
**Example:**
```javascript
// Source: Existing Phase 4 implementation (src/api/claude-client.js)
import { retryWithBackoff, createApiError } from '../errors.js';

export async function generateContent(contentType, job, resume, apiKey, customInstructions = '') {
  const requestBody = {
    model: 'claude-haiku-4-5',
    max_tokens: contentType === 'coverLetter' ? 800 : 200,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(contentType),
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
        content: buildUserPrompt(contentType, job, customInstructions)
      }
    ]
  };

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

    if (!response.ok) {
      throw await createApiError(response, 'claude');
    }

    return response.json();
  });

  return {
    content: result.content[0].text,
    usage: result.usage
  };
}
```

### Pattern 2: Prompt Caching for Cost Optimization
**What:** Cache resume and system prompt using `cache_control: { type: 'ephemeral' }` to reduce costs by 90%
**When to use:** All Claude API calls where resume and instructions are reused
**Example:**
```javascript
// Source: https://platform.claude.com/docs/en/api/messages
system: [
  {
    type: 'text',
    text: 'You are an expert career advisor...',
    cache_control: { type: 'ephemeral' }  // Cache for 5 minutes
  },
  {
    type: 'text',
    text: `Candidate Resume:\n\n${resume}`,
    cache_control: { type: 'ephemeral' }  // Cache resume separately
  }
]
```

### Pattern 3: Multishot Prompting with Negative Examples
**What:** Provide 3-5 examples showing desired style AND explicit anti-patterns to avoid
**When to use:** Content generation where tone and style are critical
**Example:**
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/multishot-prompting
function buildSystemPrompt(contentType) {
  return `You are an expert career advisor helping job seekers write ${contentType === 'coverLetter' ? 'cover letters' : 'recruiter messages'}.

CRITICAL TONE REQUIREMENTS:
- Professional but conversational (not stiff or formal)
- Natural, human-like writing (not robotic or generic)
- Specific to the candidate and role (not templated)

NEVER use these AI cliches:
- "I am writing to express my interest"
- "I am excited to apply"
- "Leverage my skills"
- "I'm a team player"
- "Think outside the box"
- "Hit the ground running"
- "Proven track record"
- "Results-driven"

GOOD EXAMPLE:
<example>
I noticed your team is building a real-time collaboration platform. That's exactly the kind of work I've been doing for the past three years at Acme Corp, where I architected the WebSocket infrastructure that now handles 50K concurrent users.

Your posting mentions scaling challenges. I've dealt with similar issues — our system went from 5K to 50K users in six months, and I led the effort to refactor our backend to handle the load without adding servers.

I'd love to talk about how my experience could help your team. Are you open to a quick call next week?
</example>

BAD EXAMPLE (don't write like this):
<example>
I am writing to express my strong interest in the Senior Software Engineer position at your company. With my proven track record of success and results-driven approach, I am confident I would be an excellent fit for your team.

I am a hard worker who thinks outside the box and am excited to leverage my skills to help your organization achieve its goals. I am a team player who can hit the ground running from day one.

I look forward to the opportunity to discuss how my experience aligns with your needs.
</example>`;
}
```

### Pattern 4: Debounced Auto-Save with Flush-on-Close
**What:** Delay saves by 1 second while user edits, flush immediately on modal close to prevent data loss
**When to use:** Textarea editing where users expect content to be saved automatically
**Example:**
```javascript
// Source: Existing Phase 6 implementation (src/dashboard/job-modal.js lines 16-89)
let saveTimeout = null;
let pendingJobId = null;
let pendingContent = null;

function handleContentEdit(jobId, contentType, newContent) {
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Store pending state
  pendingJobId = jobId;
  pendingContent = { [contentType]: newContent };

  // Debounce save (1 second)
  saveTimeout = setTimeout(async () => {
    await storage.updateJob(jobId, {
      generated: { ...job.generated, ...pendingContent }
    });
    saveTimeout = null;
    pendingJobId = null;
    pendingContent = null;
  }, 1000);
}

// Flush on modal close
modal.addEventListener('close', async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingJobId && pendingContent) {
    await storage.updateJob(pendingJobId, {
      generated: { ...job.generated, ...pendingContent }
    });
    pendingJobId = null;
    pendingContent = null;
  }
});
```

### Pattern 5: Clipboard Copy with User Feedback
**What:** Use `navigator.clipboard.writeText()` with visual feedback (button state change or toast)
**When to use:** Copy-to-clipboard functionality in extensions
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
async function copyToClipboard(text, buttonElement) {
  try {
    await navigator.clipboard.writeText(text);

    // Visual feedback: button state change
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Copied!';
    buttonElement.classList.add('success');

    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.classList.remove('success');
    }, 2000);
  } catch (error) {
    console.error('Copy failed:', error);
    // Fallback: show error state
    buttonElement.textContent = 'Copy failed';
    buttonElement.classList.add('error');
  }
}
```

### Pattern 6: Textarea Auto-Resize
**What:** Automatically expand textarea height to fit content as user types
**When to use:** Multi-line text editing where scrolling within textarea is poor UX
**Example:**
```javascript
// Source: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
// Modern CSS approach (limited browser support)
textarea {
  field-sizing: content; /* Auto-resize to content */
}

// Fallback JavaScript approach (universal support)
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

textarea.addEventListener('input', (e) => {
  autoResizeTextarea(e.target);
});
```

### Anti-Patterns to Avoid
- **Generic system prompts:** Vague instructions like "write naturally" fail. Use specific negative examples and explicit constraints.
- **Ignoring user edits:** Don't overwrite user-edited content on regenerate without warning.
- **Synchronous clipboard API:** `document.execCommand('copy')` is deprecated, use `navigator.clipboard.writeText()` async API.
- **No loading state:** Claude API takes 2-5 seconds, show loading feedback or users will think it's broken.
- **Storing all versions:** Cover letters average 400-600 words (~2-3KB), storing 10 versions per job wastes storage. Keep latest only or latest + original.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy to clipboard | Custom textarea selection logic with document.execCommand | navigator.clipboard.writeText() | Modern Clipboard API handles permissions, fallbacks, and security contexts automatically |
| Debounce function | Manual setTimeout/clearTimeout tracking | Existing debounce pattern from Phase 6 | Already proven in job-modal.js notes auto-save, handles edge cases like flush-on-close |
| Prompt caching | Re-send full resume with every request | cache_control: { type: 'ephemeral' } | 90% cost reduction, already implemented in Phase 4 scoring |
| AI writing style | Generic "write professionally" prompt | Multishot prompting with negative examples | Explicit anti-patterns prevent AI cliches better than positive instructions alone |
| Storage quota management | Custom compression/cleanup logic | chrome.storage.local with 10MB quota | 10MB = ~5,000 cover letters (2KB each), quota is sufficient without custom logic |

**Key insight:** Chrome extensions and Claude API provide robust primitives for all core functionality. Custom solutions add complexity without benefit.

## Common Pitfalls

### Pitfall 1: AI-Sounding Writing Despite Generic Instructions
**What goes wrong:** Prompt says "write naturally" but output still sounds robotic with cliches like "I am writing to express" or "leverage my skills"
**Why it happens:** Positive instructions alone are insufficient. Claude's training includes millions of formulaic cover letters, so it defaults to common patterns without explicit negative constraints.
**How to avoid:** Use multishot prompting with explicit negative examples. List specific phrases to avoid in system prompt. Provide both good and bad examples.
**Warning signs:** User feedback that content "sounds like AI wrote it" or requires heavy editing to sound human.

### Pitfall 2: Clipboard Permission Failures
**What goes wrong:** `navigator.clipboard.writeText()` fails with permission errors in some contexts
**Why it happens:** Clipboard API requires secure context (HTTPS) and user activation. Extensions need `clipboardWrite` permission in manifest.
**How to avoid:** Add `"permissions": ["clipboardWrite"]` to manifest.json. Call clipboard API only in response to user action (button click). Provide error handling for permission denials.
**Warning signs:** Copy button works in dev environment but fails after installation. Console shows "DOMException: Document is not focused" errors.

### Pitfall 3: Storage Quota Exceeded from Version History
**What goes wrong:** Extension hits 10MB storage limit after users generate content for hundreds of jobs
**Why it happens:** Storing multiple versions per job (original + 5 regenerations) multiplies storage usage. 400 jobs × 3KB per version × 6 versions = 7.2MB just for cover letters.
**How to avoid:** Store only latest version by default. If user wants version history, implement user-triggered cleanup or limit to 2 versions (original + latest). Monitor storage usage and warn user at 80% capacity.
**Warning signs:** `chrome.runtime.lastError` when saving jobs. Storage operations fail silently after quota exceeded.

### Pitfall 4: Lost Edits When User Regenerates
**What goes wrong:** User spends 5 minutes editing generated content, clicks Regenerate, and loses all edits
**Why it happens:** Regenerate button overwrites current content without checking if user has modified it
**How to avoid:** Track `isEdited` flag when user modifies generated content. Show confirmation dialog before regenerating edited content: "You've edited this content. Regenerate anyway?"
**Warning signs:** User complaints about lost work. High frequency of regeneration immediately followed by re-editing.

### Pitfall 5: No Loading Feedback During Generation
**What goes wrong:** User clicks "Generate Cover Letter", waits 5 seconds with no feedback, assumes it's broken, clicks again
**Why it happens:** Claude API takes 2-5 seconds for generation. Without loading state, users don't know if request is processing.
**How to avoid:** Disable button and show loading indicator immediately on click. Display "Generating..." text. Re-enable only after response or error.
**Warning signs:** Users reporting "button doesn't work" or double-clicking generation buttons. Multiple concurrent API calls for same job.

### Pitfall 6: Resume Context Missing from Prompt
**What goes wrong:** Generated content is generic and doesn't reference candidate's specific skills or experience
**Why it happens:** Resume isn't included in Claude prompt, so model has no candidate-specific information
**How to avoid:** Include resume in system prompt with prompt caching (already implemented in Phase 4). Extract relevant sections from resume based on job requirements.
**Warning signs:** Generated content could apply to any candidate. User always has to heavily edit to add their specific experience.

## Code Examples

Verified patterns from official sources:

### Model Selection for Cost-Effectiveness
```javascript
// Source: https://platform.claude.com/docs/en/about-claude/models/overview
// Haiku 4.5: $1 input / $5 output per MTok (5x cheaper than Sonnet)
// Sonnet 4.5: $3 input / $15 output per MTok (higher quality)
// Use Haiku for production, upgrade to Sonnet if quality insufficient

const MODEL_CONFIG = {
  coverLetter: {
    model: 'claude-haiku-4-5',
    max_tokens: 800,  // ~400-600 words (3-4 paragraphs)
    cost_per_request: 0.005  // Estimate with caching: ~$0.005/request
  },
  recruiterMessage: {
    model: 'claude-haiku-4-5',
    max_tokens: 200,  // ~100 words
    cost_per_request: 0.002  // Estimate with caching: ~$0.002/request
  }
};
```

### Prompt Engineering for Natural Writing
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts
function buildSystemPrompt(contentType) {
  return `You are an expert career advisor. Write a ${contentType === 'coverLetter' ? 'cover letter' : 'LinkedIn recruiter message'} that sounds like a real person wrote it.

TONE: Professional but conversational. Approachable and natural, not stiff or robotic.

STRUCTURE:
${contentType === 'coverLetter'
  ? '- Opening: Connect your experience to their specific needs (1-2 sentences)\n- Body: 2-3 concrete examples of relevant work you\'ve done (2 paragraphs)\n- Close: Clear next step, keep it casual (1-2 sentences)'
  : '- Hook: Why you\'re reaching out (1 sentence)\n- Relevance: 1-2 specific points connecting your background to the role\n- Ask: Simple, low-pressure call to action'}

CRITICAL - NEVER use these phrases:
- "I am writing to express my interest"
- "I am excited to apply"
- "Leverage my skills"
- "Proven track record"
- "Results-driven professional"
- "Think outside the box"
- "Hit the ground running"
- "I would love the opportunity to"

Instead:
- Start with relevant insight or connection to the company
- Use specific examples with numbers when possible
- Write like you're emailing a colleague, not writing a formal letter
- Keep sentences varied in length (mix short and long)`;
}

function buildUserPrompt(contentType, job, customInstructions) {
  let prompt = `Write a ${contentType === 'coverLetter' ? 'cover letter (3-4 paragraphs)' : 'recruiter message (under 100 words)'} for this job:\n\n`;
  prompt += `Job Title: ${job.title}\n`;
  prompt += `Company: ${job.company}\n`;
  if (job.location) prompt += `Location: ${job.location}\n`;
  prompt += `\nKey Requirements:\n${extractKeyRequirements(job.description)}\n`;

  if (customInstructions) {
    prompt += `\nCustom Instructions: ${customInstructions}\n`;
  }

  prompt += `\nReference specific skills and experiences from my resume that match this role. Be conversational and natural.`;

  return prompt;
}

function extractKeyRequirements(description) {
  // Extract first 500 chars of requirements section (similar to extractJobCore in Phase 4)
  const requirementsMatch = description.match(/(?:requirements?|qualifications?)[:\s]*\n?(.*?)(?=\n\n|\n[A-Z][a-z]+:|$)/is);
  return requirementsMatch ? requirementsMatch[1].substring(0, 500) : description.substring(0, 500);
}
```

### Storage Schema Extension
```javascript
// Source: Existing storage.js pattern
// Extend job object schema with generated content

// Before (Phase 6):
// { jobId, title, company, ..., notes, status, applicationDate }

// After (Phase 7):
const jobSchema = {
  // ... existing fields
  generated: {
    coverLetter: {
      content: string,
      generatedAt: string,      // ISO timestamp
      editedAt: string | null,  // ISO timestamp when user edited, null if not edited
      isEdited: boolean          // Track if user modified AI-generated content
    },
    recruiterMessage: {
      content: string,
      generatedAt: string,
      editedAt: string | null,
      isEdited: boolean
    }
  }
};

// Update job with generated content
async function saveGeneratedContent(jobId, contentType, content) {
  const job = await storage.getJob(jobId);
  const generated = job.generated || {};

  generated[contentType] = {
    content,
    generatedAt: new Date().toISOString(),
    editedAt: null,
    isEdited: false
  };

  await storage.updateJob(jobId, { generated });
}

// Mark as edited when user modifies
async function updateGeneratedContent(jobId, contentType, newContent) {
  const job = await storage.getJob(jobId);
  const existing = job.generated?.[contentType];

  job.generated[contentType] = {
    ...existing,
    content: newContent,
    editedAt: new Date().toISOString(),
    isEdited: true
  };

  await storage.updateJob(jobId, { generated: job.generated });
}
```

### Copy to Clipboard with Permissions
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/storage
// manifest.json (add permission)
{
  "permissions": [
    "storage",
    "clipboardWrite"  // Required for navigator.clipboard.writeText()
  ]
}

// Copy implementation with feedback
async function copyContentToClipboard(content, buttonElement) {
  try {
    await navigator.clipboard.writeText(content);

    // Button state change feedback
    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✓ Copied';
    buttonElement.disabled = true;

    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Clipboard copy failed:', error);

    // Error feedback
    buttonElement.textContent = 'Copy failed';
    buttonElement.classList.add('error');

    setTimeout(() => {
      buttonElement.textContent = 'Copy';
      buttonElement.classList.remove('error');
    }, 2000);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| document.execCommand('copy') | navigator.clipboard.writeText() | ~2020 | Deprecated API removed, use async Clipboard API with permissions |
| Generic "write professionally" prompts | Multishot prompting with negative examples | 2024-2025 | Explicit anti-patterns prevent AI cliches better than positive instructions alone |
| Claude Haiku 3 | Claude Haiku 4.5 | Late 2024 | 4-5x faster, within 5% of Sonnet performance, same cost model |
| Storing full prompt with each request | Prompt caching with cache_control | 2024 | 90% cost reduction for repeated context (resume, system prompt) |

**Deprecated/outdated:**
- **document.execCommand('copy'):** Synchronous clipboard API is deprecated, use navigator.clipboard.writeText() async API
- **Claude Haiku 3:** Replaced by Haiku 4.5 with better performance and extended thinking support
- **Positive-only prompting:** Modern prompt engineering requires negative examples to avoid AI cliches

## Open Questions

Things that couldn't be fully resolved:

1. **Haiku vs Sonnet quality for content generation**
   - What we know: Haiku 4.5 is 5x cheaper ($1/$5 vs $3/$15 per MTok) and within 5% of Sonnet on many benchmarks
   - What's unclear: Whether Haiku's quality is sufficient for natural-sounding cover letters and recruiter messages, or if Sonnet's higher quality justifies 3x cost
   - Recommendation: Start with Haiku 4.5, implement quality feedback mechanism (thumbs up/down), upgrade to Sonnet if user feedback indicates quality issues

2. **Custom instructions location (global vs per-job)**
   - What we know: Users want custom instructions like "emphasize leadership" or "mention relocation willingness"
   - What's unclear: Whether instructions should be global (Settings), per-job (modal), or both. Global is convenient for recurring needs, per-job is flexible for one-offs
   - Recommendation: Implement per-job first (simpler UX, no new settings UI), add global later if users request it

3. **Version history strategy**
   - What we know: Cover letters are ~2-3KB, storage quota is 10MB = ~5,000 letters. Users may regenerate multiple times.
   - What's unclear: Whether to save all versions, latest only, or latest + original. All versions uses more storage but preserves user experimentation.
   - Recommendation: Save latest only to minimize storage usage and code complexity. If user feedback requests version history, implement latest + original (2 versions max) as Phase 8 enhancement

## Sources

### Primary (HIGH confidence)
- Claude API Messages endpoint: https://platform.claude.com/docs/en/api/messages
- Prompt engineering - be clear and direct: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/be-clear-and-direct
- Prompt engineering - multishot prompting: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/multishot-prompting
- Prompt engineering - system prompts: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts
- Claude models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- chrome.storage API: https://developer.chrome.com/docs/extensions/reference/api/storage

### Secondary (MEDIUM confidence)
- [Clipboard API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)
- [Interact with the clipboard - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard)
- [chrome.storage | API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [AI Words to Avoid - fomo.ai](https://fomo.ai/ai-resources/the-ultimate-copy-paste-prompt-add-on-to-avoid-overused-words-and-phrases-in-ai-generated-content/)
- [50 ChatGPT Prompts to Remove the AI Tone - Medium](https://medium.com/@inchristiely/50-chatgpt-prompts-to-remove-the-ai-tone-and-sound-more-like-you-523293ba1c3c)
- [How to Write a Cover Letter for 2026 - BeamJobs](https://www.beamjobs.com/cover-letter-help/how-to-write-a-cover-letter)
- [Cover Letter Clichés You Should Avoid - Proofreading Services](https://www.proofreadingservices.com/pages/cover-letter-cliches-you-should-avoid-at-all-costs)
- [9 Cover Letter Cliches to Cut - TopResume](https://topresume.com/career-advice/cliches-cut-from-cover-letter)
- [Recruiter Outreach Templates - Careery](https://careery.pro/blog/recruiter-outreach-templates)
- [10 LinkedIn InMail Best Practices](https://www.linkedin.com/business/talent/blog/product-tips/tips-for-writing-inmails-from-linkedin-recruiters)
- [2026 Guide to LinkedIn Outreach Messages - Martal](https://martal.ca/linkedin-outreach-lb/)

### Tertiary (LOW confidence)
- WebSearch: Chrome extension storage limits (10MB for chrome.storage.local, can request unlimitedStorage)
- WebSearch: Claude API pricing ($1/$5 per MTok for Haiku 4.5, $3/$15 for Sonnet 4.5)
- WebSearch: Debounce pattern best practices (1-second delay common for auto-save)
- WebSearch: Textarea auto-resize techniques (CSS field-sizing or JavaScript scrollHeight)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already integrated (Claude API, chrome.storage.local) or native browser APIs (Clipboard API)
- Architecture: HIGH - Patterns proven in Phase 4 (Claude client, prompt caching) and Phase 6 (debounced auto-save)
- Pitfalls: MEDIUM - AI writing cliches and clipboard permissions verified from official sources; storage quota and version history based on calculation and extrapolation

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - Claude API and Chrome extension APIs are stable)
