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
  syllabusItemId: string | null;
}

export interface SyllabusItem {
  id: string;
  title: string;
  parentId: string | null;
  // order: number; // For ordering items under the same parent
}

export type LearningItem = WordItem | KnowledgePointItem;

export enum ActiveTab {
  Learn = '学习',
  Review = '复习',
  Syllabus = '大纲',
  AiChat = '',
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sources?: GroundingChunk[];
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}
export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export interface Ebook {
  id: string; // Added for unique identification
  name: string;
  content: string; // Full text content of the ebook
}
