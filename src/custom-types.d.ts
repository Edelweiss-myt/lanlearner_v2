// src/custom-types.d.ts

// This file provides ambient declarations for modules imported via full URLs (e.g., from esm.sh)
// to satisfy the TypeScript compiler (tsc) during the build process, preventing "module not found" errors.

declare module 'https://esm.sh/pdfjs-dist@4.4.168' {
  // This module is imported as `import * as pdfjsLib from '...'`
  // So, we declare its expected named exports.
  // Using 'any' for simplicity to resolve "module not found".
  // For stricter typing, these would be replaced with actual types.
  export const GlobalWorkerOptions: any;
  export function getDocument(params: any): any;
  // Add any other named exports from pdfjs-dist used by your code if necessary.
}

declare module 'https://esm.sh/epubjs@0.3.93' {
  // This module is imported as `import { default as ePub } from '...'`
  const ePub: any; // Using 'any' for simplicity.
  export default ePub;
}

declare module 'https://esm.sh/mammoth@1.8.0' {
  // This module is imported as `import mammoth from '...'`
  const mammoth: any; // Using 'any' for simplicity.
  export default mammoth;
}

// Removed Shim for Vite client types as it's handled by vite-env.d.ts
// and was causing a conflict.
