
import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
import { formatDate } from './dateUtils';
import { SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID } from '../constants';

// Helper to safely format dates, allows nulls
const formatNullableDate = (dateString: string | null): string => {
  return dateString ? formatDate(new Date(dateString)) : 'N/A';
};

const getSyllabusPath = (
  syllabusItemId: string | null,
  syllabusItems: SyllabusItem[]
): string => {
  if (!syllabusItemId) {
    return '未分类';
  }
  const pathParts: string[] = [];
  let currentId: string | null = syllabusItemId;
  while (currentId) {
    const item = syllabusItems.find(s => s.id === currentId);
    // Stop if item is the root node itself or if parent is root/null
    if (item && item.id !== SYLLABUS_ROOT_ID && item.parentId !== SYLLABUS_ROOT_ID) {
      pathParts.unshift(item.title);
      currentId = item.parentId;
    } else if (item && item.id !== SYLLABUS_ROOT_ID && item.parentId === SYLLABUS_ROOT_ID) {
      pathParts.unshift(item.title); // Include item whose parent is root
      currentId = null; // Stop here
    } else if (item && item.id !== SYLLABUS_ROOT_ID && item.parentId === null) {
       pathParts.unshift(item.title); // Include top-level item
       currentId = null; // Stop here
    }
     else {
      currentId = null; // Stop if item not found or reached true root
    }
  }
  return pathParts.length > 0 ? pathParts.join(SYLLABUS_PATH_SEPARATOR) : '未分类';
};

// Core export logic
const createWorkbookAndDownload = (
  words: WordItem[],
  knowledgePoints: KnowledgePointItem[],
  syllabusItems: SyllabusItem[],
  filename: string
): void => {
  // Prepare Words Sheet
  const wordsData = words.map(word => ({
    '单词': word.text,
    '释义': word.definition,
    '词性': word.partOfSpeech,
    '例句': word.exampleSentence,
    '备注': word.notes || '',
    '创建日期': formatNullableDate(word.createdAt),
    '上次复习': formatNullableDate(word.lastReviewedAt),
    '下次复习': formatNullableDate(word.nextReviewAt),
    '复习阶段': word.srsStage,
  }));
  const wordsSheet = XLSX.utils.json_to_sheet(wordsData);

  // Prepare Knowledge Points Sheet
  const knowledgePointsData = knowledgePoints.map(kp => ({
    '标题': kp.title,
    '内容': kp.content,
    '分类': getSyllabusPath(kp.syllabusItemId, syllabusItems),
    '备注': kp.notes || '',
    '创建日期': formatNullableDate(kp.createdAt),
    '上次复习': formatNullableDate(kp.lastReviewedAt),
    '下次复习': formatNullableDate(kp.nextReviewAt),
    '复习阶段': kp.srsStage,
  }));
  const knowledgePointsSheet = XLSX.utils.json_to_sheet(knowledgePointsData);

  // Create Workbook and Add Sheets
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wordsSheet, '单词');
  XLSX.utils.book_append_sheet(workbook, knowledgePointsSheet, '知识点');

  // Trigger Download
  XLSX.writeFile(workbook, filename);
};


export const exportDataToExcel = (
  words: WordItem[],
  knowledgePoints: KnowledgePointItem[],
  syllabusItems: SyllabusItem[]
): void => {
  const today = new Date();
  const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const filename = `LinguaLeap_学习数据_${dateString}.xlsx`;
  createWorkbookAndDownload(words, knowledgePoints, syllabusItems, filename);
};
