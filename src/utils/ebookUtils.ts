// utils/ebookUtils.ts
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.4.168';
import { default as ePub } from 'https://esm.sh/epubjs@0.3.93';
import mammoth from 'https://esm.sh/mammoth@1.8.0';

// Configure PDF.js worker
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';


/**
 * Finds all sentences containing the given word in a larger text content.
 * Sentences are split based on English and Chinese punctuation.
 * @param word The word to search for (case-insensitive).
 * @param ebookContent The text content of the e-book.
 * @returns An array of sentences found containing the word. Each sentence is trimmed and respects a max length.
 */
export function findExampleInEbook(word: string, ebookContent: string): string[] {
  if (!word || !ebookContent || ebookContent.length === 0) {
    return [];
  }

  const lowerWord = word.toLowerCase();
  const foundSentences: string[] = [];
  
  // Regex to split sentences by common English and Chinese terminators.
  // It also tries to handle some common cases like abbreviations by not splitting mid-word.
  // Adjusted to better capture sentences ending with punctuation followed by space/end.
  const sentenceRegex = /[^.!?。！？\s](?:[^.!?。！？]|[.!?。！？](?!\s|$))*[.!?。！？]?/g;

  let sentences: string[] = [];
  const matches = ebookContent.match(sentenceRegex);
  if (matches) {
    sentences = matches.map(s => s.trim()).filter(s => s.length > 0);
  }
  
  // Fallback for simpler splitting if regex yields too few or no results,
  // or if the content structure is very simple (e.g. one very long line).
  if (sentences.length === 0 && ebookContent.length > 50) { // Added length check to avoid over-splitting small inputs
    const basicSplit = ebookContent.split(/([.!?。！？])/);
    let currentS = "";
    for (const part of basicSplit) {
        currentS += part;
        if (/[.!?。！？]/.test(part)) {
            if (currentS.trim().length > 0) sentences.push(currentS.trim());
            currentS = "";
        }
    }
    if (currentS.trim().length > 0) sentences.push(currentS.trim());
  }


  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(lowerWord)) {
      let trimmedSentence = sentence.trim();
      
      const maxLength = 350; // Max length for a concise example

      if (trimmedSentence.length > 0 && trimmedSentence.length < maxLength) {
        foundSentences.push(trimmedSentence);
      } else if (trimmedSentence.length >= maxLength) {
        // If the sentence is too long, try to find a shorter segment around the word.
        const wordIndex = trimmedSentence.toLowerCase().indexOf(lowerWord);
        if (wordIndex !== -1) {
            const contextBefore = 80;
            const contextAfterWord = 120 + lowerWord.length;
            const start = Math.max(0, wordIndex - contextBefore);
            const end = Math.min(trimmedSentence.length, wordIndex + contextAfterWord);
            
            let candidate = trimmedSentence.substring(start, end);
            
            // Add ellipsis if snippet doesn't start/end at sentence boundary
            if (start > 0 && !/^\s*[.!?。！？]/.test(trimmedSentence.substring(start-1, start+1))) { // Check if previous char was a terminator
                 candidate = "..." + candidate;
            }
            if (end < trimmedSentence.length && !/[.!?。！？]\s*$/.test(trimmedSentence.substring(end-1, end+1))) { // Check if next char is a terminator
                 candidate = candidate + "...";
            }
            foundSentences.push(candidate.trim());
        }
      }
    }
  }
  // Remove duplicates that might arise from snippet generation
  return Array.from(new Set(foundSentences));
}

export async function parsePdfToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textContent = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textItems = await page.getTextContent();
    textItems.items.forEach((item: any) => { // item is TextItem
      textContent += item.str + ' ';
    });
    textContent += '\n'; // Add newline after each page's content
  }
  return textContent.trim();
}

export async function parseDocxToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function parseEpubToText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  // @ts-ignore Property 'items' may not be in Spine type definition but exists at runtime after book.ready
  const sections = await book.ready.then(() => book.spine.items);
  
  let fullText = "";

  for (const section of sections) {
    if (section.href) { // Ensure section has href
      try {
        const loadedSectionDocument = await book.load(section.href); // Use book.load(section.href)
        
        if (loadedSectionDocument && loadedSectionDocument.body instanceof Node) {
          const bodyElement = loadedSectionDocument.body as HTMLElement;
          fullText += bodyElement.innerText || bodyElement.textContent || "";
          fullText += "\n\n";
        } else if (typeof loadedSectionDocument === 'string') {
          fullText += loadedSectionDocument;
          fullText += "\n\n";
        }
      } catch (loadError) {
        console.warn(`Could not load or parse section ${section.href}:`, loadError);
      }
    }
  }
  // Basic cleanup for EPUB text
  return fullText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
