import * as pdfjsLib from './lib/pdf.min.mjs';

// Configure PDF.js worker path for Chrome extension
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('src/lib/pdf.worker.min.mjs');

/**
 * Validates a File object before processing
 * @param {File} file - File object to validate
 * @returns {string} - Lowercase file extension ('pdf' or 'docx')
 * @throws {Error} - If file is invalid, too large, or unsupported format
 */
export function validateFile(file) {
  if (!file || file.size === 0) {
    throw new Error('No file selected or file is empty.');
  }

  // Check file size (5MB limit)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Please upload a resume under 5MB.');
  }

  // Extract and validate file extension
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

  if (extension !== 'pdf' && extension !== 'docx') {
    throw new Error('Unsupported file format. Please upload a PDF or DOCX file.');
  }

  return extension;
}

/**
 * Reads a File object as an ArrayBuffer
 * @param {File} file - File object to read
 * @returns {Promise<ArrayBuffer>} - Promise resolving to ArrayBuffer
 * @throws {Error} - If file reading fails
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extracts text from a PDF ArrayBuffer using PDF.js
 * @param {ArrayBuffer} arrayBuffer - PDF file data
 * @returns {Promise<string>} - Extracted text
 * @throws {Error} - If PDF extraction fails
 */
export async function extractTextFromPDF(arrayBuffer) {
  try {
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textPages = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine all text items with spaces
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');

      textPages.push(pageText);
    }

    // Combine all pages with double newlines
    return textPages.join('\n\n').trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. The file may be corrupted or password-protected.');
  }
}

/**
 * Extracts text from a DOCX ArrayBuffer using mammoth.js
 * @param {ArrayBuffer} arrayBuffer - DOCX file data
 * @returns {Promise<string>} - Extracted text
 * @throws {Error} - If DOCX extraction fails
 */
export async function extractTextFromDOCX(arrayBuffer) {
  try {
    // Access mammoth from window (loaded via script tag)
    if (!window.mammoth) {
      throw new Error('mammoth.js library not loaded');
    }

    const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });

    // Log any warnings or messages
    if (result.messages && result.messages.length > 0) {
      console.warn('mammoth.js messages:', result.messages);
    }

    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX. The file may be corrupted or unsupported.');
  }
}

/**
 * Main entry point: validates, reads, and extracts text from a resume file
 * @param {File} file - Resume file (PDF or DOCX)
 * @returns {Promise<Object>} - { text: string, fileName: string, uploadedAt: string }
 * @throws {Error} - If any step fails or extracted text is insufficient
 */
export async function processResumeFile(file) {
  // Validate file
  const fileType = validateFile(file);

  // Read file as ArrayBuffer
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // Extract text based on file type
  let extractedText;
  if (fileType === 'pdf') {
    extractedText = await extractTextFromPDF(arrayBuffer);
  } else if (fileType === 'docx') {
    extractedText = await extractTextFromDOCX(arrayBuffer);
  }

  // Validate extracted text
  const trimmedText = extractedText.trim();
  if (!trimmedText || trimmedText.length < 50) {
    throw new Error('Could not extract enough text from file. Please try a different format or paste your resume text directly.');
  }

  return {
    text: trimmedText,
    fileName: file.name,
    uploadedAt: new Date().toISOString()
  };
}
