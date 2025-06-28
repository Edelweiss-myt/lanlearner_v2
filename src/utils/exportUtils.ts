import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
import { formatDate } from './dateUtils';
import { SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../constants';

interface NewKnowledgeSubjectData {
  sheetName: string;
  kps: KnowledgePointItem[];
}

const formatNullableDate = (dateString: string | null): string => {
  return dateString ? formatDate(new Date(dateString)) : 'N/A';
};

const getSyllabusPath = (
  syllabusItemId: string | null,
  allSyllabusItems: SyllabusItem[],
  rootIdToStopAt: string
): string => {
  if (!syllabusItemId) {
    return '未分类';
  }
  const pathParts: string[] = [];
  let currentId: string | null = syllabusItemId;
  
  while (currentId) {
    const item = allSyllabusItems.find(s => s.id === currentId);
    if (!item || item.id === rootIdToStopAt || !item.parentId) {
      break;
    }
    pathParts.unshift(item.title);
    currentId = item.parentId; 
  }

  return pathParts.length > 0 ? pathParts.join(SYLLABUS_PATH_SEPARATOR) : '未分类';
};

export const exportDataToExcel = (
  words: WordItem[],
  mainKnowledgePoints: KnowledgePointItem[],
  mainSyllabusItems: SyllabusItem[],
  allNewKnowledgeSyllabusItems: SyllabusItem[],
  newKnowledgeSubjectsData: NewKnowledgeSubjectData[]
): void => {
  const workbook = XLSX.utils.book_new();

  // 1. Export Words
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

  // 2. Export Main Knowledge Points
  if (mainKnowledgePoints.length > 0) {
    const mainKpData = mainKnowledgePoints.map(kp => ({
      '标题': kp.title,
      '内容': kp.content,
      '图片': kp.imageUrl || '',
      '图片名': kp.imageName || '',
      '分类': getSyllabusPath(kp.syllabusItemId, mainSyllabusItems, SYLLABUS_ROOT_ID),
      '备注': kp.notes || '',
      '创建日期': formatNullableDate(kp.createdAt),
      '上次复习': formatNullableDate(kp.lastReviewedAt),
      '下次复习': formatNullableDate(kp.nextReviewAt),
      '复习阶段': kp.srsStage,
    }));
    const mainKnowledgePointsSheet = XLSX.utils.json_to_sheet(mainKpData);
    XLSX.utils.book_append_sheet(workbook, mainKnowledgePointsSheet, '知识点 (主大纲)');
  }
  
  // 3. Export New Knowledge Subjects into separate sheets
  newKnowledgeSubjectsData.forEach(subjectData => {
    if (subjectData.kps.length > 0) {
        const subjectKpData = subjectData.kps.map(kp => ({
          '标题': kp.title,
          '内容': kp.content,
          '图片': kp.imageUrl || '',
          '图片名': kp.imageName || '',
          '分类': getSyllabusPath(kp.syllabusItemId, allNewKnowledgeSyllabusItems, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID),
          '备注': kp.notes || '',
          '创建日期': formatNullableDate(kp.createdAt),
          '上次复习': formatNullableDate(kp.lastReviewedAt),
          '下次复习': formatNullableDate(kp.nextReviewAt),
          '复习阶段': kp.srsStage,
        }));
        const newKnowledgeKpSheet = XLSX.utils.json_to_sheet(subjectKpData);
        XLSX.utils.book_append_sheet(workbook, newKnowledgeKpSheet, subjectData.sheetName);
    }
  });

  // 4. Export the metadata sheet for the entire new knowledge syllabus structure
  if (allNewKnowledgeSyllabusItems.length > 0) {
    const syllabusExportData = allNewKnowledgeSyllabusItems
      .filter(item => item.id !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID)
      .map(item => ({
        '分类': getSyllabusPath(item.id, allNewKnowledgeSyllabusItems, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) || '顶级',
        '是否已学完': item.isLearned ? '是' : '否',
      }));
    
    if (syllabusExportData.length > 0) {
      const syllabusSheet = XLSX.utils.json_to_sheet(syllabusExportData);
      XLSX.utils.book_append_sheet(workbook, syllabusSheet, '新知识大纲');
    }
  }

  const today = new Date();
  const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const filename = `Lanlearner_学习数据_${dateString}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
