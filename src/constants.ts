
// Spaced Repetition System intervals in days
// Stages:
// 0 (New): review in 1 day
// 1 (1 day): review in 2 days
// 2 (1+2 days): review in 7 days
// 3 (1+2+7 days): review in 30 days
// 4 (1+2+7+30 days): review in 182 days
// Stage 5 means item has completed the 182-day interval.
export const SRS_INTERVALS_DAYS: { [key: number]: number } = {
  0: 1,
  1: 2,
  2: 7,
  3: 30,
  4: 182,
};

export const MAX_SRS_STAGE = Object.keys(SRS_INTERVALS_DAYS).length -1; // This will be 4

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';

export const SYLLABUS_ROOT_ID = 'root'; // For the main syllabus

// Conceptual root ID for the single, unified "New Knowledge Syllabus"
// Top-level "subjects" (e.g., Economics, Psychology) in this syllabus will have this ID as their parentId.
export const NEW_KNOWLEDGE_SYLLABUS_ROOT_ID = 'new_knowledge_root';

export const SYLLABUS_PATH_SEPARATOR = " > ";
