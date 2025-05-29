import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
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
};

const KP_HEADERS = {
  TITLE: '标题',
  CONTENT: '内容',
  CATEGORY: '分类',
  NOTES: '备注',
};


export const importDataFromExcel = async (
  file: File,
  existingSyllabusItems: SyllabusItem[],
  generateId: () => string // Allow generateId to be passed in for testing or specific ID generation strategies
): Promise<ImportResult> => {
  const importedWords: WordItem[] = [];
  const importedKnowledgePoints: KnowledgePointItem[] = [];
  let wordsAdded = 0;
  let kpsAdded = 0;
  let wordsSkipped = 0;
  let kpsSkipped = 0;

  const newItemsGeneratedThisImportSession: SyllabusItem[] = [];
  // currentSyllabusStateForLookup starts as a copy and grows with items created in this session.
  const currentSyllabusStateForLookup = [...existingSyllabusItems];


  const ensureSyllabusPath = (pathString: string | undefined): string | null => {
    if (!pathString || pathString.trim().toLowerCase() === '未分类' || pathString.trim() === '') {
      return null;
    }

    const pathParts = pathString.split(SYLLABUS_PATH_SEPARATOR).map(part => part.trim()).filter(part => part.length > 0);
    let currentParentId: string | null = null; // Root items have null parentId
    let lastProcessedItemId: string | null = null;

    for (const partTitle of pathParts) {
      let foundItem = currentSyllabusStateForLookup.find(
        item => item.title.toLowerCase() === partTitle.toLowerCase() && 
                item.parentId === currentParentId && 
                item.id !== SYLLABUS_ROOT_ID // Don't match the conceptual root "所有主题" by title path
      );

      if (!foundItem) {
        const newId = generateId();
        const newItem: SyllabusItem = {
          id: newId,
          title: partTitle,
          parentId: currentParentId,
        };
        
        currentSyllabusStateForLookup.push(newItem);

        const isTrulyNew = !existingSyllabusItems.some(eItem => eItem.id === newItem.id); // Check against original list
        const notYetAccumulated = !newItemsGeneratedThisImportSession.some(nItem => nItem.id === newItem.id);

        if (isTrulyNew && notYetAccumulated) {
             newItemsGeneratedThisImportSession.push(newItem);
        } else if (!isTrulyNew && notYetAccumulated && existingSyllabusItems.some(eItem => eItem.id === newItem.id)) {
            // This case means an ID collision happened, and an existing item was "re-created" by generateId.
            // This should be extremely rare if generateId is robust.
            // Or, it means the item was already created earlier in this same import session and pushed to currentSyllabusStateForLookup,
            // but its ID was also present in `existingSyllabusItems`. This needs careful thought.
            // The primary goal is: `newItemsGeneratedThisImportSession` must only contain items that were NOT in `existingSyllabusItems` at the start.
            // The current logic: `isTrulyNew` handles this.
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

        // Process Words Sheet
        const wordsSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === '单词');
        if (wordsSheetName) {
          const worksheet = workbook.Sheets[wordsSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          jsonData.forEach((row, index) => {
            const text = row[WORD_HEADERS.TEXT]?.toString().trim();
            const definition = row[WORD_HEADERS.DEFINITION]?.toString().trim();
            const partOfSpeech = row[WORD_HEADERS.PART_OF_SPEECH]?.toString().trim();
            // Allow example to be optional for words
            const exampleSentence = row[WORD_HEADERS.EXAMPLE]?.toString().trim() || ''; 

            if (text && definition && partOfSpeech) { // Example is not strictly required here
              const newWord: WordItem = {
                id: generateId(),
                type: 'word',
                text,
                definition,
                partOfSpeech,
                exampleSentence,
                notes: row[WORD_HEADERS.NOTES]?.toString().trim() || undefined,
                createdAt: new Date().toISOString(),
                lastReviewedAt: null,
                nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                srsStage: 0,
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
              const syllabusItemId = ensureSyllabusPath(categoryPath);

              const newKp: KnowledgePointItem = {
                id: generateId(),
                type: 'knowledge',
                title,
                content,
                syllabusItemId,
                notes: row[KP_HEADERS.NOTES]?.toString().trim() || undefined,
                createdAt: new Date().toISOString(),
                lastReviewedAt: null,
                nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                srsStage: 0,
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
        if(wordsSheetName) message += `单词: ${wordsAdded} 添加, ${wordsSkipped} 跳过。\n`;
        if(kpsSheetName) message += `知识点: ${kpsAdded} 添加, ${kpsSkipped} 跳过.`;
        if(newItemsGeneratedThisImportSession.length > 0) message += `\n新创建了 ${newItemsGeneratedThisImportSession.length} 个大纲分类。`;
        if(!wordsSheetName && !kpsSheetName) message = "未找到 '单词' 或 '知识点' 工作表。未导入任何数据。";
        
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