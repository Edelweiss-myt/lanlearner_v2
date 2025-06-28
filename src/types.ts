export interface WordDefinition {
  definition: string;
  partOfSpeech: string;
  example: string;
  error?: string;
}

export interface StudyItem {
  id: string;
  createdAt: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  srsStage: number; // 0 for new, then 1, 2, 3...
  notes?: string;
}

export interface WordItem extends StudyItem {
  type: 'word';
  text: string;
  definition: string;
  partOfSpeech: string;
  exampleSentence: string;
}

export interface KnowledgePointItem extends StudyItem {
  type: 'knowledge';
  title: string;
  content: string;
  syllabusItemId: string | null; // ID of the category it belongs to
  masterId?: string; // Used to link a new subject KP with its counterpart in the main syllabus
  subjectId?: string; // For KPs in newKnowledgeSyllabus, this is the ID of their top-level "subject" category.
  imageUrl?: string; // URL or base64 data URL for an associated image
  imageName?: string; // Original name of the image file
}

export interface SyllabusItem {
  id: string;
  title: string;
  parentId: string | null;
  isLearned?: boolean;
  // order: number; // For ordering items under the same parent
}

export type LearningItem = WordItem | KnowledgePointItem;

export enum ActiveTab {
  Learn = '学习',
  Review = '复习',
  Syllabus = '大纲',
  BuildNewSystem = '搭建新体系',
}

export interface Ebook {
  id: string;
  name: string;
  content: string;
}

export interface RecentlyDeletedItem {
  item: LearningItem;
  deletedAt: string;
}

// NewSubject interface is removed.
// The "BuildNewSystem" tab will now manage a single, unified syllabus ("newKnowledgeSyllabus")
// where top-level items are considered the different "subjects" (e.g., Economics, Psychology).

export interface CurrentLearningPlan {
  // If plan is for a category within newKnowledgeSyllabus, subjectId refers to the ID of its top-level "subject" category.
  // If plan is for a category within mainSyllabus, this might be null or SYLLABUS_ROOT_ID.
  subjectId: string | null;
  categoryId: string;
  categoryName: string;
}
