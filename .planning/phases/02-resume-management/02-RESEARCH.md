# Phase 2: Resume Management - Research

**Researched:** 2026-02-05
**Domain:** Client-side file processing (PDF/DOCX/text) in Chrome Extensions
**Confidence:** MEDIUM-HIGH

## Summary

Resume management in Chrome extensions requires client-side file processing without backend servers. The standard approach uses **PDF.js** (Mozilla, v5.4.624) for PDF text extraction and **mammoth.js** for DOCX extraction, both running in the popup context where FileReader API and DOM access are available.

File upload happens via standard `<input type="file">` in the popup UI, with immediate processing (popup loses focus when file picker opens). Processing libraries work directly in popup.js since both PDF.js and mammoth.js support ArrayBuffer inputs from FileReader. Offscreen documents are **NOT required** for basic text extraction—popup context provides sufficient DOM access and lifecycle.

Storage considerations: Typical resume text is 2-10KB (500-5000 words), well within chrome.storage.local's 10MB limit (unlimited with unlimitedStorage permission already granted in Phase 1). Resume data structure already defined in storage.js: `{ text: string, fileName: string, uploadedAt: string }`.

**Primary recommendation:** Implement file processing in popup.js using FileReader → ArrayBuffer → PDF.js/mammoth.js → extracted text → chrome.storage.local. Keep UX simple with file input + textarea fallback, immediate processing on file selection, and clear error messaging for corrupt/unsupported files.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PDF.js | v5.4.624 | Client-side PDF text extraction | Mozilla's battle-tested library, 100% browser-based, no backend needed |
| mammoth.js | v1.4.8+ | DOCX to text/HTML conversion | De facto standard for browser DOCX processing, supports raw text extraction |
| FileReader API | Native | Read file contents as ArrayBuffer | Standard Web API for file uploads in browsers |
| chrome.storage.local | Native | Persist extracted resume text | Phase 1 already established storage abstraction with resume schema |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unpdf | Latest | Modern PDF text extraction | Alternative to PDF.js if TypeScript and async/await preferred |
| jszip | Latest | DOCX file decompression | Mammoth.js uses internally; only needed if building custom DOCX parser |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PDF.js | unpdf | unpdf offers modern TypeScript API but PDF.js more mature and widely used |
| mammoth.js | docx-preview | docx-preview renders visual preview; mammoth better for text extraction |
| Popup processing | Offscreen document | Offscreen adds complexity; popup context sufficient for file processing |
| Client-side extraction | Backend API | Backend violates "zero hosting costs" requirement |

**Installation:**
```bash
# Download pre-built distributions (no npm build required for vanilla JS)
# PDF.js: https://github.com/mozilla/pdf.js/releases/tag/v5.4.624
#   - pdf.min.mjs (main library)
#   - pdf.worker.min.mjs (worker file)
# mammoth.js: https://cdn.jsdelivr.net/npm/mammoth@1.4.8/mammoth.browser.min.js
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── pdf.min.mjs              # PDF.js main library
│   ├── pdf.worker.min.mjs       # PDF.js worker (auto-loaded)
│   └── mammoth.browser.min.js   # mammoth.js browser bundle
├── resume-processor.js          # Resume processing module
├── settings.js                  # Settings panel (Phase 1, extend for resume upload)
└── storage.js                   # Storage abstraction (Phase 1, add getResume/setResume)
```

### Pattern 1: File Upload in Popup Context

**What:** File input in popup.html with immediate processing via FileReader

**When to use:** All file uploads in Chrome extensions where popup UI exists

**Example:**
```html
<!-- In popup.html or settings panel -->
<div class="file-upload-section">
  <label for="resume-upload" class="upload-label">
    Upload Resume (PDF/DOCX)
  </label>
  <input type="file" id="resume-upload" accept=".pdf,.docx" />
  <p class="file-info" id="current-resume">No resume uploaded</p>
</div>

<div class="text-upload-section">
  <label for="resume-text">Or paste resume text:</label>
  <textarea id="resume-text" rows="10" placeholder="Paste your resume here..."></textarea>
  <button id="save-text">Save Resume Text</button>
</div>
```

### Pattern 2: PDF Text Extraction with PDF.js

**What:** Extract text from PDF file using Mozilla's PDF.js library

**When to use:** Any PDF text extraction in browser without backend

**Example:**
```javascript
// Source: https://mozilla.github.io/pdf.js/examples/
// Based on PDF.js v5.4.624 documentation

import * as pdfjsLib from './lib/pdf.min.mjs';

// Set worker path (required for PDF.js)
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

async function extractTextFromPDF(arrayBuffer) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. File may be corrupted or password-protected.');
  }
}
```

### Pattern 3: DOCX Text Extraction with mammoth.js

**What:** Extract plain text from DOCX files using mammoth.js in browser

**When to use:** DOCX text extraction without backend server

**Example:**
```javascript
// Source: https://github.com/mwilliamson/mammoth.js
// mammoth.js browser usage

// Load mammoth from browser bundle (sets window.mammoth)
// <script src="lib/mammoth.browser.min.js"></script>

async function extractTextFromDOCX(arrayBuffer) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });

    // Check for warnings/errors
    if (result.messages.length > 0) {
      console.warn('DOCX extraction warnings:', result.messages);
    }

    return result.value; // Plain text with paragraphs separated by \n\n
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX. File may be corrupted or unsupported.');
  }
}
```

### Pattern 4: FileReader to ArrayBuffer

**What:** Read uploaded file as ArrayBuffer for processing by PDF.js/mammoth.js

**When to use:** Any file upload that needs binary processing

**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/FileReader

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      resolve(event.target.result); // ArrayBuffer
    };

    reader.onerror = (error) => {
      reject(new Error(`Failed to read file: ${error.message}`));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Usage
document.getElementById('resume-upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const text = await processResumeFile(file.name, arrayBuffer);
    await storage.setResume({ text, fileName: file.name, uploadedAt: new Date().toISOString() });
    showSuccess('Resume uploaded successfully');
  } catch (error) {
    showError(error.message);
  }
});
```

### Pattern 5: Unified Resume Processor

**What:** Single module handling PDF/DOCX/text with file type detection

**When to use:** Resume management feature with multiple format support

**Example:**
```javascript
// resume-processor.js

async function processResumeFile(fileName, arrayBuffer) {
  const extension = fileName.split('.').pop().toLowerCase();

  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(arrayBuffer);
    case 'docx':
      return await extractTextFromDOCX(arrayBuffer);
    default:
      throw new Error(`Unsupported file format: ${extension}. Please upload PDF or DOCX.`);
  }
}

async function saveResumeText(text) {
  if (!text || text.trim().length < 50) {
    throw new Error('Resume text too short. Please provide at least 50 characters.');
  }

  await storage.setResume({
    text: text.trim(),
    fileName: 'pasted-text.txt',
    uploadedAt: new Date().toISOString()
  });
}
```

### Anti-Patterns to Avoid

- **Offscreen documents for simple text extraction:** Adds unnecessary complexity; popup context provides all needed APIs (DOM, FileReader, Web Workers)
- **Processing files in service worker:** Service workers lack DOM access; PDF.js and mammoth.js need DOM APIs or Web Workers
- **Storing original file binary:** Store extracted text only; original PDF/DOCX wastes storage and isn't needed for AI scoring
- **Synchronous FileReader:** Always use async methods (readAsArrayBuffer with promise wrapper); never block UI thread

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Regex on PDF binary, manual PDF parsing | PDF.js | PDF spec is 1000+ pages; complex font encodings, compression, embedded files |
| DOCX parsing | Unzip + XML parsing | mammoth.js | DOCX has nested XML schemas, relationships, styles; edge cases abound |
| Multi-column resume parsing | Custom column detection | Let PDF.js/mammoth handle | Libraries preserve reading order; custom logic breaks with tables/layouts |
| File type validation | Check file extension only | Check extension + MIME type + magic bytes | Users can rename .txt → .pdf; validate actual file content |
| Character encoding | Assume UTF-8 | Let libraries handle encoding | PDFs use various encodings (Latin1, UTF-16BE, etc.) |

**Key insight:** Document formats are deceptively complex. PDFs and DOCX files have layers of compression, encoding, and structure that require battle-tested parsers. Focus on UX and error handling, not reinventing file parsers.

## Common Pitfalls

### Pitfall 1: Popup Loses Focus on File Picker

**What goes wrong:** Chrome extension popups close when losing focus. Opening file picker (`<input type="file">` click) causes popup to lose focus, potentially closing the popup before file processing completes.

**Why it happens:** Popup window lifecycle—popups are destroyed when closed, interrupting JavaScript execution.

**How to avoid:** Process files **immediately** on file input change event, before popup can close. Alternatively, implement resume upload in a separate tab/window (chrome.tabs.create) for persistent processing, but this adds complexity.

**Warning signs:** User selects file but nothing happens; console shows "context invalidated" errors.

### Pitfall 2: Multi-Column Resume Text Scrambling

**What goes wrong:** PDF.js extracts text in reading order (left-to-right, top-to-bottom), but multi-column resumes can result in interleaved text: "Experience: 2020-2023 Skills: JavaScript Education: B.S. Computer React.js Science".

**Why it happens:** PDFs store text as positioned glyphs, not semantic paragraphs. Two-column layouts with side-by-side sections get read left-to-right across both columns.

**How to avoid:** Accept this limitation; AI models (Claude) handle scrambled text reasonably well for scoring. Optionally warn users to use single-column resumes for best results. Don't attempt custom column detection—too fragile across resume formats.

**Warning signs:** Extracted text mixes job titles with education, skills interleaved with experience.

### Pitfall 3: Password-Protected or Encrypted PDFs

**What goes wrong:** PDF.js throws error: "Password required or unsupported encryption" when encountering protected PDFs.

**Why it happens:** Many resume PDFs are encrypted (even without password) for security. PDF.js supports some encryption but not all.

**How to avoid:** Catch PDF.js errors and show user-friendly message: "This PDF is password-protected or encrypted. Please upload an unprotected version." Provide link to online PDF unlock tools or instructions.

**Warning signs:** PDF upload fails with cryptic error about "encryption dictionary" or "password".

### Pitfall 4: Corrupt or Invalid Files

**What goes wrong:** Mammoth.js or PDF.js throw errors like "Invalid file format" or "Unexpected end of data" when processing corrupt files.

**Why it happens:** Users may upload incomplete downloads, wrong file type renamed to .pdf/.docx, or genuinely corrupted files.

**How to avoid:** Wrap all extraction calls in try-catch. Validate file MIME type from FileReader (file.type) before processing. Provide clear error: "File appears to be corrupted. Please re-download or export your resume again."

**Warning signs:** Extraction fails on files that open fine in Adobe/Word; users report "it works on my computer".

### Pitfall 5: Excessive File Size

**What goes wrong:** Processing very large PDFs (50+ pages, embedded images) can freeze popup or exceed memory limits.

**Why it happens:** PDF.js loads entire PDF into memory; embedded high-res images balloon file size.

**How to avoid:** Validate file size before processing (e.g., 5MB limit). Show error: "Resume file too large (max 5MB). Please upload a text-based PDF without images." Typical resume is 1-2 pages, <500KB.

**Warning signs:** Browser "Out of memory" errors, popup freezes during PDF processing.

### Pitfall 6: Missing Worker File (PDF.js)

**What goes wrong:** PDF.js fails with error: "Setting up fake worker failed" or "Cannot read property 'WorkerMessageHandler' of undefined".

**Why it happens:** PDF.js requires pdf.worker.min.mjs to be accessible at the path specified in GlobalWorkerOptions.workerSrc. If path is wrong or file missing, PDF.js falls back to fake worker (slower, may fail).

**How to avoid:** Ensure pdf.worker.min.mjs is bundled with extension and path in workerSrc matches actual file location. Test PDF processing in chrome://extensions during development.

**Warning signs:** PDFs process very slowly or fail entirely; console shows worker-related errors.

## Code Examples

Verified patterns from official sources:

### Complete File Upload Flow

```javascript
// Source: Synthesized from FileReader API (MDN), PDF.js examples, mammoth.js docs

// In popup.js or settings.js

import { storage, STORAGE_KEYS } from './storage.js';
import * as pdfjsLib from './lib/pdf.min.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

// File input handler
document.getElementById('resume-upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!validTypes.includes(file.type)) {
    showError('Please upload a PDF or DOCX file.');
    return;
  }

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showError('File too large. Please upload a resume under 5MB.');
    return;
  }

  try {
    showLoading('Processing resume...');

    // Read file as ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Extract text based on file type
    let text;
    if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(arrayBuffer);
    } else {
      text = await extractTextFromDOCX(arrayBuffer);
    }

    // Validate extracted text
    if (!text || text.trim().length < 50) {
      throw new Error('Could not extract text from file. Please try a different format or paste text directly.');
    }

    // Save to storage
    await storage.set(STORAGE_KEYS.RESUME, {
      text: text.trim(),
      fileName: file.name,
      uploadedAt: new Date().toISOString()
    });

    showSuccess(`Resume uploaded: ${file.name} (${text.length} characters)`);

  } catch (error) {
    console.error('Resume upload error:', error);
    showError(error.message || 'Failed to process resume. Please try again.');
  } finally {
    hideLoading();
  }
});

// Text paste handler
document.getElementById('save-text').addEventListener('click', async () => {
  const text = document.getElementById('resume-text').value.trim();

  if (text.length < 50) {
    showError('Resume text too short. Please provide at least 50 characters.');
    return;
  }

  try {
    await storage.set(STORAGE_KEYS.RESUME, {
      text: text,
      fileName: 'pasted-text.txt',
      uploadedAt: new Date().toISOString()
    });

    showSuccess('Resume text saved successfully.');
  } catch (error) {
    showError('Failed to save resume text.');
  }
});

// Helper functions
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n\n';
  }
  return text.trim();
}

async function extractTextFromDOCX(arrayBuffer) {
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  if (result.messages.length > 0) {
    console.warn('DOCX warnings:', result.messages);
  }
  return result.value;
}
```

### Storage Abstraction Extension

```javascript
// Source: Extending Phase 1 storage.js pattern

// Add to storage.js exports

/**
 * Get resume data
 * @returns {Promise<Object|null>} Resume object or null if not set
 */
async get getResume() {
  return await this.get(STORAGE_KEYS.RESUME);
}

/**
 * Save resume data
 * @param {Object} resume - Resume object { text, fileName, uploadedAt }
 * @returns {Promise<void>}
 */
async setResume(resume) {
  await this.set(STORAGE_KEYS.RESUME, resume);
}

/**
 * Clear resume data
 * @returns {Promise<void>}
 */
async clearResume() {
  await this.set(STORAGE_KEYS.RESUME, null);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF processing | Client-side PDF.js in browser | 2015+ | Eliminated backend costs, privacy-preserving (no file uploads) |
| Manifest V2 background pages | Manifest V3 service workers | 2022 (required 2024) | Service workers lack DOM; must process files in popup/offscreen context |
| pdf-parse (Node.js) | unpdf (universal runtime) | 2023+ | unpdf works in serverless/edge; modern async/await API |
| XMLHttpRequest | fetch API | 2015+ | Service workers require fetch; XHR not available |
| File System Access API | FileReader API | N/A | Extensions use FileReader for security; File System Access too permissive |

**Deprecated/outdated:**
- **Manifest V2 background pages with DOM access**: Replaced by service workers (no DOM) + popup context + offscreen documents
- **pdf.js-extract wrapper**: Direct PDF.js usage preferred; pdf.js-extract adds unnecessary abstraction for simple text extraction
- **<webview> for document rendering**: Deprecated in Chrome extensions; use iframes or offscreen documents

## Open Questions

Things that couldn't be fully resolved:

1. **Multi-column resume handling quality**
   - What we know: PDF.js extracts text in visual order (left-to-right, top-to-bottom), which scrambles multi-column layouts
   - What's unclear: How well Claude API handles scrambled resume text for job matching
   - Recommendation: Accept scrambled text; optionally advise users to use single-column resumes. Test with sample multi-column resume in Phase 4 (AI scoring) to validate quality.

2. **Popup closure during file processing**
   - What we know: Popups close when losing focus; file picker triggers blur event
   - What's unclear: Whether Chrome closes popup immediately or waits for current JS task to complete
   - Recommendation: Implement immediate processing (synchronous event handler → async processing). If issues arise, consider moving upload to dedicated tab (chrome.tabs.create with extension page).

3. **PDF.js worker file loading in extensions**
   - What we know: PDF.js requires workerSrc path to pdf.worker.min.mjs
   - What's unclear: Best practice for worker path in bundled extension (absolute vs relative, chrome-extension:// URL)
   - Recommendation: Use relative path './lib/pdf.worker.min.mjs' and test thoroughly. If issues, try chrome.runtime.getURL('lib/pdf.worker.min.mjs').

4. **Character encoding edge cases**
   - What we know: PDF.js and mammoth.js handle common encodings (UTF-8, Latin1)
   - What's unclear: How libraries handle rare encodings or malformed characters in resumes
   - Recommendation: Accept library defaults; if garbled text reported, add character sanitization (replace non-printable characters).

## Sources

### Primary (HIGH confidence)

- [Chrome.storage API - Official Chrome Developers Documentation](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage limits and unlimitedStorage permission
- [PDF.js GitHub Repository](https://github.com/mozilla/pdf.js) - Current version v5.4.624, setup requirements, worker configuration
- [mammoth.js GitHub Repository](https://github.com/mwilliamson/mammoth.js) - Browser API, extractRawText function, limitations
- [FileReader API - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) - readAsArrayBuffer usage, error handling
- [chrome.offscreen API - Official Chrome Developers Documentation](https://developer.chrome.com/docs/extensions/reference/api/offscreen) - Offscreen document reasons, lifecycle, limitations

### Secondary (MEDIUM confidence)

- [Extract text from PDF files using PDF.js and JavaScript - Nutrient Blog](https://www.nutrient.io/blog/how-to-extract-text-from-a-pdf-using-javascript/) - PDF.js usage patterns verified with official docs
- [unpdf GitHub Repository](https://github.com/unjs/unpdf) - Alternative PDF extraction library, modern API
- [Offscreen Documents in Manifest V3 - Chrome Developers Blog](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) - When to use offscreen documents vs popup context
- [ATS Resume Formatting Rules 2026 - ResumeAdapter](https://www.resumeadapter.com/blog/ats-resume-formatting-rules-2026) - Multi-column resume pitfalls, text extraction challenges
- [FileReader API Best Practices - 12 Days of Web](https://12daysofweb.dev/2023/filereader-api/) - Security considerations, performance optimization

### Tertiary (LOW confidence - WebSearch only)

- [Resume file size recommendations - Jotform](https://www.jotform.com/answers/1834420-what-file-size-and-format-is-best-for-applicants-to-upload-their-resume) - Typical resume sizes under 5MB
- [File Input UX Patterns - LogRocket Blog](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/) - Drag-and-drop file upload patterns
- Community discussions on PDF.js in Chrome extensions (Google Groups, GitHub issues) - Implementation approaches, error scenarios

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PDF.js and mammoth.js are industry-standard, verified with official repos
- Architecture: HIGH - Popup context processing verified with Chrome extension docs and FileReader MDN docs
- Pitfalls: MEDIUM-HIGH - Multi-column scrambling documented in ATS resources; popup closure is known Chrome behavior; other pitfalls derived from library documentation
- File size limits: MEDIUM - Based on community recommendations and practical resume sizes, not official standards

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable domain, libraries mature)
