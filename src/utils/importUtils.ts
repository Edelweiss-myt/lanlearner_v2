import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
// import { generateId as defaultGenerateId } from './miscUtils'; // REMOVED - Unused
import { addDays, getTodayDateString } from './dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID } from '../constants';

interface ImportResult {
  importedWords: WordItem[];
  importedKnowledgePoints: KnowledgePointItem[];
  newlyCreatedSyllabusItems: SyllabusItem[];
  message: string;
}

// Expected column headers (Chinese)
const WORD_HEADERS = {
  TEXT: '单词',
  DEFINITION: '释义',
  PART_OF_SPEECH: '词性',
  EXAMPLE: '例句',
  NOTES: '备注',
  CREATED_AT: '创建日期',
  LAST_REVIEWED_AT: '上次复习',
  NEXT_REVIEW_AT: '下次复习',
  SRS_STAGE: '复习阶段',
};

const KP_HEADERS = {
  TITLE: '标题',
  CONTENT: '内容',
  CATEGORY: '分类',
  NOTES: '备注',
  CREATED_AT: '创建日期',
  LAST_REVIEWED_AT: '上次复习',
  NEXT_REVIEW_AT: '下次复习',
  SRS_STAGE: '复习阶段',
};

const SYLLABUS_HEADERS = {
  NAME: '分类名称',
  PARENT_PATH: '父级分类路径',
  IS_LEARNED: '是否已学完',
};

/**
 * Parses a date from various potential Excel formats.
 * Excel can return dates as numbers (days since 1900) or strings.
 * It also handles the 'N/A' case for null dates.
 * @param excelDate The value from the Excel cell.
 * @returns An ISO string representation of the date, or null.
 */
const parseDate = (excelDate: any): string | null => {
    if (excelDate === null || excelDate === undefined || typeof excelDate === 'string' && excelDate.toUpperCase() === 'N/A') {
        return null;
    }
    // Handle Excel's numeric date format
    if (typeof excelDate === 'number') {
        // XLSX.SSF.parse_date_code is the recommended way to handle this.
        const d = XLSX.SSF.parse_date_code(excelDate);
        if (d) {
            return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString();
        }
    }
    // Handle string dates (e.g., '2023-08-15' or ISO string)
    if (typeof excelDate === 'string') {
        const date = new Date(excelDate);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
    }
    // Return null if parsing fails
    return null;
};


export const importDataFromExcel = async (
  file: File,
  existingSyllabusItems: SyllabusItem[],
  generateId: () => string, // Allow generateId to be passed in for testing or specific ID generation strategies
  existingWords: WordItem[],
  existingKnowledgePoints: KnowledgePointItem[]
): Promise<ImportResult> => {
  const importedWords: WordItem[] = [];
  const importedKnowledgePoints: KnowledgePointItem[] = [];
  let wordsAdded = 0;
  let kpsAdded = 0;
  let wordsSkipped = 0;
  let kpsSkipped = 0;
  let wordsSkippedDuplicates = 0;
  let kpsSkippedDuplicates = 0;


  const newItemsGeneratedThisImportSession: SyllabusItem[] = [];
  const currentSyllabusStateForLookup = [...existingSyllabusItems];
  const learnedStatusMap = new Map<string, boolean>();


  const ensureSyllabusPath = (pathString: string | undefined): string | null => {
    if (!pathString || pathString.trim().toLowerCase() === '未分类' || pathString.trim() === '') {
      return null;
    }

    const pathParts = pathString.split(SYLLABUS_PATH_SEPARATOR).map(part => part.trim()).filter(part => part.length > 0);
    let currentParentId: string | null = null;
    let lastProcessedItemId: string | null = null;
    let currentPath = '';

    for (const partTitle of pathParts) {
      currentPath = currentPath ? `${currentPath}${SYLLABUS_PATH_SEPARATOR}${partTitle}` : partTitle;
      let foundItem = currentSyllabusStateForLookup.find(
        item => item.title.toLowerCase() === partTitle.toLowerCase() &&
                item.parentId === currentParentId &&
                item.id !== SYLLABUS_ROOT_ID
      );

      if (!foundItem) {
        const newId = generateId();
        const newItem: SyllabusItem = {
          id: newId,
          title: partTitle,
          parentId: currentParentId,
          isLearned: learnedStatusMap.get(currentPath.toLowerCase()) || false,
        };
        
        currentSyllabusStateForLookup.push(newItem);

        const isTrulyNew = !existingSyllabusItems.some(eItem => eItem.id === newItem.id);
        const notYetAccumulated = !newItemsGeneratedThisImportSession.some(nItem => nItem.id === newItem.id);

        if (isTrulyNew && notYetAccumulated) {
             newItemsGeneratedThisImportSession.push(newItem);
        }
        
        lastProcessedItemId = newId;
        currentParentId = newId;
      } else {
        lastProcessedItemId = foundItem.id;
        currentParentId = foundItem.id;
      }
    }
    return lastProcessedItemId;
  };


  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("无法读取文件内容。");
        }
        const workbook = XLSX.read(data, { type: 'array' });

        // Process "New Knowledge Syllabus" sheet first to populate the learnedStatusMap
        const syllabusSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === '新知识大纲');
        if (syllabusSheetName) {
            const worksheet = workbook.Sheets[syllabusSheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

            jsonData.forEach(row => {
                const name = row[SYLLABUS_HEADERS.NAME]?.toString().trim();
                const parentPath = row[SYLLABUS_HEADERS.PARENT_PATH]?.toString().trim();
                const isLearned = row[SYLLABUS_HEADERS.IS_LEARNED]?.toString().trim().toLowerCase() === '是';
                
                if (name && parentPath) {
                    const fullPath = (parentPath.toLowerCase() === '顶级' ? name : `${parentPath}${SYLLABUS_PATH_SEPARATOR}${name}`).toLowerCase();
                    learnedStatusMap.set(fullPath, isLearned);
                }
            });
        }

        // Process Words Sheet
        const wordsSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === '单词');
        if (wordsSheetName) {
          const worksheet = workbook.Sheets[wordsSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          jsonData.forEach((row, index) => {
            const text = row[WORD_HEADERS.TEXT]?.toString().trim();
            const definition = row[WORD_HEADERS.DEFINITION]?.toString().trim();
            const partOfSpeech = row[WORD_HEADERS.PART_OF_SPEECH]?.toString().trim();
            const exampleSentence = row[WORD_HEADERS.EXAMPLE]?.toString().trim() || '';

            if (text && definition && partOfSpeech) {
              // Check for duplicates based on word text (case-insensitive)
              const isDuplicate = existingWords.some(w => w.text.toLowerCase() === text.toLowerCase());
              if (isDuplicate) {
                wordsSkippedDuplicates++;
                return; // Skip this duplicate word
              }

              const createdAtFromCell = parseDate(row[WORD_HEADERS.CREATED_AT]);
              const lastReviewedAtFromCell = parseDate(row[WORD_HEADERS.LAST_REVIEWED_AT]);
              const nextReviewAtFromCell = parseDate(row[WORD_HEADERS.NEXT_REVIEW_AT]);
              const srsStageFromCell = parseInt(row[WORD_HEADERS.SRS_STAGE], 10);

              const newWord: WordItem = {
                id: generateId(),
                type: 'word',
                text,
                definition,
                partOfSpeech,
                exampleSentence,
                notes: row[WORD_HEADERS.NOTES]?.toString().trim() || undefined,
                createdAt: createdAtFromCell || new Date().toISOString(),
                lastReviewedAt: lastReviewedAtFromCell,
                nextReviewAt: nextReviewAtFromCell || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                srsStage: !isNaN(srsStageFromCell) ? srsStageFromCell : 0,
              };
              importedWords.push(newWord);
              wordsAdded++;
            } else {
              console.warn(`Skipping word at row ${index + 2} due to missing required fields (单词, 释义, 词性).`);
              wordsSkipped++;
            }
          });
        } else {
            console.warn("未找到 '单词' 工作表。");
        }

        // Process Knowledge Points Sheet
        const kpsSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === '知识点');
        if (kpsSheetName) {
          const worksheet = workbook.Sheets[kpsSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          jsonData.forEach((row, index) => {
            const title = row[KP_HEADERS.TITLE]?.toString().trim();
            const content = row[KP_HEADERS.CONTENT]?.toString().trim();
            const categoryPath = row[KP_HEADERS.CATEGORY]?.toString().trim();

            if (title && content) {
              // Check for duplicates based on KP title (case-insensitive)
              const isDuplicate = existingKnowledgePoints.some(kp => kp.title.toLowerCase() === title.toLowerCase());
              if (isDuplicate) {
                kpsSkippedDuplicates++;
                return; // Skip this duplicate KP
              }

              const syllabusItemId = ensureSyllabusPath(categoryPath);
              
              const createdAtFromCell = parseDate(row[KP_HEADERS.CREATED_AT]);
              const lastReviewedAtFromCell = parseDate(row[KP_HEADERS.LAST_REVIEWED_AT]);
              const nextReviewAtFromCell = parseDate(row[KP_HEADERS.NEXT_REVIEW_AT]);
              const srsStageFromCell = parseInt(row[KP_HEADERS.SRS_STAGE], 10);

              const newKp: KnowledgePointItem = {
                id: generateId(),
                type: 'knowledge',
                title,
                content,
                syllabusItemId,
                notes: row[KP_HEADERS.NOTES]?.toString().trim() || undefined,
                createdAt: createdAtFromCell || new Date().toISOString(),
                lastReviewedAt: lastReviewedAtFromCell,
                nextReviewAt: nextReviewAtFromCell || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                srsStage: !isNaN(srsStageFromCell) ? srsStageFromCell : 0,
              };
              importedKnowledgePoints.push(newKp);
              kpsAdded++;
            } else {
              console.warn(`Skipping knowledge point at row ${index + 2} due to missing required fields (标题, 内容).`);
              kpsSkipped++;
            }
          });
        } else {
            console.warn("未找到 '知识点' 工作表。");
        }
        
        let message = "导入完成。\n";
        if (wordsSheetName) {
            message += `单词: ${wordsAdded} 添加, ${wordsSkipped} 因字段缺失跳过, ${wordsSkippedDuplicates} 因重复跳过。\n`;
        }
        if (kpsSheetName) {
            message += `知识点: ${kpsAdded} 添加, ${kpsSkipped} 因字段缺失跳过, ${kpsSkippedDuplicates} 因重复跳过。\n`;
        }
        if (newItemsGeneratedThisImportSession.length > 0) {
            message += `新创建了 ${newItemsGeneratedThisImportSession.length} 个大纲分类。`;
        }
        if (!wordsSheetName && !kpsSheetName) {
            message = "未找到 '单词' 或 '知识点' 工作表。未导入任何数据。";
        }
        
        resolve({ importedWords, importedKnowledgePoints, newlyCreatedSyllabusItems: newItemsGeneratedThisImportSession, message });

      } catch (error) {
        console.error("Error processing Excel file:", error);
        reject(error instanceof Error ? error : new Error("处理 Excel 文件时出错。"));
      }
    };

    reader.onerror = (error) => {
      console.error("File reading error:", error);
      reject(new Error("读取文件失败。"));
    };

    reader.readAsArrayBuffer(file);
  });
};
