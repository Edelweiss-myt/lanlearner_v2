import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActiveTab, WordItem, KnowledgePointItem, SyllabusItem, LearningItem, Ebook, RecentlyDeletedItem, CurrentLearningPlan } from './types';
import { Header } from './components/layout/Header';
import { WordInputForm } from './components/inputs/WordInputForm';
import { KnowledgePointInputForm } from './components/inputs/KnowledgePointInputForm';
import { ReviewDashboard } from './components/features/ReviewDashboard';
import { SyllabusManager } from './components/features/SyllabusManager';
import { NewKnowledgeArchitectureTab } from './components/features/NewKnowledgeArchitectureTab';
import { Tabs } from './components/common/Tabs';
import { Button } from './components/common/Button';
import { InitialSelectionScreen } from './components/layout/InitialSelectionScreen';
import { EditKnowledgePointModal } from './components/inputs/EditKnowledgePointModal';
import { EditWordModal } from './components/display/EditWordModal';
import { RecentlyDeletedModal } from './components/modals/RecentlyDeletedModal';
import { SelectNotionExportModal } from './components/modals/SelectNotionExportModal';
import { addDays, getTodayDateString, formatDate } from './utils/dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from './constants';
import { getStoredData, storeData } from './services/storageService';
import { generateId } from './utils/miscUtils';
import { exportDataToExcel } from './utils/exportUtils';
import { importDataFromExcel } from './utils/importUtils';
import { parsePdfToText, parseDocxToText, parseEpubToText } from './utils/ebookUtils';
import {
  createNotionPageWithBlocks,
  generateNotionBlocksForSyllabusStructure
} from './services/notionService'; // Corrected path


type AppState = 'loading' | 'selection' | 'main';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.Learn);
  const [words, setWords] = useState<WordItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([]); // Main KPs
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]); // Main syllabus
  const [isTrulyLoading, setIsTrulyLoading] = useState<boolean>(true);

  // States for the single, unified "New Knowledge System"
  const [newKnowledgeSyllabus, setNewKnowledgeSyllabus] = useState<SyllabusItem[]>([]);
  const [newKnowledgeKnowledgePoints, setNewKnowledgeKnowledgePoints] = useState<KnowledgePointItem[]>([]);
  const [primaryNewKnowledgeSubjectCategoryId, setPrimaryNewKnowledgeSubjectCategoryId] = useState<string | null>(null); // ID of top-level category in newKnowledgeSyllabus
  
  const [currentLearningPlan, setCurrentLearningPlan] = useState<CurrentLearningPlan | null>(null);


  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [isEditWordModalOpen, setIsEditWordModalOpen] = useState<boolean>(false);
  const [editingKnowledgePoint, setEditingKnowledgePoint] = useState<KnowledgePointItem | null>(null);
  const [isEditKpModalOpen, setIsEditKpModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [selectedEbookForLookupId, setSelectedEbookForLookupId] = useState<string | null>(null);
  const [ebookImportStatus, setEbookImportStatus] = useState<string | null>(null);

  const [recentlyDeletedItems, setRecentlyDeletedItems] = useState<RecentlyDeletedItem[]>([]);
  const [isRecentlyDeletedModalOpen, setIsRecentlyDeletedModalOpen] = useState(false);
  
  const [isExportingToNotion, setIsExportingToNotion] = useState(false);
  const [notionExportMessage, setNotionExportMessage] = useState<string | null>(null);
  const [isNotionExportModalOpen, setIsNotionExportModalOpen] = useState(false);
  const [selectedMainSyllabusId, setSelectedMainSyllabusId] = useState<string | null>(SYLLABUS_ROOT_ID);

  const primaryNewKnowledgeSubjectCategory = useMemo(() =>
    newKnowledgeSyllabus.find(s => s.id === primaryNewKnowledgeSubjectCategoryId && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID),
  [newKnowledgeSyllabus, primaryNewKnowledgeSubjectCategoryId]);


  const [_isDarkMode, setIsDarkMode] = useState(false);
  const [localStorageError, setLocalStorageError] = useState<string | null>(null);
  
  useEffect(() => {
    // This effect runs once on mount to check the user's system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
  }, []);

  useEffect(() => {
    const loadData = () => {
      const loadedWords = getStoredData<WordItem[]>('words', []);
      const loadedKnowledgePoints = getStoredData<KnowledgePointItem[]>('knowledgePoints', []).map(kp => ({
          ...kp,
          // masterId is for origin tracking if synced from new knowledge, or self ID
          masterId: kp.masterId || kp.id
      }));
      const storedSyllabus = getStoredData<SyllabusItem[]>('syllabus', []);
      const loadedRecentlyDeleted = getStoredData<RecentlyDeletedItem[]>('recentlyDeleted', []);
      
      const loadedNewKnowledgeSyllabus = getStoredData<SyllabusItem[]>('newKnowledgeSyllabus', []);
      const loadedNewKnowledgeKPs = getStoredData<KnowledgePointItem[]>('newKnowledgeKnowledgePoints', []).map(kp => ({
          ...kp,
          masterId: kp.masterId || kp.id // masterId is self ID for new KPs
      }));
      const loadedPrimaryNewKnowledgeSubjectCategoryId = getStoredData<string | null>('primaryNewKnowledgeSubjectCategoryId', null);
      const loadedCurrentLearningPlan = getStoredData<CurrentLearningPlan | null>('currentLearningPlan', null);

      setWords(loadedWords);
      setKnowledgePoints(loadedKnowledgePoints);
      
      setNewKnowledgeSyllabus(loadedNewKnowledgeSyllabus.length === 0 && !loadedNewKnowledgeSyllabus.find(item => item.id === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID)
        ? [{ id: NEW_KNOWLEDGE_SYLLABUS_ROOT_ID, title: '新知识体系根目录', parentId: null }]
        : loadedNewKnowledgeSyllabus
      );
      setNewKnowledgeKnowledgePoints(loadedNewKnowledgeKPs);

      if (loadedPrimaryNewKnowledgeSubjectCategoryId && loadedNewKnowledgeSyllabus.some(s => s.id === loadedPrimaryNewKnowledgeSubjectCategoryId)) {
        setPrimaryNewKnowledgeSubjectCategoryId(loadedPrimaryNewKnowledgeSubjectCategoryId);
      } else {
        setPrimaryNewKnowledgeSubjectCategoryId(null);
      }

      if (loadedCurrentLearningPlan) {
        // Validate plan based on new structure
        const topLevelCatExists = loadedNewKnowledgeSyllabus.some(s => s.id === loadedCurrentLearningPlan.subjectId && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
        const actualCatExists = loadedNewKnowledgeSyllabus.some(s => s.id === loadedCurrentLearningPlan.categoryId);
        if (topLevelCatExists && actualCatExists) {
            setCurrentLearningPlan(loadedCurrentLearningPlan);
        } else {
            setCurrentLearningPlan(null); // Clear invalid plan
        }
      } else {
        setCurrentLearningPlan(null);
      }
      
      setEbooks(getStoredData<Ebook[]>('ebooksLibrary', []));
      setSelectedEbookForLookupId(getStoredData<string | null>('selectedEbookForLookupId', null));

      const now = Date.now();
      const freshRecentlyDeleted = loadedRecentlyDeleted.filter(
        rd => (now - new Date(rd.deletedAt).getTime()) < TWENTY_FOUR_HOURS_MS
      );
      setRecentlyDeletedItems(freshRecentlyDeleted);
      if (freshRecentlyDeleted.length !== loadedRecentlyDeleted.length) {
        storeData('recentlyDeleted', freshRecentlyDeleted);
      }

      if (storedSyllabus.length === 0 || !storedSyllabus.find(item => item.id === SYLLABUS_ROOT_ID)) {
        const newSyllabusBase: SyllabusItem[] = [ { id: SYLLABUS_ROOT_ID, title: '所有主题', parentId: null }, ];
        setSyllabus(newSyllabusBase);
        storeData('syllabus', newSyllabusBase);
      } else {
        const rootItem = storedSyllabus.find(item => item.id === SYLLABUS_ROOT_ID);
        if (rootItem && rootItem.title !== '所有主题') {
            rootItem.title = '所有主题';
            storeData('syllabus', [...storedSyllabus]);
        }
        setSyllabus(storedSyllabus);
      }
      
      const today = getTodayDateString();
      
      const consolidatedKPsMapForDueCheck = new Map<string, KnowledgePointItem>();
      loadedNewKnowledgeKPs.forEach(nkKp => consolidatedKPsMapForDueCheck.set(nkKp.masterId || nkKp.id, nkKp));
      loadedKnowledgePoints.forEach(mainKp => consolidatedKPsMapForDueCheck.set(mainKp.masterId || mainKp.id, mainKp));
      const allUniqueKPsForDueCheck = Array.from(consolidatedKPsMapForDueCheck.values());

      const dueItemsCount = [...loadedWords, ...allUniqueKPsForDueCheck]
        .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today)
        .length;

      const primaryNewKnowledgeCatForSelection = loadedNewKnowledgeSyllabus.find(s => s.id === loadedPrimaryNewKnowledgeSubjectCategoryId);

      if (dueItemsCount > 0 || primaryNewKnowledgeCatForSelection) {
        setAppState('selection');
      } else {
        setAppState('main');
        setActiveTab(ActiveTab.Learn);
      }
      setIsTrulyLoading(false);
    };
    loadData();
  }, []);


  const persistWords = useCallback((newWords: WordItem[]) => {
    setWords(newWords);
    storeData('words', newWords);
  }, []);

  const persistKnowledgePoints = useCallback((newKPs: KnowledgePointItem[]) => {
    setKnowledgePoints(newKPs);
    try {
      storeData('knowledgePoints', newKPs);
      setLocalStorageError(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'LocalStorageQuotaExceeded') {
        setLocalStorageError('本地存储空间不足，无法保存知识点。请清理一些旧数据或图片。');
      } else {
        throw error;
      }
    }
  }, []);

  const persistSyllabus = useCallback((newSyllabus: SyllabusItem[]) => {
    setSyllabus(newSyllabus);
    storeData('syllabus', newSyllabus);
  }, []);

  const persistNewKnowledgeSyllabus = useCallback((updatedSyllabus: SyllabusItem[]) => {
    setNewKnowledgeSyllabus(updatedSyllabus);
    storeData('newKnowledgeSyllabus', updatedSyllabus);
     if (currentLearningPlan && !updatedSyllabus.some(s => s.id === currentLearningPlan.categoryId)) {
        handleSetCurrentLearningPlan(null); // Clear plan if its category was deleted
    }
  }, [currentLearningPlan]); // Added currentLearningPlan dependency

  const persistNewKnowledgeKnowledgePoints = useCallback((updatedKPs: KnowledgePointItem[]) => {
    setNewKnowledgeKnowledgePoints(updatedKPs);
    try {
      storeData('newKnowledgeKnowledgePoints', updatedKPs);
      setLocalStorageError(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'LocalStorageQuotaExceeded') {
        setLocalStorageError('本地存储空间不足，无法保存新知识点。请清理一些旧数据或图片。');
      } else {
        throw error;
      }
    }
  }, []);

  const persistPrimaryNewKnowledgeSubjectCategoryId = useCallback((subjectCategoryId: string | null) => {
    setPrimaryNewKnowledgeSubjectCategoryId(subjectCategoryId);
    storeData('primaryNewKnowledgeSubjectCategoryId', subjectCategoryId);
    if (currentLearningPlan && subjectCategoryId !== currentLearningPlan.subjectId) {
        handleSetCurrentLearningPlan(null);
    }
  }, [currentLearningPlan]); // Added currentLearningPlan dependency
  
  const handleSetCurrentLearningPlan = useCallback((plan: CurrentLearningPlan | null) => {
    setCurrentLearningPlan(plan);
    storeData('currentLearningPlan', plan);
  }, []);

  const handleMarkCategoryAsLearned = useCallback((categoryId: string) => {
    let updatedSyllabus = [...newKnowledgeSyllabus];
    const categoryIndex = updatedSyllabus.findIndex(s => s.id === categoryId);

    if (categoryIndex === -1) return;

    // Mark the category itself as learned
    updatedSyllabus[categoryIndex] = { ...updatedSyllabus[categoryIndex], isLearned: true };

    // Recursive function to check and update parents
    const updateParentStatus = (childId: string) => {
      const child = updatedSyllabus.find(s => s.id === childId);
      if (!child || !child.parentId || child.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
        return; // Stop if no parent or parent is root
      }

      const parentId = child.parentId;
      const siblings = updatedSyllabus.filter(s => s.parentId === parentId);
      const allSiblingsLearned = siblings.every(s => s.isLearned);

      if (allSiblingsLearned) {
        const parentIndex = updatedSyllabus.findIndex(s => s.id === parentId);
        if (parentIndex !== -1 && !updatedSyllabus[parentIndex].isLearned) {
          updatedSyllabus[parentIndex] = { ...updatedSyllabus[parentIndex], isLearned: true };
          // Recurse to check the grandparent
          updateParentStatus(parentId);
        }
      }
    };

    updateParentStatus(categoryId);
    persistNewKnowledgeSyllabus(updatedSyllabus);
  }, [newKnowledgeSyllabus, persistNewKnowledgeSyllabus]);

  const handleMarkCategoryAsUnlearned = useCallback((categoryId: string) => {
    setNewKnowledgeSyllabus(prevSyllabus => {
        let updatedSyllabus = [...prevSyllabus];
        const itemsToUpdate = new Set<string>();

        const findDescendants = (id: string) => {
            itemsToUpdate.add(id);
            const children = updatedSyllabus.filter(item => item.parentId === id);
            children.forEach(child => findDescendants(child.id));
        };
        findDescendants(categoryId);

        updatedSyllabus = updatedSyllabus.map(item =>
            itemsToUpdate.has(item.id) ? { ...item, isLearned: false } : item
        );

        const updateAncestors = (childId: string, currentUpdatedSyllabus: SyllabusItem[]) => {
            const child = currentUpdatedSyllabus.find(s => s.id === childId);
            if (!child?.parentId || child.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) return currentUpdatedSyllabus;

            const parentIndex = currentUpdatedSyllabus.findIndex(s => s.id === child.parentId);
            if (parentIndex !== -1 && currentUpdatedSyllabus[parentIndex].isLearned) {
                currentUpdatedSyllabus[parentIndex] = { ...currentUpdatedSyllabus[parentIndex], isLearned: false };
                return updateAncestors(currentUpdatedSyllabus[parentIndex].id, currentUpdatedSyllabus);
            }
            return currentUpdatedSyllabus;
        };

        updatedSyllabus = updateAncestors(categoryId, updatedSyllabus);
        persistNewKnowledgeSyllabus(updatedSyllabus);
        return updatedSyllabus;
    });
  }, [newKnowledgeSyllabus, persistNewKnowledgeSyllabus]);

  const persistEbooks = useCallback((updatedEbooks: Ebook[]) => {
    setEbooks(updatedEbooks);
    storeData('ebooksLibrary', updatedEbooks);
  }, []);

  const persistSelectedEbookForLookupId = useCallback((id: string | null) => {
    setSelectedEbookForLookupId(id);
    storeData('selectedEbookForLookupId', id);
  }, []);

  const persistRecentlyDeletedItems = useCallback((itemToAdd: RecentlyDeletedItem) => {
    setRecentlyDeletedItems(prevItems => {
        const newItems = [...prevItems, itemToAdd];
        storeData('recentlyDeleted', newItems);
        return newItems;
    });
  }, []);


  const handleEbookUpload = async (file: File) => {
    if (!file) return;
    setEbookImportStatus(`正在处理电子书: ${file.name}... 请稍候，大型文件可能需要一些时间。`);
    
    try {
      let textContent = "";
      const fileNameLower = file.name.toLowerCase();

      if (file.type === "text/plain" || fileNameLower.endsWith(".txt")) {
        textContent = await file.text();
      } else if (fileNameLower.endsWith(".pdf")) {
        textContent = await parsePdfToText(file);
      } else if (fileNameLower.endsWith(".epub")) {
        textContent = await parseEpubToText(file);
      } else if (fileNameLower.endsWith(".docx")) {
        textContent = await parseDocxToText(file);
      } else if (fileNameLower.endsWith(".doc")) {
         setEbookImportStatus(`错误: 不支持 .doc 文件。请尝试转换为 .docx 或其他支持的格式。`);
         setTimeout(() => setEbookImportStatus(null), 7000);
         return;
      } else {
        throw new Error("不支持的文件格式。请上传 .txt, .pdf, .epub, 或 .docx。");
      }
      
      const newEbookId = generateId();
      if (textContent && textContent.trim().length > 0) {
        const newEbook: Ebook = { id: newEbookId, name: file.name, content: textContent };
        persistEbooks([...ebooks, newEbook]);
        persistSelectedEbookForLookupId(newEbookId);
        setEbookImportStatus(`电子书 "${file.name}" 已成功添加到您的书库并被选中！现在可以在添加单词时用于查找例句。`);
      } else {
         const newEbook: Ebook = { id: newEbookId, name: file.name, content: "" };
         persistEbooks([...ebooks, newEbook]);
         setEbookImportStatus(`电子书 "${file.name}" 已添加到书库，但未能解析出文本内容或内容为空。`);
      }

    } catch (err) {
      console.error("Ebook upload/processing error:", err);
      const message = err instanceof Error ? err.message : "处理电子书失败。";
      setEbookImportStatus(`错误: ${message}`);
    } finally {
      setTimeout(() => setEbookImportStatus(null), 7000);
    }
  };

  const handleDeleteEbook = (ebookId: string) => {
    const updatedEbooks = ebooks.filter(eb => eb.id !== ebookId);
    persistEbooks(updatedEbooks);
    if (selectedEbookForLookupId === ebookId) {
      persistSelectedEbookForLookupId(null);
    }
    setEbookImportStatus("电子书已从书库删除。");
    setTimeout(() => setEbookImportStatus(null), 3000);
  };
  
  const handleSelectEbookForLookup = useCallback((ebookId: string | null) => {
    persistSelectedEbookForLookupId(ebookId);
  }, [persistSelectedEbookForLookupId]);


  const addWord = useCallback((word: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'>) => {
    const newWord: WordItem = {
      ...word,
      id: generateId(),
      type: 'word',
      createdAt: new Date().toISOString(),
      lastReviewedAt: null,
      nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
      srsStage: 0,
    };
    persistWords([...words, newWord]);
  }, [words, persistWords]);

  const getChildrenRecursive = (parentId: string, syllabus: SyllabusItem[]): string[] => {
    const children = syllabus.filter(item => item.parentId === parentId);
    if (children.length === 0) {
      return [];
    }
    return children.reduce((acc, child) => {
      return [...acc, child.id, ...getChildrenRecursive(child.id, syllabus)];
    }, [] as string[]);
  };

  const addKnowledgePoint = useCallback((kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type' | 'masterId' | 'subjectId'>, isNewKnowledgeContext: boolean = false) => {
    const newKpId = generateId();
    let topLevelSubjectCatId: string | undefined = undefined;

    if (isNewKnowledgeContext) {
        if (kp.syllabusItemId) {
        let current: SyllabusItem | undefined = newKnowledgeSyllabus.find(s => s.id === kp.syllabusItemId);
        while (current && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
            current = newKnowledgeSyllabus.find(s => s.id === current!.parentId);
        }
        if (current && current.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
            topLevelSubjectCatId = current.id;
            }
        } else if (primaryNewKnowledgeSubjectCategoryId) {
            topLevelSubjectCatId = primaryNewKnowledgeSubjectCategoryId;
        }
    }
    
    const newKp: KnowledgePointItem = {
      ...kp,
      id: newKpId,
      masterId: newKpId, // masterId is self ID for new KPs
      type: 'knowledge',
      createdAt: new Date().toISOString(),
      lastReviewedAt: null,
      nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
      srsStage: 0,
      subjectId: isNewKnowledgeContext ? topLevelSubjectCatId : undefined,
    };

    if (isNewKnowledgeContext) {
      persistNewKnowledgeKnowledgePoints([...newKnowledgeKnowledgePoints, newKp]);
    } else {
      persistKnowledgePoints([...knowledgePoints, newKp]);
    }
  }, [knowledgePoints, persistKnowledgePoints, newKnowledgeSyllabus, newKnowledgeKnowledgePoints, persistNewKnowledgeKnowledgePoints, primaryNewKnowledgeSubjectCategoryId]);


  const updateStudyItem = useCallback((updatedItem: WordItem | KnowledgePointItem) => {
    if (updatedItem.type === 'word') {
      persistWords(words.map(w => w.id === updatedItem.id ? updatedItem : w));
    } else {
      const kpToUpdate = updatedItem as KnowledgePointItem;
      // If it's a "new knowledge" KP (it has a subjectId pointing to a newKnowledgeSyllabus category)
      if (kpToUpdate.subjectId && newKnowledgeSyllabus.some(s => s.id === kpToUpdate.subjectId && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID)) {
        persistNewKnowledgeKnowledgePoints(newKnowledgeKnowledgePoints.map(kp =>
            kp.id === kpToUpdate.id ? kpToUpdate : kp
        ));
      } else { // Otherwise, it's a main knowledge point
        persistKnowledgePoints(knowledgePoints.map(kp =>
            kp.id === kpToUpdate.id ? kpToUpdate : kp
        ));
      }
    }
  }, [words, knowledgePoints, newKnowledgeKnowledgePoints, newKnowledgeSyllabus, persistWords, persistKnowledgePoints, persistNewKnowledgeKnowledgePoints]);


  const openEditWordModal = (word: WordItem) => {
      setEditingWord(word);
      setIsEditWordModalOpen(true);
    };
  
  const handleSaveEditedWord = (updatedWord: WordItem) => {
      updateStudyItem(updatedWord);
      setIsEditWordModalOpen(false);
      setEditingWord(null);
    };
    
  const openEditKpModal = (kp: KnowledgePointItem) => {
    setEditingKnowledgePoint(kp);
    setIsEditKpModalOpen(true);
  };

  const handleSaveEditedKp = (updatedKp: KnowledgePointItem) => {
    updateStudyItem(updatedKp);
    setIsEditKpModalOpen(false);
    setEditingKnowledgePoint(null);
  };
  
  const deleteStudyItem = useCallback((itemId: string, itemType: 'word' | 'knowledge', confirmed: boolean = false) => {
    let itemToDelete: LearningItem | undefined;
    let isFromNewKnowledgeContext = false;

    if (itemType === 'knowledge') {
      itemToDelete = newKnowledgeKnowledgePoints.find(kp => kp.id === itemId);
      if (itemToDelete) {
        isFromNewKnowledgeContext = true;
      } else {
        itemToDelete = knowledgePoints.find(kp => kp.id === itemId);
      }
    } else {
      itemToDelete = words.find(w => w.id === itemId);
    }
    
    const itemIdentifier = itemToDelete
      ? (itemToDelete.type === 'word' ? itemToDelete.text : itemToDelete.title)
      : '未知项目';

    const confirmMessage = `您确定要删除这个${itemType === 'word' ? '单词' : '知识点'}："${itemIdentifier}"吗？此项目将被移至"最近删除"，可在24小时内恢复。`;
    
    if (confirmed || window.confirm(confirmMessage)) {
        if (itemType === 'word') {
          if (itemToDelete) persistWords(words.filter(w => w.id !== itemId));
        } else {
          if (isFromNewKnowledgeContext && itemToDelete) {
            persistNewKnowledgeKnowledgePoints(newKnowledgeKnowledgePoints.filter(kp => kp.id !== itemId));
          } else if (itemToDelete) {
            persistKnowledgePoints(knowledgePoints.filter(kp => kp.id !== itemId));
          }
        }

        if (itemToDelete && !confirmed) { // Only add to recently deleted if not part of a confirmed batch deletion
          const newRecentlyDeletedItem: RecentlyDeletedItem = {
            item: itemToDelete,
            deletedAt: new Date().toISOString(),
          };
          persistRecentlyDeletedItems(newRecentlyDeletedItem);
        }
    }
  }, [words, knowledgePoints, newKnowledgeKnowledgePoints, persistWords, persistKnowledgePoints, persistNewKnowledgeKnowledgePoints, persistRecentlyDeletedItems]);

  const restoreStudyItem = useCallback((deletedItemRecord: RecentlyDeletedItem) => {
    const { item } = deletedItemRecord;
    
    const kpItem = item as KnowledgePointItem;

    // Ensure masterId is set correctly upon restoration
    if (item.type === 'knowledge') {
        if (!kpItem.masterId) { // If it didn't have one (e.g., older data or was a primary instance)
            kpItem.masterId = kpItem.id;
        }
    }


    if (item.type === 'word') {
      persistWords([...words, item as WordItem]);
    } else {
      // A KP belongs to the "New Knowledge" system if it has a subjectId,
      // even if that subject category has since been deleted.
      if (kpItem.subjectId !== undefined && kpItem.subjectId !== null) {
        
        // Check if its subject category still exists.
        const subjectExists = newKnowledgeSyllabus.some(s => s.id === kpItem.subjectId);
        if (!subjectExists) {
          // The subject is gone, so this KP is now homeless. Clear its subjectId.
          kpItem.subjectId = undefined;
        }

        // Check if its direct syllabus category still exists.
        const categoryExists = kpItem.syllabusItemId && newKnowledgeSyllabus.some(s => s.id === kpItem.syllabusItemId);
        if (!categoryExists) {
          // The category is gone, restore as uncategorized within the new knowledge system.
          kpItem.syllabusItemId = null;
        }

        if (!newKnowledgeKnowledgePoints.some(k => k.id === kpItem.id)) {
            persistNewKnowledgeKnowledgePoints([...newKnowledgeKnowledgePoints, kpItem]);
        }
      } else { // It's a main syllabus KP.
        if (!knowledgePoints.some(k => k.id === kpItem.id)) {
          persistKnowledgePoints([...knowledgePoints, kpItem]);
        }
      }
    }
    // Filter out the restored item from recentlyDeletedItems
    setRecentlyDeletedItems(prevItems => {
        const updatedItems = prevItems.filter(rd => rd.item.id !== item.id);
        storeData('recentlyDeleted', updatedItems);
        return updatedItems;
    });
  }, [words, knowledgePoints, newKnowledgeKnowledgePoints, newKnowledgeSyllabus, persistWords, persistKnowledgePoints, persistNewKnowledgeKnowledgePoints]);


  const handleMoveKnowledgePointCategory = useCallback((itemId: string, newSyllabusId: string | null, isNewKnowledgeContext: boolean = false) => {
    let itemToUpdate: KnowledgePointItem | undefined;
    if (isNewKnowledgeContext) {
        itemToUpdate = newKnowledgeKnowledgePoints.find(kp => kp.id === itemId);
    } else {
        itemToUpdate = knowledgePoints.find(kp => kp.id === itemId);
    }

    if (itemToUpdate) {
        let newSubjectCatId = itemToUpdate.subjectId;
        if (isNewKnowledgeContext && newSyllabusId) {
            let current: SyllabusItem | undefined = newKnowledgeSyllabus.find(s => s.id === newSyllabusId);
            while(current && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
                current = newKnowledgeSyllabus.find(s => s.id === current!.parentId);
            }
            newSubjectCatId = current ? current.id : undefined;
        } else if (isNewKnowledgeContext && !newSyllabusId) {
            newSubjectCatId = undefined;
        }
        
        updateStudyItem({ ...itemToUpdate, syllabusItemId: newSyllabusId, subjectId: newSubjectCatId });
    }
  }, [knowledgePoints, newKnowledgeKnowledgePoints, newKnowledgeSyllabus, updateStudyItem]);


  const addSyllabusItem = useCallback((item: Omit<SyllabusItem, 'id'>, isNewKnowledgeContext: boolean = false) => {
    const newSyllabusItem = { ...item, id: generateId() };
    if (isNewKnowledgeContext) {
        persistNewKnowledgeSyllabus([...newKnowledgeSyllabus, newSyllabusItem]);
    } else {
        persistSyllabus([...syllabus, newSyllabusItem]);
    }
  }, [syllabus, persistSyllabus, newKnowledgeSyllabus, persistNewKnowledgeSyllabus]);

  const updateSyllabusItem = useCallback((updatedItem: SyllabusItem, isNewKnowledgeContext: boolean = false) => {
     if (isNewKnowledgeContext) {
        persistNewKnowledgeSyllabus(newKnowledgeSyllabus.map(s => s.id === updatedItem.id ? updatedItem : s));
    } else {
        persistSyllabus(syllabus.map(s => s.id === updatedItem.id ? updatedItem : s));
    }
  }, [syllabus, persistSyllabus, newKnowledgeSyllabus, persistNewKnowledgeSyllabus]);

  const deleteSyllabusItemAndKps = useCallback((itemId: string) => {
    const descendants = getChildrenRecursive(itemId, newKnowledgeSyllabus);
    const allIdsToDelete = [itemId, ...descendants];
  
    // First, process KPs to delete and add them to recently deleted
    const updatedNewKnowledgeKnowledgePoints = newKnowledgeKnowledgePoints.filter(kp => {
        const shouldDelete = kp.syllabusItemId && allIdsToDelete.includes(kp.syllabusItemId);
        if (shouldDelete) {
            const newRecentlyDeletedItem: RecentlyDeletedItem = {
                item: kp,
                deletedAt: new Date().toISOString(),
            };
            persistRecentlyDeletedItems(newRecentlyDeletedItem);
        }
        return !shouldDelete;
    });
  
    persistNewKnowledgeKnowledgePoints(updatedNewKnowledgeKnowledgePoints);
  
    // Now, just delete the syllabus categories.
    const syllabusToKeep = newKnowledgeSyllabus.filter(s => !allIdsToDelete.includes(s.id));
    persistNewKnowledgeSyllabus(syllabusToKeep);
  
    // If a current learning plan category is deleted, reset the plan.
    if (currentLearningPlan && allIdsToDelete.includes(currentLearningPlan.categoryId)) {
      handleSetCurrentLearningPlan(null);
    }
  }, [newKnowledgeSyllabus, newKnowledgeKnowledgePoints, persistNewKnowledgeSyllabus, currentLearningPlan, handleSetCurrentLearningPlan, getChildrenRecursive, persistRecentlyDeletedItems]);

  const deleteSyllabusItem = useCallback((itemId: string, isNewKnowledgeContext: boolean = false) => {
    const targetSyllabus = isNewKnowledgeContext ? newKnowledgeSyllabus : syllabus;
    const persistTargetSyllabus = isNewKnowledgeContext ? persistNewKnowledgeSyllabus : persistSyllabus;
    
    const kpsToUpdateList = isNewKnowledgeContext ? newKnowledgeKnowledgePoints : knowledgePoints;
    const persistKpsToUpdate = isNewKnowledgeContext ? persistNewKnowledgeKnowledgePoints : persistKnowledgePoints;
    
    const descendants = getChildrenRecursive(itemId, targetSyllabus);
    const allIdsToDelete = [itemId, ...descendants];
    
    const updatedKps = kpsToUpdateList.map(kp => {
        if (kp.syllabusItemId && allIdsToDelete.includes(kp.syllabusItemId)) {
            // For new knowledge KPs, also clear subjectId as they become "homeless"
            return { ...kp, syllabusItemId: null, subjectId: isNewKnowledgeContext ? undefined : kp.subjectId };
        }
        return kp;
    });
    
    const updatedSyllabus = targetSyllabus.filter(s => !allIdsToDelete.includes(s.id));
    
    persistTargetSyllabus(updatedSyllabus);
    persistKpsToUpdate(updatedKps);

    if (isNewKnowledgeContext && primaryNewKnowledgeSubjectCategoryId && allIdsToDelete.includes(primaryNewKnowledgeSubjectCategoryId)) {
        setPrimaryNewKnowledgeSubjectCategoryId(null);
    }
    if (currentLearningPlan && allIdsToDelete.includes(currentLearningPlan.categoryId)) {
        handleSetCurrentLearningPlan(null);
    }
  }, [syllabus, persistSyllabus, knowledgePoints, persistKnowledgePoints, newKnowledgeSyllabus, persistNewKnowledgeSyllabus, newKnowledgeKnowledgePoints, persistNewKnowledgeKnowledgePoints, primaryNewKnowledgeSubjectCategoryId, setPrimaryNewKnowledgeSubjectCategoryId, currentLearningPlan, handleSetCurrentLearningPlan, getChildrenRecursive]);


  const graduateNewSubjectCategoriesToMainSyllabus = useCallback(() => {
    const primarySubCat = newKnowledgeSyllabus.find(s => s.id === primaryNewKnowledgeSubjectCategoryId && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
    if (!primarySubCat) {
      alert("请先设置一个主学科。");
      return;
    }

    let currentMainSyllabus = [...syllabus]; // Working copy
    const newCategoriesForMain: SyllabusItem[] = [];

    // 1. Find or create the main subject root in the main syllabus
    let mainSubjectRootInMainSyllabus = currentMainSyllabus.find(s =>
        s.parentId === SYLLABUS_ROOT_ID && s.title.toLowerCase() === primarySubCat.title.toLowerCase()
    );

    if (!mainSubjectRootInMainSyllabus) {
        mainSubjectRootInMainSyllabus = { id: generateId(), title: primarySubCat.title, parentId: SYLLABUS_ROOT_ID };
        newCategoriesForMain.push(mainSubjectRootInMainSyllabus);
        currentMainSyllabus.push(mainSubjectRootInMainSyllabus);
    }

    const firstLevelChildrenInNewKnowledge = newKnowledgeSyllabus.filter(s => s.parentId === primarySubCat.id);

    firstLevelChildrenInNewKnowledge.forEach(nkFirstChild => {
        const mainFirstChildExists = currentMainSyllabus.some(s =>
            s.parentId === mainSubjectRootInMainSyllabus!.id && s.title.toLowerCase() === nkFirstChild.title.toLowerCase()
        );
        if (!mainFirstChildExists) {
            const newMainFirstChild = { id: generateId(), title: nkFirstChild.title, parentId: mainSubjectRootInMainSyllabus!.id };
            newCategoriesForMain.push(newMainFirstChild);
            currentMainSyllabus.push(newMainFirstChild);
        }
    });

    if (newCategoriesForMain.length > 0) {
        persistSyllabus(currentMainSyllabus);
        alert(`主学科 "${primarySubCat.title}" 的顶级分类及其直接子分类已更新到主大纲中。`);
    } else {
        alert(`主学科 "${primarySubCat.title}" 的顶级分类结构似乎已存在于主大纲中，或其下没有子分类。未进行任何更改。`);
    }
  }, [newKnowledgeSyllabus, primaryNewKnowledgeSubjectCategoryId, syllabus, persistSyllabus]);


  const syncKpsToMain = (kpsToSync: KnowledgePointItem[], targetMainCategoryId: string | null, singleKpSync: boolean = false) => {
    const primarySubCat = newKnowledgeSyllabus.find(s => s.id === primaryNewKnowledgeSubjectCategoryId);
    const subjectNameForAlert = primarySubCat?.title || "当前新知识体系";

    if (kpsToSync.length === 0) {
      if (!singleKpSync) alert(`学科 "${subjectNameForAlert}" 此分类下没有新知识点可同步。`);
      else alert(`没有指定的知识点可同步。`);
      return;
    }
    
    // Check if the targetMainCategoryId is SYLLABUS_ROOT_ID which means it will be uncategorized
    // or if it's a valid category. If null (and not singleKpSync) it's an issue.
    if (targetMainCategoryId === null && !singleKpSync) {
        alert(`无法在主大纲中找到学科 "${subjectNameForAlert}" 对应分类。请先使用"导至主大纲"功能。`);
        return;
    }
    if (targetMainCategoryId === null && singleKpSync && kpsToSync[0].syllabusItemId) {
        const originalNsCat = newKnowledgeSyllabus.find(s => s.id === kpsToSync[0].syllabusItemId);
        alert(`无法在主大纲中找到知识点 "${kpsToSync[0].title}" 所属分类 "${originalNsCat?.title || '未知'}" 的对应分类。请先确保分类结构已通过"导至主大纲"同步。`);
        return;
    }
     if (targetMainCategoryId === null && singleKpSync && !kpsToSync[0].syllabusItemId) {
        alert(`知识点 "${kpsToSync[0].title}" 未在新知识体系中分类，无法确定其在主大纲中的目标分类。请先在新知识体系中为其分类。`);
        return;
    }

    const kpsAddedToMainList: KnowledgePointItem[] = [];
    
    kpsToSync.forEach(kpFromNewSystem => {
      // Check if a KP with the same origin (masterId pointing to kpFromNewSystem.id) already exists in main
      const existingMainKpWithOrigin = knowledgePoints.find(mkp => mkp.masterId === kpFromNewSystem.id);

      if (existingMainKpWithOrigin) {
        // Update existing main KP, but it's now independent
        const updatedExistingMainKp = {
            ...existingMainKpWithOrigin,
            title: kpFromNewSystem.title, // Take latest from new system at point of sync
            content: kpFromNewSystem.content,
            notes: kpFromNewSystem.notes,
            syllabusItemId: targetMainCategoryId, // Target the deepest existing parent or root
        };
        updateStudyItem(updatedExistingMainKp); // Update this independent copy
      } else {
        // Create a new, independent KP in the main list
        const newMainKp: KnowledgePointItem = {
            ...kpFromNewSystem, // Copy all data
            id: generateId(),    // New unique ID for the main list instance
            masterId: kpFromNewSystem.id,  // masterId now tracks origin ID from new system
            syllabusItemId: targetMainCategoryId, // Target the deepest existing parent or root
            subjectId: undefined, // No new knowledge subjectId in main list
            // SRS fields are reset for the new main list copy
            srsStage: 0,
            lastReviewedAt: null,
            nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
            createdAt: new Date().toISOString(), // New creation date for this main list instance
        };
        kpsAddedToMainList.push(newMainKp);
      }
    });

    if (kpsAddedToMainList.length > 0) {
        persistKnowledgePoints([...knowledgePoints, ...kpsAddedToMainList]);
    }
    
    const messageBase = singleKpSync ? `知识点 "${kpsToSync[0].title}"` : `分类下的`;
    
    if (kpsAddedToMainList.length > 0) {
        alert(`${messageBase}${kpsAddedToMainList.length > 1 ? kpsAddedToMainList.length + " 个知识点" : (singleKpSync ? "" : "知识点")}已作为独立副本添加/更新到主大纲对应分类。`);
    } else if (kpsToSync.length > 0 && kpsAddedToMainList.length === 0) {
        alert(`${messageBase}所有选定知识点似乎已在主大纲中存在对应项。请检查'全部/未分类'。`);
    }
  };
  
  const getPathTitles = (catId: string | null, currentSyllabus: SyllabusItem[], rootIdToStopAt: string): string[] => {
      if (!catId) return [];
      const path: string[] = [];
      let current: SyllabusItem | undefined = currentSyllabus.find(s => s.id === catId);
      while(current && current.id !== rootIdToStopAt) {
          path.unshift(current.title);
          if (current.parentId === rootIdToStopAt || current.parentId === null) break;
          current = currentSyllabus.find(s => s.id === current!.parentId);
      }
      return path;
  };

  const findDeepestMainCategory = (nkCategoryPath: string[]): string | null => {
      let mainTargetCategoryId: string | null = SYLLABUS_ROOT_ID;
      let currentParentInMainId: string | null = SYLLABUS_ROOT_ID;

      for (const titleToFind of nkCategoryPath) {
          const foundMainCat = syllabus.find(s =>
              s.title.toLowerCase() === titleToFind.toLowerCase() &&
              s.parentId === currentParentInMainId
          );
          if (foundMainCat) {
              mainTargetCategoryId = foundMainCat.id;
              currentParentInMainId = foundMainCat.id;
          } else {
              break;
          }
      }
      return mainTargetCategoryId;
  };


  const syncSingleNewKnowledgeKpToMainSyllabus = useCallback((kpIdToSync: string) => {
    const kpFromNewSystem = newKnowledgeKnowledgePoints.find(kp => kp.id === kpIdToSync);
    if (!kpFromNewSystem) {
        alert("无法找到要同步的知识点。");
        return;
    }

    if (!kpFromNewSystem.syllabusItemId) {
        alert("此知识点未在新知识体系中分类，无法确定其在主大纲中的目标分类。请先在新知识体系中为其分类。");
        return;
    }
    
    const nkCategoryPathTitles = getPathTitles(kpFromNewSystem.syllabusItemId, newKnowledgeSyllabus, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
    const mainTargetCategoryId = findDeepestMainCategory(nkCategoryPathTitles);
        
    syncKpsToMain([kpFromNewSystem], mainTargetCategoryId, true);

  }, [newKnowledgeSyllabus, newKnowledgeKnowledgePoints, syllabus, knowledgePoints, persistKnowledgePoints, updateStudyItem, primaryNewKnowledgeSubjectCategoryId]);


  const handleExportData = () => {
    const newKnowledgeSubjectsData: {
        sheetName: string;
        kps: KnowledgePointItem[];
    }[] = [];

    const topLevelSubjects = newKnowledgeSyllabus.filter(
        s => s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID
    );

    topLevelSubjects.forEach(subject => {
        const subjectKps = newKnowledgeKnowledgePoints.filter(kp => kp.subjectId === subject.id);
        
        newKnowledgeSubjectsData.push({
            sheetName: subject.title,
            kps: subjectKps
        });
    });
      
    exportDataToExcel(
        words,
        knowledgePoints,
        syllabus,
        newKnowledgeSyllabus,
        newKnowledgeSubjectsData
    );
  };

  const handleInitiateImport = () => {
    if (window.confirm("导入 Excel 文件将向您当前的数据中添加新的单词和知识点（如果它们尚不存在），并可能创建新的大纲分类。现有数据不会被删除或覆盖，重复项将根据标题/单词文本被跳过。确定要继续吗？\n\n请确保 Excel 文件包含名为 '单词' 和/或 '知识点' 的工作表，且列名符合预期格式。")) {
        fileInputRef.current?.click();
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportMessage("正在导入数据...");
    try {
      const { 
        importedWords, 
        importedMainKnowledgePoints,
        importedNewKnowledgePoints,
        newlyCreatedMainSyllabusItems,
        newlyCreatedNewKnowledgeSyllabusItems,
        updatedMainSyllabus,
        updatedNewKnowledgeSyllabus,
        message 
      } = await importDataFromExcel(
        file, 
        syllabus,
        knowledgePoints,
        newKnowledgeSyllabus,
        newKnowledgeKnowledgePoints,
        generateId, 
        words
      );

      if (newlyCreatedMainSyllabusItems.length > 0) {
        // These are genuinely new syllabus items, so add them.
        persistSyllabus([...syllabus, ...newlyCreatedMainSyllabusItems]);
      }
      if (newlyCreatedNewKnowledgeSyllabusItems.length > 0) {
        // These are genuinely new syllabus items, so add them.
        persistNewKnowledgeSyllabus([...newKnowledgeSyllabus, ...newlyCreatedNewKnowledgeSyllabusItems]);
      }

      // Directly set the state with the merged and updated lists returned from the import function
      persistWords(importedWords);
      persistKnowledgePoints(importedMainKnowledgePoints);
      persistNewKnowledgeKnowledgePoints(importedNewKnowledgePoints);
      
      // Update syllabuses directly with the comprehensive lists returned from import function
      persistSyllabus(updatedMainSyllabus);
      persistNewKnowledgeSyllabus(updatedNewKnowledgeSyllabus);
      
      setImportMessage(message);
      
    } catch (err) {
      console.error("Import failed:", err);
      setImportMessage(err instanceof Error ? err.message : "导入失败。请检查文件格式和内容。");
    } finally {
        if(fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setImportMessage(null), 7000);
    }
  };

  const handleOpenNotionExportModal = () => {
      if (syllabus.length <= 1 && knowledgePoints.length === 0 && newKnowledgeSyllabus.length <=1 && newKnowledgeKnowledgePoints.length === 0) {
         setNotionExportMessage("没有足够的数据可以导入到Notion。请先添加一些分类和知识点。");
         setTimeout(() => setNotionExportMessage(null), 5000);
         return;
      }
      setIsNotionExportModalOpen(true);
  };
  
  const handleNotionExportSelection = async (exportType: 'main' | string) => {
    setIsNotionExportModalOpen(false);
    setIsExportingToNotion(true);
    setNotionExportMessage("正在准备数据并导入到Notion... 请稍候。");

    let syllabusToExport: SyllabusItem[];
    let kpsToExport: KnowledgePointItem[];
    let rootIdForExportProcessing: string | null;
    let conceptualRootIdToSkipForNotion: string | null;
    let exportPageTitlePrefix: string;

    if (exportType === 'main') {
        syllabusToExport = syllabus;
        kpsToExport = knowledgePoints;
        rootIdForExportProcessing = SYLLABUS_ROOT_ID;
        conceptualRootIdToSkipForNotion = SYLLABUS_ROOT_ID; // The actual root of main syllabus
        exportPageTitlePrefix = "Lanlearner 主大纲导出";
    } else {
        const subjectCat = newKnowledgeSyllabus.find(s => s.id === exportType && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
        if (!subjectCat) {
            setNotionExportMessage("选择的学科类别未找到或不是顶级学科。");
            setIsExportingToNotion(false);
            setTimeout(() => setNotionExportMessage(null), 7000);
            return;
        }
        syllabusToExport = newKnowledgeSyllabus;
        const subjectCatAndChildrenIds = [subjectCat.id,
            ...newKnowledgeSyllabus.filter(s => {
                let current = s;
                while(current.parentId && current.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
                    if (current.parentId === subjectCat.id) return true;
                    current = newKnowledgeSyllabus.find(parent => parent.id === current.parentId)!;
                    if(!current) return false;
                }
                return false;
            }).map(s => s.id)
        ];
        kpsToExport = newKnowledgeKnowledgePoints.filter(kp => kp.syllabusItemId && subjectCatAndChildrenIds.includes(kp.syllabusItemId));
        
        rootIdForExportProcessing = subjectCat.id; // This subject category is the root for processing its content
        conceptualRootIdToSkipForNotion = subjectCat.id; // This subject category IS the page title, so skip rendering it as a heading in content
        exportPageTitlePrefix = subjectCat.title;
    }
    
     if (syllabusToExport.length <=1 && kpsToExport.length === 0 ) {
         setNotionExportMessage(`"${exportPageTitlePrefix}" 没有足够的数据导出。`);
         setIsExportingToNotion(false);
         setTimeout(() => setNotionExportMessage(null), 7000);
         return;
     }

    try {
      const now = new Date();
      const pageTitle = `${exportPageTitlePrefix} - ${formatDate(now)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      const notionBlocks = generateNotionBlocksForSyllabusStructure(
          rootIdForExportProcessing,
          syllabusToExport,
          kpsToExport,
          0, // Initial depth for Notion generation (children of the page subject are depth 0 for headings)
          conceptualRootIdToSkipForNotion
      );

      if (notionBlocks.length === 0 && exportType === 'main') {
           setNotionExportMessage("主大纲数据无法生成Notion内容。请检查数据或确保有内容可导出。");
           setIsExportingToNotion(false);
           setTimeout(() => setNotionExportMessage(null), 7000);
           return;
      }
      
      const { url: newPageUrl } = await createNotionPageWithBlocks(pageTitle, notionBlocks);
      setNotionExportMessage(`成功导入到Notion！页面链接: ${newPageUrl}`);
    } catch (error) {
      console.error("Notion export failed:", error);
      setNotionExportMessage(`Notion导入失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsExportingToNotion(false);
      setTimeout(() => setNotionExportMessage(null), 10000);
    }
  };


  const handleReviewSessionCompleted = useCallback(() => {
    setActiveTab(ActiveTab.Learn);
  }, []);

  const handleEditItem = (item: LearningItem) => {
      if (item.type === 'word') {
        openEditWordModal(item as WordItem);
      } else {
        openEditKpModal(item as KnowledgePointItem);
      }
    };


  if (isTrulyLoading || appState === 'loading') {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg text-gray-600">Lanlearner 加载中...</p></div>;
  }

  if (appState === 'selection') {
    return <InitialSelectionScreen
              onSelectLearn={() => { setActiveTab(ActiveTab.Learn); setAppState('main'); }}
              onSelectReview={() => { setActiveTab(ActiveTab.Review); setAppState('main'); }}
              activePrimaryNewSubjectName={primaryNewKnowledgeSubjectCategory?.title || null}
              onSelectNewSubject={() => {
                setActiveTab(ActiveTab.BuildNewSystem);
                setAppState('main');
              }}
           />;
  }
  
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 max-w-4xl w-full">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="mt-6 bg-white p-6 rounded-lg shadow-lg">
          {activeTab === ActiveTab.Learn && (
            <div className="space-y-8">
              <WordInputForm
                onAddWord={addWord}
                ebooks={ebooks}
                selectedEbookForLookupId={selectedEbookForLookupId}
                onSelectEbookForLookup={handleSelectEbookForLookup}
              />
              <KnowledgePointInputForm
                onAddKnowledgePoint={(kp) => addKnowledgePoint(kp,false)}
                syllabusItems={syllabus}
                isNewSubjectContext={false}
                syllabusRootId={SYLLABUS_ROOT_ID}
                activeNewSubjectNameProp={null}
              />
            </div>
          )}
          {activeTab === ActiveTab.Review && (
            <ReviewDashboard
              words={words}
              mainKnowledgePoints={knowledgePoints}
              onUpdateItem={updateStudyItem}
              onDeleteItem={deleteStudyItem}
              onReviewSessionCompleted={handleReviewSessionCompleted}
              mainSyllabus={syllabus}
              onMoveKnowledgePointCategory={(id, newId) => handleMoveKnowledgePointCategory(id, newId, false)}
              onEditItem={handleEditItem}
              ebooks={ebooks}
              selectedEbookForLookupId={selectedEbookForLookupId}
            />
          )}
          {activeTab === ActiveTab.Syllabus && (
            <SyllabusManager
              syllabusItems={syllabus}
              knowledgePoints={knowledgePoints}
              onAddItem={(item) => addSyllabusItem(item, false)}
              onUpdateItem={(item) => updateSyllabusItem(item, false)}
              onDeleteItem={(id) => deleteSyllabusItem(id, false)}
              onDeleteKnowledgePoint={deleteStudyItem}
              onMoveKnowledgePointCategory={(itemId, newSyllabusId) => handleMoveKnowledgePointCategory(itemId, newSyllabusId, false)}
              onEditItem={handleEditItem}
              ebooks={ebooks}
              ebookImportStatus={ebookImportStatus}
              onUploadEbook={handleEbookUpload}
              onDeleteEbook={handleDeleteEbook}
              isNewSubjectContext={false}
              currentSubjectRootId={SYLLABUS_ROOT_ID}
              currentSubjectName="所有主题"
              selectedSyllabusId={selectedMainSyllabusId}
              onSelectSyllabusId={setSelectedMainSyllabusId}
            />
          )}
          {activeTab === ActiveTab.BuildNewSystem && (
            <NewKnowledgeArchitectureTab
              newKnowledgeSyllabus={newKnowledgeSyllabus}
              newKnowledgeKnowledgePoints={newKnowledgeKnowledgePoints}
              primaryNewKnowledgeSubjectCategoryId={primaryNewKnowledgeSubjectCategoryId}
              onSetPrimaryCategoryAsSubject={persistPrimaryNewKnowledgeSubjectCategoryId}
              currentLearningPlan={currentLearningPlan}
              onSetLearningPlan={handleSetCurrentLearningPlan}
              
              onAddSyllabusItem={(item) => addSyllabusItem(item, true)}
              onUpdateSyllabusItem={(item) => updateSyllabusItem(item, true)}
              onDeleteSyllabusItem={(id) => deleteSyllabusItem(id, true)}
              onAddKnowledgePoint={(kp) => addKnowledgePoint(kp, true)}
              onDeleteKnowledgePoint={deleteStudyItem}
              onMoveKnowledgePointCategory={(itemId, newSyllabusId) => handleMoveKnowledgePointCategory(itemId, newSyllabusId, true)}
              onEditKnowledgePoint={handleEditItem}
              onGraduateCategories={graduateNewSubjectCategoriesToMainSyllabus}
              onMarkCategoryAsLearned={handleMarkCategoryAsLearned}
              onMarkCategoryAsUnlearned={handleMarkCategoryAsUnlearned}
              onSyncSingleKnowledgePointToMain={syncSingleNewKnowledgeKpToMainSyllabus}
              onDeleteSyllabusItemAndKnowledgePoints={deleteSyllabusItemAndKps} 
            />
          )}
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-gray-500">
        <div className="space-x-1 sm:space-x-2 mb-2 flex flex-wrap justify-center">
            <Button onClick={handleExportData} variant="ghost" size="sm" className="mb-1">
              导出数据 (Excel)
            </Button>
            <Button onClick={handleInitiateImport} variant="ghost" size="sm" className="mb-1">
              导入数据 (Excel)
            </Button>
            <Button
                onClick={handleOpenNotionExportModal}
                variant="ghost"
                size="sm"
                isLoading={isExportingToNotion}
                disabled={isExportingToNotion}
                className="mb-1"
            >
              {isExportingToNotion ? "正在导入Notion..." : "导入Notion"}
            </Button>
            <Button onClick={() => setIsRecentlyDeletedModalOpen(true)} variant="ghost" size="sm" className="mb-1">
              最近删除
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
            />
        </div>
        {importMessage && <p className={`text-sm mb-1 ${importMessage.includes('失败') || importMessage.includes('错误') ? 'text-red-500' : 'text-green-600'}`}>{importMessage}</p>}
        {notionExportMessage && <p className={`text-sm mb-1 ${notionExportMessage.includes('失败') || notionExportMessage.includes('错误') || notionExportMessage.includes('not configured') ? 'text-red-500' : 'text-green-600'}`}>{notionExportMessage}</p>}
        {localStorageError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mx-4 mt-4" role="alert">
            <strong className="font-bold">错误:</strong>
            <span className="block sm:inline"> {localStorageError}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" onClick={() => setLocalStorageError(null)}><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 1 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </span>
          </div>
        )}
        <div>© {new Date().getFullYear()} Lanlearner</div>
      </footer>
      {editingKnowledgePoint && isEditKpModalOpen && (
        <EditKnowledgePointModal
          isOpen={isEditKpModalOpen}
          onClose={() => { setIsEditKpModalOpen(false); setEditingKnowledgePoint(null); }}
          knowledgePoint={editingKnowledgePoint}
          onSave={handleSaveEditedKp}
        />
      )}

      {editingWord && isEditWordModalOpen && (
        <EditWordModal
          isOpen={isEditWordModalOpen}
          onClose={() => { setIsEditWordModalOpen(false); setEditingWord(null); }}
          word={editingWord}
          onSave={handleSaveEditedWord}
            />
      )}
      {isRecentlyDeletedModalOpen && (
        <RecentlyDeletedModal
          isOpen={isRecentlyDeletedModalOpen}
          onClose={() => setIsRecentlyDeletedModalOpen(false)}
          recentlyDeletedItems={recentlyDeletedItems.filter(
            rd => (Date.now() - new Date(rd.deletedAt).getTime()) < TWENTY_FOUR_HOURS_MS
          )}
          onRestoreItem={restoreStudyItem}
        />
      )}
      {isNotionExportModalOpen && (
        <SelectNotionExportModal
            isOpen={isNotionExportModalOpen}
            onClose={() => setIsNotionExportModalOpen(false)}
            onExportSelected={handleNotionExportSelection}
            mainSyllabusName="主大纲（知识点）"
            primaryNewKnowledgeSubject={primaryNewKnowledgeSubjectCategory ? {id: primaryNewKnowledgeSubjectCategory.id, name: primaryNewKnowledgeSubjectCategory.title} : null}
        />
      )}
    </div>
  );
};

export default App;
