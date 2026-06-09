import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
// Bundled worker URL — resolved and emitted by Vite so the parser works fully offline.
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Wire the bundled worker once at module load (no CDN / network dependency).
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

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
    case 'doc':
      return await parseDocxFile(file);
    case 'txt':
    default:
      return await parseTxtFile(file);
  }
}

/**
 * Extracts plain text from a PDF file using the bundled pdfjs-dist engine.
 * Runs entirely offline — no CDN or network access required.
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
      const items = textContent.items as any[];
      
      const pageText = parsePdfPageColumns(items);
      fullText += pageText + '\n\n';
    }

    if (!fullText.trim()) {
      throw new Error('No readable text found in PDF. The document might be scan-only or image-based.');
    }

    return fullText;
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    throw new Error(`Failed to parse PDF resume: ${err.message || err}`);
  }
}

/**
 * Highly robust column segmenting and sorting layout engine.
 * Solves standard multi-column, side-rail, and dual-pane CV sheets.
 */
function parsePdfPageColumns(items: any[]): string {
  if (items.length === 0) return '';

  const validItems = items.filter(item => item.str && item.str.trim().length > 0);
  if (validItems.length === 0) return '';

  // Determine boundaries of all text elements
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let totalChars = 0;

  validItems.forEach(item => {
    const x = item.transform[4];
    const y = item.transform[5];
    const w = item.width || (item.str.length * 5.5);
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    totalChars += item.str.length;
  });

  const widthRange = maxX - minX;
  const heightRange = maxY - minY;

  // Header detection threshold: top 15% of the page vertical span
  const ySplitTop = maxY - 0.15 * heightRange;
  // Footer detection threshold: bottom 10% of the page vertical span
  const ySplitBottom = minY + 0.10 * heightRange;

  // Scan horizontal coordinates in the middle of the page to find the best column gutter
  let bestSplitX = -1;
  let minCrossScore = Infinity;
  const steps = 50;
  
  if (widthRange > 180) {
    const stepSize = widthRange / steps;
    // Scan middle area (from step 12 to 38 out of 50)
    for (let s = 12; s <= 38; s++) {
      const splitXCandidate = minX + s * stepSize;
      let crossScore = 0;
      
      validItems.forEach(item => {
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width || (item.str.length * 5.5);
        
        // Ignore items in the header zone or footer zone when calculating the gutter split
        if (y > ySplitTop || y < ySplitBottom) {
          return;
        }

        // Count how many characters of text are crossing the splitXCandidate
        if (x < splitXCandidate - 5 && (x + w) > splitXCandidate + 5) {
          crossScore += item.str.length;
        }
      });
      
      if (crossScore < minCrossScore) {
        minCrossScore = crossScore;
        bestSplitX = splitXCandidate;
      }
    }
  }

  // A page is multi-column if:
  // 1. We found a candidate split.
  // 2. The crossing score is very small relative to the page characters (gutter has very few crossing texts).
  const isMultiColumn = widthRange > 180 && bestSplitX !== -1 && (minCrossScore < 100 || minCrossScore < (totalChars * 0.1));

  const formatBlock = (blockItems: any[]): string => {
    if (blockItems.length === 0) return '';
    const rows: { y: number; items: any[] }[] = [];
    
    blockItems.forEach(item => {
      const y = item.transform[5];
      const rowMatch = rows.find(r => Math.abs(r.y - y) < 4);
      if (rowMatch) {
         rowMatch.items.push(item);
      } else {
         rows.push({ y, items: [item] });
      }
    });

    // Sort top-to-bottom (remember higher Y is higher on paper)
    rows.sort((a, b) => b.y - a.y);
    // Sort left-to-right inside each row line
    rows.forEach(r => {
      r.items.sort((a, b) => a.transform[4] - b.transform[4]);
    });

    return rows.map(r => r.items.map(item => item.str).join(' ')).join('\n');
  };

  if (isMultiColumn) {
    const headerGroup: any[] = [];
    const footerGroup: any[] = [];
    const leftGroup: any[] = [];
    const rightGroup: any[] = [];

    validItems.forEach(item => {
      const x = item.transform[4];
      const y = item.transform[5];
      const w = item.width || (item.str.length * 5.5);

      if (y > ySplitTop) {
        headerGroup.push(item);
      } else if (y < ySplitBottom) {
        footerGroup.push(item);
      } else {
        // Decide left or right based on centroid
        const center = x + w / 2;
        if (center < bestSplitX) {
          leftGroup.push(item);
        } else {
          rightGroup.push(item);
        }
      }
    });

    // Format segments
    const headerText = formatBlock(headerGroup);
    const leftText = formatBlock(leftGroup);
    const rightText = formatBlock(rightGroup);
    const footerText = formatBlock(footerGroup);

    let parsedOutput = '';
    if (headerText) {
      parsedOutput += `${headerText}\n\n`;
    }
    parsedOutput += `--- COLUMN LEFT ---\n${leftText}\n\n`;
    parsedOutput += `--- COLUMN RIGHT ---\n${rightText}\n\n`;
    if (footerText) {
      parsedOutput += `${footerText}\n`;
    }
    return parsedOutput;
  } else {
    // Single column standard list flow, sort purely by coordinate row lines
    return formatBlock(validItems);
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
