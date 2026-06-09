import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set standard CDN URL for the PDFJS Worker
const PDFJS_VERSION = '4.0.379'; // Common stable worker fallback version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || PDFJS_VERSION}/pdf.worker.min.js`;

/**
 * Parses an uploaded file into raw plain text client-side.
 * Supports PDF, DOCX, and TXT files.
 */
export async function parseFileToText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return await parsePdfFile(file);
    case 'docx':
      return await parseDocxFile(file);
    case 'txt':
    default:
      return await parseTxtFile(file);
  }
}

/**
 * Extracts plain text from a PDF file using pdfjs-dist
 */
async function parsePdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group text items by line heuristically
      const items = textContent.items as any[];
      let lastY: number | null = null;
      let pageText = '';

      for (const item of items) {
        // If the vertical coordinate changes significantly, add a newline
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }

      fullText += pageText + '\n\n';
    }

    if (!fullText.trim()) {
      throw new Error('No readable text found in PDF. The document might scan-only or image-based.');
    }

    return fullText;
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF resume: ${err.message || err}`);
  }
}

/**
 * Extracts plain text from a DOCX file using Mammoth.js
 */
async function parseDocxFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.messages && result.messages.length > 0) {
      console.warn('Word document extractor alerts:', result.messages);
    }

    if (!result.value || !result.value.trim()) {
      throw new Error('This Word document appears to be empty.');
    }

    return result.value;
  } catch (err: any) {
    console.error('Word file parsing error:', err);
    throw new Error(`Failed to parse DOCX resume: ${err.message || err}`);
  }
}

/**
 * Extracts raw contents from plain text file using standard Reader
 */
function parseTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the raw text file.'));
    };
    reader.readAsText(file);
  });
}
