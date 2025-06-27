import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
import { addDays, getTodayDateString } from './dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../constants';

export interface ImportResult {
  importedWords: WordItem[];
  importedMainKnowledgePoints: KnowledgePointItem[];
  importedNewKnowledgePoints: KnowledgePointItem[];
  newlyCreatedMainSyllabusItems: SyllabusItem[];
  newlyCreatedNewKnowledgeSyllabusItems: SyllabusItem[];
  message: string;
}

const WORD_HEADERS = { TEXT: '单词', DEFINITION: '释义', PART_OF_SPEECH: '词性', EXAMPLE: '例句', NOTES: '备注', CREATED_AT: '创建日期', LAST_REVIEWED_AT: '上次复习', NEXT_REVIEW_AT: '下次复习', SRS_STAGE: '复习阶段' };
const KP_HEADERS = { TITLE: '标题', CONTENT: '内容', CATEGORY: '分类', NOTES: '备注', CREATED_AT: '创建日期', LAST_REVIEWED_AT: '上次复习', NEXT_REVIEW_AT: '下次复习', SRS_STAGE: '复习阶段' };

const SYLLABUS_HEADERS = {
  CATEGORY: '分类',
  IS_LEARNED: '是否已学完',
};

const parseDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || typeof excelDate === 'string' && excelDate.toUpperCase() === 'N/A') return null;
  if (typeof excelDate === 'number') {
    const d = XLSX.SSF.parse_date_code(excelDate);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString();
  }
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return null;
};

export const importDataFromExcel = async (
  file: File,
  existingSyllabusItems: SyllabusItem[],
  existingKnowledgePoints: KnowledgePointItem[],
  existingNewKnowledgeSyllabus: SyllabusItem[],
  existingNewKnowledgePoints: KnowledgePointItem[],
  generateId: () => string,
  existingWords: WordItem[]
): Promise<ImportResult> => {
  const importedWords: WordItem[] = [];
  const importedMainKnowledgePoints: KnowledgePointItem[] = [];
  const importedNewKnowledgePoints: KnowledgePointItem[] = [];
  const newlyCreatedMainSyllabusItems: SyllabusItem[] = [];
  const newlyCreatedNewKnowledgeSyllabusItems: SyllabusItem[] = [];
  let stats = { wordsAdded: 0, kpsAdded: 0, wordsSkipped: 0, kpsSkipped: 0, wordsDup: 0, kpsDup: 0, newCatsMain: 0, newCatsNew: 0 };

  const mainSyllabusLookup = [...existingSyllabusItems];
  const newKnowledgeSyllabusLookup = [...existingNewKnowledgeSyllabus];

  const ensureSyllabusPath = (pathString: string | undefined, isNewKnowledge: boolean): string | null => {
    const syllabusLookup = isNewKnowledge ? newKnowledgeSyllabusLookup : mainSyllabusLookup;
    const rootId = isNewKnowledge ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID;
    const newItemsArray = isNewKnowledge ? newlyCreatedNewKnowledgeSyllabusItems : newlyCreatedMainSyllabusItems;

    if (!pathString || pathString.trim().toLowerCase() === '未分类' || pathString.trim() === '') return rootId;
    
    const pathParts = pathString.split(SYLLABUS_PATH_SEPARATOR).map(part => part.trim()).filter(Boolean);
    let currentParentId: string | null = rootId;
    
    for (const partTitle of pathParts) {
      let foundItem = syllabusLookup.find(item => item.title.toLowerCase() === partTitle.toLowerCase() && item.parentId === currentParentId);
      if (!foundItem) {
        const newId = generateId();
        foundItem = { id: newId, title: partTitle, parentId: currentParentId };
        syllabusLookup.push(foundItem);
        newItemsArray.push(foundItem);
        if (isNewKnowledge) stats.newCatsNew++; else stats.newCatsMain++;
      }
      currentParentId = foundItem.id;
    }
    return currentParentId;
  };

  const processKps = (jsonData: any[], isNewKnowledge: boolean) => {
    const existingKps = isNewKnowledge ? existingNewKnowledgePoints : existingKnowledgePoints;
    const importedKps = isNewKnowledge ? importedNewKnowledgePoints : importedMainKnowledgePoints;
    
    jsonData.forEach(row => {
      const title = row[KP_HEADERS.TITLE]?.toString().trim();
      if (!title || !row[KP_HEADERS.CONTENT]) { stats.kpsSkipped++; return; }
      if (existingKps.some(kp => kp.title.toLowerCase() === title.toLowerCase()) || importedKps.some(kp => kp.title.toLowerCase() === title.toLowerCase())) {
        stats.kpsDup++; return;
      }
      
      const syllabusItemId = ensureSyllabusPath(row[KP_HEADERS.CATEGORY]?.toString().trim(), isNewKnowledge);
      const createdAt = parseDate(row[KP_HEADERS.CREATED_AT]);
      const lastReviewed = parseDate(row[KP_HEADERS.LAST_REVIEWED_AT]);
      const nextReview = parseDate(row[KP_HEADERS.NEXT_REVIEW_AT]);
      const srsStage = parseInt(row[KP_HEADERS.SRS_STAGE], 10);
      
      const newKp: KnowledgePointItem = {
        id: generateId(), type: 'knowledge', title,
        masterId: '', // Will be set in App.tsx
        content: row[KP_HEADERS.CONTENT].toString().trim(),
        syllabusItemId,
        notes: row[KP_HEADERS.NOTES]?.toString().trim() || undefined,
        subjectId: undefined,
        createdAt: createdAt || new Date().toISOString(),
        lastReviewedAt: lastReviewed,
        nextReviewAt: nextReview || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
        srsStage: !isNaN(srsStage) ? srsStage : 0,
      };

      if(isNewKnowledge) {
          let topLevelParentId = newKp.syllabusItemId;
          if (topLevelParentId && topLevelParentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
              let current = newKnowledgeSyllabusLookup.find(s => s.id === topLevelParentId);
              while(current && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
                  current = newKnowledgeSyllabusLookup.find(s => s.id === current!.parentId);
              }
              newKp.subjectId = current?.id;
          }
      }
      importedKps.push(newKp);
      stats.kpsAdded++;
    });
  };

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("无法读取文件内容。");
        
        const workbook = XLSX.read(data, { type: 'array' });
        
        workbook.SheetNames.forEach(sheetName => {
            const trimmedSheetName = sheetName.trim();
            if (trimmedSheetName.toLowerCase() === '单词') {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
                jsonData.forEach((row) => {
                    const text = row[WORD_HEADERS.TEXT]?.toString().trim();
                    if (!text || !row[WORD_HEADERS.DEFINITION] || !row[WORD_HEADERS.PART_OF_SPEECH]) { stats.wordsSkipped++; return; }
                    if (existingWords.some(w => w.text.toLowerCase() === text.toLowerCase()) || importedWords.some(w=>w.text.toLowerCase() === text.toLowerCase())) {
                        stats.wordsDup++; return;
                    }
                    const createdAt = parseDate(row[WORD_HEADERS.CREATED_AT]);
                    const lastReviewed = parseDate(row[WORD_HEADERS.LAST_REVIEWED_AT]);
                    const nextReview = parseDate(row[WORD_HEADERS.NEXT_REVIEW_AT]);
                    const srsStage = parseInt(row[WORD_HEADERS.SRS_STAGE], 10);
                    importedWords.push({
                        id: generateId(), type: 'word', text,
                        definition: row[WORD_HEADERS.DEFINITION].toString().trim(),
                        partOfSpeech: row[WORD_HEADERS.PART_OF_SPEECH].toString().trim(),
                        exampleSentence: row[WORD_HEADERS.EXAMPLE]?.toString().trim() || '',
                        notes: row[WORD_HEADERS.NOTES]?.toString().trim() || undefined,
                        createdAt: createdAt || new Date().toISOString(),
                        lastReviewedAt: lastReviewed,
                        nextReviewAt: nextReview || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                        srsStage: !isNaN(srsStage) ? srsStage : 0,
                    });
                    stats.wordsAdded++;
                });
            } else if (trimmedSheetName.includes('知识点 (主大纲)') ) {
                const worksheet = workbook.Sheets[sheetName];
                processKps(XLSX.utils.sheet_to_json<any>(worksheet), false);
            } else if (trimmedSheetName.toLowerCase() !== '新知识大纲') {
                const worksheet = workbook.Sheets[sheetName];
                processKps(XLSX.utils.sheet_to_json<any>(worksheet), true);
            }
        });
        
        // Process "新知识大纲" for syllabus structure
        const syllabusSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === '新知识大纲');
        if (syllabusSheetName) {
            const worksheet = workbook.Sheets[syllabusSheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);
            jsonData.forEach(row => {
                const categoryPath = row[SYLLABUS_HEADERS.CATEGORY]?.toString().trim();
                if (categoryPath && categoryPath.toLowerCase() !== '顶级') {
                    ensureSyllabusPath(categoryPath, true);
                }
            });
        }
        
        let message = `导入完成。\n` +
          `单词: ${stats.wordsAdded} 添加, ${stats.wordsSkipped} 跳过 (字段缺失), ${stats.wordsDup} 跳过 (重复).\n` +
          `知识点: ${stats.kpsAdded} 添加, ${stats.kpsSkipped} 跳过 (字段缺失), ${stats.kpsDup} 跳过 (重复).\n` +
          (stats.newCatsMain > 0 ? `主大纲中新建分类 ${stats.newCatsMain} 个.\n` : '') +
          (stats.newCatsNew > 0 ? `新知识体系中新建分类 ${stats.newCatsNew} 个.` : '');

        resolve({ importedWords, importedMainKnowledgePoints, importedNewKnowledgePoints, newlyCreatedMainSyllabusItems, newlyCreatedNewKnowledgeSyllabusItems, message });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("处理 Excel 文件时出错。"));
      }
    };
    reader.onerror = () => reject(new Error("读取文件失败。"));
    reader.readAsArrayBuffer(file);
  });
};
