
import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
import { formatDate } from './dateUtils';
import { SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../constants';

const formatNullableDate = (dateString: string | null): string => {
  return dateString ? formatDate(new Date(dateString)) : 'N/A';
};

const getSyllabusPath = (
  syllabusItemId: string | null,
  syllabusItems: SyllabusItem[],
  isNewKnowledgeContext: boolean = false
): string => {
  if (!syllabusItemId) {
    return '未分类';
  }
  const pathParts: string[] = [];
  let currentId: string | null = syllabusItemId;
  
  const rootIdForContext = isNewKnowledgeContext ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID;

  while (currentId) {
    const item = syllabusItems.find(s => s.id === currentId);
    if (!item || item.id === rootIdForContext) { // Stop if item not found or is the conceptual root
      break;
    }
    pathParts.unshift(item.title);
    currentId = item.parentId; // Move to parent
  }
  return pathParts.length > 0 ? pathParts.join(SYLLABUS_PATH_SEPARATOR) : '未分类';
};


const createWorkbookAndDownload = (
  words: WordItem[],
  mainKnowledgePoints: KnowledgePointItem[],
  mainSyllabusItems: SyllabusItem[],
  primaryNewKnowledgeKPs: KnowledgePointItem[],
  newKnowledgeSyllabusItems: SyllabusItem[],
  primaryNewKnowledgeSubjectCategoryName: string | null,
  filename: string
): void => {
  const workbook = XLSX.utils.book_new();

  if (words.length > 0) {
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
    XLSX.utils.book_append_sheet(workbook, wordsSheet, '单词');
  }

  if (mainKnowledgePoints.length > 0) {
    const mainKpData = mainKnowledgePoints.map(kp => ({
      '标题': kp.title,
      '内容': kp.content,
      '分类': getSyllabusPath(kp.syllabusItemId, mainSyllabusItems, false),
      '备注': kp.notes || '',
      '创建日期': formatNullableDate(kp.createdAt),
      '上次复习': formatNullableDate(kp.lastReviewedAt),
      '下次复习': formatNullableDate(kp.nextReviewAt),
      '复习阶段': kp.srsStage,
    }));
    const mainKnowledgePointsSheet = XLSX.utils.json_to_sheet(mainKpData);
    XLSX.utils.book_append_sheet(workbook, mainKnowledgePointsSheet, '知识点 (主大纲)');
  }
  
  if (primaryNewKnowledgeSubjectCategoryName && primaryNewKnowledgeKPs.length > 0) {
    const newKnowledgeKpData = primaryNewKnowledgeKPs.map(kp => ({
      '标题': kp.title,
      '内容': kp.content,
      '分类': getSyllabusPath(kp.syllabusItemId, newKnowledgeSyllabusItems, true),
      '备注': kp.notes || '',
      '创建日期': formatNullableDate(kp.createdAt),
      '上次复习': formatNullableDate(kp.lastReviewedAt),
      '下次复习': formatNullableDate(kp.nextReviewAt),
      '复习阶段': kp.srsStage,
    }));
    const newKnowledgeSheetName = `主学 - ${primaryNewKnowledgeSubjectCategoryName}`;
    const newKnowledgeKpSheet = XLSX.utils.json_to_sheet(newKnowledgeKpData);
    XLSX.utils.book_append_sheet(workbook, newKnowledgeKpSheet, newKnowledgeSheetName);
  }

  XLSX.writeFile(workbook, filename);
};


export const exportDataToExcel = (
  words: WordItem[],
  mainKnowledgePoints: KnowledgePointItem[],
  mainSyllabusItems: SyllabusItem[],
  primaryNewKnowledgeKPs: KnowledgePointItem[],
  newKnowledgeSyllabusItems: SyllabusItem[],
  primaryNewKnowledgeSubjectCategoryName: string | null
): void => {
  const today = new Date();
  const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const filename = `Lanlearner_学习数据_${dateString}.xlsx`;
  createWorkbookAndDownload(
    words,
    mainKnowledgePoints,
    mainSyllabusItems,
    primaryNewKnowledgeKPs,
    newKnowledgeSyllabusItems,
    primaryNewKnowledgeSubjectCategoryName,
    filename
  );
};
