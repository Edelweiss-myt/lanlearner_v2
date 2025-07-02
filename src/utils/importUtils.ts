import * as XLSX from 'xlsx';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../types';
import { addDays, getTodayDateString } from './dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_PATH_SEPARATOR, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, MAX_SRS_STAGE } from '../constants';

export interface ImportResult {
  importedWords: WordItem[];
  importedMainKnowledgePoints: KnowledgePointItem[];
  importedNewKnowledgePoints: KnowledgePointItem[];
  newlyCreatedMainSyllabusItems: SyllabusItem[];
  newlyCreatedNewKnowledgeSyllabusItems: SyllabusItem[];
  updatedMainSyllabus: SyllabusItem[];
  updatedNewKnowledgeSyllabus: SyllabusItem[];
  message: string;
}

const WORD_HEADERS = { TEXT: '单词', DEFINITION: '释义', PART_OF_SPEECH: '词性', EXAMPLE: '例句', NOTES: '备注', CREATED_AT: '创建日期', LAST_REVIEWED_AT: '上次复习', NEXT_REVIEW_AT: '下次复习', SRS_STAGE: '复习阶段' };
const KP_HEADERS = { TITLE: '标题', CONTENT: '内容', IMAGE_URL: '图片', IMAGE_NAME: '图片名', CATEGORY: '分类', NOTES: '备注', CREATED_AT: '创建日期', LAST_REVIEWED_AT: '上次复习', NEXT_REVIEW_AT: '下次复习', SRS_STAGE: '复习阶段', IS_LEARNED: '是否已学' };

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
  let stats = { wordsAdded: 0, kpsAdded: 0, wordsSkipped: 0, kpsSkipped: 0, wordsDup: 0, kpsDup: 0, newCatsMain: 0, newCatsNew: 0, wordsUpdated: 0, kpsUpdated: 0 };

  const mainSyllabusLookup = [...existingSyllabusItems];
  const newKnowledgeSyllabusLookup = [...existingNewKnowledgeSyllabus];

  const currentWords = new Map<string, WordItem>(existingWords.map(w => [w.text.toLowerCase(), w]));
  const currentMainKnowledgePoints = new Map<string, KnowledgePointItem>(existingKnowledgePoints.map(kp => [kp.title.toLowerCase(), kp]));
  const currentNewKnowledgePoints = new Map<string, KnowledgePointItem>(existingNewKnowledgePoints.map(kp => [kp.title.toLowerCase(), kp]));

  const ensureSyllabusPath = (pathString: string | undefined, isNewKnowledge: boolean): string | null => {
    const syllabusLookup = isNewKnowledge ? newKnowledgeSyllabusLookup : mainSyllabusLookup;
    const rootId = isNewKnowledge ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID;
    const newItemsArray = isNewKnowledge ? newlyCreatedNewKnowledgeSyllabusItems : newlyCreatedMainSyllabusItems;

    if (!pathString || pathString.trim().toLowerCase() === '未分类' || pathString.trim() === '') return rootId;
    
    const pathParts = pathString.split(SYLLABUS_PATH_SEPARATOR).map((part: string) => part.trim()).filter(Boolean);
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
    const kpMap = isNewKnowledge ? currentNewKnowledgePoints : currentMainKnowledgePoints;
    const newKpList = isNewKnowledge ? importedNewKnowledgePoints : importedMainKnowledgePoints;
    
    jsonData.forEach(row => {
      const title = row[KP_HEADERS.TITLE]?.toString().trim();
      if (!title || !row[KP_HEADERS.CONTENT]) { stats.kpsSkipped++; return; }
      
      const existingKp = kpMap.get(title.toLowerCase());
      
      const syllabusItemId = ensureSyllabusPath(row[KP_HEADERS.CATEGORY]?.toString().trim(), isNewKnowledge);
      const createdAt = parseDate(row[KP_HEADERS.CREATED_AT]);
      const lastReviewed = parseDate(row[KP_HEADERS.LAST_REVIEWED_AT]);
      const nextReview = parseDate(row[KP_HEADERS.NEXT_REVIEW_AT]);
      const srsStage = parseInt(row[KP_HEADERS.SRS_STAGE], 10);
      
      const kpData = {
        title,
        content: row[KP_HEADERS.CONTENT].toString().trim(),
        syllabusItemId,
        notes: row[KP_HEADERS.NOTES]?.toString().trim() || undefined,
        imageUrl: row[KP_HEADERS.IMAGE_URL]?.toString().trim() || undefined,
        imageName: row[KP_HEADERS.IMAGE_NAME]?.toString().trim() || undefined,
        createdAt: createdAt || new Date().toISOString(),
        lastReviewedAt: lastReviewed,
        nextReviewAt: nextReview || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
        srsStage: !isNaN(srsStage) ? srsStage : 0,
      };

      if (existingKp) {
        const updatedKp: KnowledgePointItem = {
            ...existingKp,
            title: kpData.title,
            content: kpData.content,
            syllabusItemId: kpData.syllabusItemId,
            notes: kpData.notes,
            imageUrl: kpData.imageUrl,
            imageName: kpData.imageName,
            subjectId: isNewKnowledge ? (
                (kpData.syllabusItemId && kpData.syllabusItemId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) 
                    ? (() => {
                        let current: SyllabusItem | undefined = newKnowledgeSyllabusLookup.find(s => s.id === kpData.syllabusItemId);
                        while (current && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
                  current = newKnowledgeSyllabusLookup.find(s => s.id === current!.parentId);
              }
                        return current?.id;
                    })()
                    : existingKp.subjectId
                ) : existingKp.subjectId,
        };
        kpMap.set(title.toLowerCase(), updatedKp);
        stats.kpsUpdated++;
      } else {
        const newKp: KnowledgePointItem = {
          id: generateId(), 
          type: 'knowledge',
          ...kpData,
          masterId: generateId(),
          subjectId: isNewKnowledge ? (
                (kpData.syllabusItemId && kpData.syllabusItemId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) 
                    ? (() => {
                        let current: SyllabusItem | undefined = newKnowledgeSyllabusLookup.find(s => s.id === kpData.syllabusItemId);
                        while (current && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
                            current = newKnowledgeSyllabusLookup.find(s => s.id === current!.parentId);
          }
                        return current?.id;
                    })()
                    : undefined
                ) : undefined,
          srsStage: (row[KP_HEADERS.IS_LEARNED]?.toString().trim().toLowerCase() === '是') ? MAX_SRS_STAGE : (!isNaN(srsStage) ? srsStage : 0),
        };
        kpMap.set(title.toLowerCase(), newKp);
        newKpList.push(newKp);
      stats.kpsAdded++;
      }
    });
  };

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("无法读取文件内容。");
        
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Temporary storage for parsed data from different sheets
        let wordsJsonData: any[] = [];
        let mainKnowledgePointsJsonData: any[] = [];
        let newKnowledgePointsJsonData: any[] = [];
        let newKnowledgeSyllabusJsonData: any[] = [];
        
        workbook.SheetNames.forEach(sheetName => {
            const trimmedSheetName = sheetName.trim();
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) return; // Skip if worksheet is null/undefined

            if (trimmedSheetName.toLowerCase() === '单词') {
                wordsJsonData = XLSX.utils.sheet_to_json<any>(worksheet);
            } else if (trimmedSheetName.includes('知识点 (主大纲)') ) {
                mainKnowledgePointsJsonData = XLSX.utils.sheet_to_json<any>(worksheet);
            } else if (trimmedSheetName.toLowerCase() === '新知识大纲') {
                newKnowledgeSyllabusJsonData = XLSX.utils.sheet_to_json<any>(worksheet);
            } else { // All other sheets are considered new knowledge points categories
                newKnowledgePointsJsonData = newKnowledgePointsJsonData.concat(XLSX.utils.sheet_to_json<any>(worksheet));
            }
        });

        // Step 1: Process '单词' sheet
        wordsJsonData.forEach((row) => {
                    const text = row[WORD_HEADERS.TEXT]?.toString().trim();
                    if (!text || !row[WORD_HEADERS.DEFINITION] || !row[WORD_HEADERS.PART_OF_SPEECH]) { stats.wordsSkipped++; return; }
            
            const existingWord = currentWords.get(text.toLowerCase());

                    const createdAt = parseDate(row[WORD_HEADERS.CREATED_AT]);
                    const lastReviewed = parseDate(row[WORD_HEADERS.LAST_REVIEWED_AT]);
                    const nextReview = parseDate(row[WORD_HEADERS.NEXT_REVIEW_AT]);
                    const srsStage = parseInt(row[WORD_HEADERS.SRS_STAGE], 10);
            
            const wordData = {
                text,
                        definition: row[WORD_HEADERS.DEFINITION].toString().trim(),
                        partOfSpeech: row[WORD_HEADERS.PART_OF_SPEECH].toString().trim(),
                        exampleSentence: row[WORD_HEADERS.EXAMPLE]?.toString().trim() || '',
                        notes: row[WORD_HEADERS.NOTES]?.toString().trim() || undefined,
                        createdAt: createdAt || new Date().toISOString(),
                        lastReviewedAt: lastReviewed,
                        nextReviewAt: nextReview || addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
                        srsStage: !isNaN(srsStage) ? srsStage : 0,
            };

            if (existingWord) {
                // Update existing word - only update content fields, preserve SRS and ID
                const updatedWord: WordItem = {
                    ...existingWord, // Keep existing ID, type, SRS state, creation date
                    text: wordData.text,
                    definition: wordData.definition,
                    partOfSpeech: wordData.partOfSpeech,
                    exampleSentence: wordData.exampleSentence,
                    notes: wordData.notes,
                };
                currentWords.set(text.toLowerCase(), updatedWord);
                stats.wordsUpdated++;
            } else {
                // Add new word
                const newWord: WordItem = {
                    id: generateId(), 
                    type: 'word',
                    ...wordData,
                };
                currentWords.set(text.toLowerCase(), newWord);
                importedWords.push(newWord);
                    stats.wordsAdded++;
            }
        });

        // Step 2: Process '知识点 (主大纲)' sheet
        processKps(mainKnowledgePointsJsonData, false);

        // Step 3: Process "新知识大纲" sheet to build consolidated syllabus structure
        // This will be the primary source for the order of new knowledge syllabus items
        let orderedNewKnowledgeSyllabus: SyllabusItem[] = [{ id: NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, title: '新知识体系根目录', parentId: null }];
        const newKnowledgeSyllabusMap = new Map<string, SyllabusItem>(); // Map for quick lookup and updates by path for syllabus
        newKnowledgeSyllabusMap.set(NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, orderedNewKnowledgeSyllabus[0]);
        
        // Add existing new knowledge syllabus items to the map for merging purposes
        // Identify existing categories by title+parentId for matching across import/app data, but update by ID.
        existingNewKnowledgeSyllabus.forEach(item => {
            const key = `${item.title.toLowerCase()}-${item.parentId || 'null'}`;
            if (!newKnowledgeSyllabusMap.has(item.id)) { // Prefer checking by ID first if available
                newKnowledgeSyllabusMap.set(item.id, item); // Add by ID
            }
        });

        newKnowledgeSyllabusJsonData.forEach(row => {
                const categoryPath = row[SYLLABUS_HEADERS.CATEGORY]?.toString().trim();
            const isLearnedInExcel = row[SYLLABUS_HEADERS.IS_LEARNED]?.toString().trim().toLowerCase() === '是';

                if (categoryPath && categoryPath.toLowerCase() !== '顶级') {
                const pathParts = categoryPath.split(SYLLABUS_PATH_SEPARATOR).map((part: string) => part.trim()).filter(Boolean);
                let currentParentId: string | null = NEW_KNOWLEDGE_SYLLABUS_ROOT_ID;
                
                for (let i = 0; i < pathParts.length; i++) {
                    const partTitle = pathParts[i];
                    let foundItem: SyllabusItem | undefined;
                    
                    // Try to find an existing item by title and parentId in the consolidated map
                    for (const item of newKnowledgeSyllabusMap.values()) {
                        if (item.title.toLowerCase() === partTitle.toLowerCase() && item.parentId === currentParentId) {
                            foundItem = item;
                            break;
                        }
                    }
                    
                    if (foundItem) {
                        // If found, update its isLearned status if either source says true
                        foundItem.isLearned = foundItem.isLearned || isLearnedInExcel;
                    } else {
                        // If not found, create a new one
                        const newId = generateId();
                        foundItem = { id: newId, title: partTitle, parentId: currentParentId, isLearned: false };
                        newKnowledgeSyllabusMap.set(newId, foundItem);
                        newlyCreatedNewKnowledgeSyllabusItems.push(foundItem);
                        stats.newCatsNew++;
                    }
                    currentParentId = foundItem.id;

                    // Apply isLearned to the deepest category only from the Excel sheet when processing that specific row
                    if (i === pathParts.length - 1) {
                        foundItem.isLearned = foundItem.isLearned || isLearnedInExcel; // Ensure isLearned is true if either is true
                    }
                }
            }
        });
        
        // Rebuild newKnowledgeSyllabusLookup from the consolidated map to maintain order and uniqueness
        newKnowledgeSyllabusLookup.length = 0; // Clear existing content
        
        // First, add the root if it's not already there
        if (!newKnowledgeSyllabusMap.has(NEW_KNOWLEDGE_SYLLABUS_ROOT_ID)) {
            const rootItem = { id: NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, title: '新知识体系根目录', parentId: null };
            newKnowledgeSyllabusLookup.push(rootItem);
            newKnowledgeSyllabusMap.set(NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, rootItem); // Add to map for consistency
        } else {
            newKnowledgeSyllabusLookup.push(newKnowledgeSyllabusMap.get(NEW_KNOWLEDGE_SYLLABUS_ROOT_ID)!); // Add existing root
        }

        // Add existing syllabus items, maintaining their original order, if they are still in the map
        existingNewKnowledgeSyllabus.forEach(item => {
            if (item.id !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID && newKnowledgeSyllabusMap.has(item.id)) {
                newKnowledgeSyllabusLookup.push(newKnowledgeSyllabusMap.get(item.id)!);
                newKnowledgeSyllabusMap.delete(item.id); // Remove from map so only truly new ones remain
            }
        });

        // Add any remaining (newly created from excel) items from the map
        Array.from(newKnowledgeSyllabusMap.values())
            .filter(item => item.id !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) // Exclude root, already handled
            .forEach(item => {
                newKnowledgeSyllabusLookup.push(item);
            });

        // Step 4: Process other new knowledge points sheets
        processKps(newKnowledgePointsJsonData, true);
        
        let message = `导入完成。\n` +
          `单词: ${stats.wordsAdded} 添加, ${stats.wordsUpdated} 更新, ${stats.wordsSkipped} 跳过 (字段缺失).\n` +
          `知识点: ${stats.kpsAdded} 添加, ${stats.kpsUpdated} 更新, ${stats.kpsSkipped} 跳过 (字段缺失).\n` +
          (stats.newCatsMain > 0 ? `主大纲中新建分类 ${stats.newCatsMain} 个.\n` : '') +
          (stats.newCatsNew > 0 ? `新知识体系中新建分类 ${stats.newCatsNew} 个.` : '');

        resolve({
          importedWords: Array.from(currentWords.values()),
          importedMainKnowledgePoints: Array.from(currentMainKnowledgePoints.values()),
          importedNewKnowledgePoints: Array.from(currentNewKnowledgePoints.values()),
          newlyCreatedMainSyllabusItems,
          newlyCreatedNewKnowledgeSyllabusItems,
          updatedMainSyllabus: Array.from(mainSyllabusLookup),
          updatedNewKnowledgeSyllabus: Array.from(newKnowledgeSyllabusLookup),
          message
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("处理 Excel 文件时出错。"));
      }
    };
    reader.onerror = () => reject(new Error("读取文件失败。"));
    reader.readAsArrayBuffer(file);
  });
};
