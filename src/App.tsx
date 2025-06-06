import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActiveTab, WordItem, KnowledgePointItem, SyllabusItem, ChatMessage, LearningItem, Ebook } from './types';
import { Header } from './components/layout/Header';
import { WordInputForm } from './components/inputs/WordInputForm';
import { KnowledgePointInputForm } from './components/inputs/KnowledgePointInputForm';
import { ReviewDashboard } from './components/features/ReviewDashboard';
import { SyllabusManager } from './components/features/SyllabusManager';
import { AiChat } from './components/features/AiChat';
import { Tabs } from './components/common/Tabs';
import { Button } from './components/common/Button';
import { InitialSelectionScreen } from './components/layout/InitialSelectionScreen';
import { EditKnowledgePointModal } from './components/inputs/EditKnowledgePointModal';
import { EditWordModal } from './components/display/EditWordModal';
import { addDays, getTodayDateString } from './utils/dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_ROOT_ID } from './constants';
import { getStoredData, storeData } from './services/storageService';
import { generateId } from './utils/miscUtils';
import { exportDataToExcel } from './utils/exportUtils';
import { importDataFromExcel } from './utils/importUtils';
import { parsePdfToText, parseDocxToText, parseEpubToText } from './utils/ebookUtils';


type AppState = 'loading' | 'selection' | 'main';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.Learn);
  const [words, setWords] = useState<WordItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTrulyLoading, setIsTrulyLoading] = useState<boolean>(true);

  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [isEditWordModalOpen, setIsEditWordModalOpen] = useState<boolean>(false);
  const [editingKnowledgePoint, setEditingKnowledgePoint] = useState<KnowledgePointItem | null>(null);
  const [isEditKpModalOpen, setIsEditKpModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // E-book state
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [selectedEbookForLookupId, setSelectedEbookForLookupId] = useState<string | null>(null);
  const [ebookImportStatus, setEbookImportStatus] = useState<string | null>(null);


  const itemsDueForReview = useMemo(() => {
    const today = getTodayDateString();
    const allItems: LearningItem[] = [...words, ...knowledgePoints];
    return allItems
      .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
  }, [words, knowledgePoints]);

  useEffect(() => {
    const loadData = () => {
      const loadedWords = getStoredData<WordItem[]>('words', []);
      const loadedKnowledgePoints = getStoredData<KnowledgePointItem[]>('knowledgePoints', []);
      const storedSyllabus = getStoredData<SyllabusItem[]>('syllabus', []);
      
      setWords(loadedWords);
      setKnowledgePoints(loadedKnowledgePoints);
      setEbooks(getStoredData<Ebook[]>('ebooksLibrary', []));
      setSelectedEbookForLookupId(getStoredData<string | null>('selectedEbookForLookupId', null));

      if (storedSyllabus.length === 0 || !storedSyllabus.find(item => item.id === SYLLABUS_ROOT_ID)) {
        const newSyllabusBase: SyllabusItem[] = [
          { id: SYLLABUS_ROOT_ID, title: '所有主题', parentId: null },
          { id: generateId(), title: '名词、冠词、代词、数词、形容词与副词', parentId: null },
          { id: generateId(), title: '动词、介词、时态', parentId: null },
          { id: generateId(), title: '简单句（陈述句、疑问句、祈使句、感叹句、并列句）', parentId: null },
          { id: generateId(), title: '连词、动词不定式与动名词', parentId: null },
          { id: generateId(), title: '名词性从句、定语从句、状语从句', parentId: null },
          { id: generateId(), title: '虚拟语气、强调与倒装', parentId: null },
        ];
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
      setChatMessages(getStoredData<ChatMessage[]>('chatMessages', []));
      
      const today = getTodayDateString();
      const dueItems = [...loadedWords, ...loadedKnowledgePoints]
        .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today);

      if (dueItems.length > 0) {
        setAppState('selection');
      } else {
        setAppState('main');
        setActiveTab(ActiveTab.Learn);
      }
      setIsTrulyLoading(false);
    };
    loadData();
  }, []);

  const handleEditItem = (item: LearningItem) => {
      if (item.type === 'knowledge') {
        openEditKpModal(item as KnowledgePointItem);
      } else if (item.type === 'word') {
        openEditWordModal(item as WordItem);
      }
    };
    
  const persistWords = useCallback((newWords: WordItem[]) => {
    setWords(newWords);
    storeData('words', newWords);
  }, []);

  const persistKnowledgePoints = useCallback((newKPs: KnowledgePointItem[]) => {
    setKnowledgePoints(newKPs);
    storeData('knowledgePoints', newKPs);
  }, []);

  const persistSyllabus = useCallback((newSyllabus: SyllabusItem[]) => {
    setSyllabus(newSyllabus);
    storeData('syllabus', newSyllabus);
  }, []);
  
  const persistChatMessages = useCallback((updater: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])) => {
    setChatMessages(prevMessages => {
      const newMessages = typeof updater === 'function' ? updater(prevMessages) : updater;
      storeData('chatMessages', newMessages);
      return newMessages;
    });
  }, []);

  const persistEbooks = useCallback((updatedEbooks: Ebook[]) => {
    setEbooks(updatedEbooks);
    storeData('ebooksLibrary', updatedEbooks);
  }, []);

  const persistSelectedEbookForLookupId = useCallback((id: string | null) => {
    setSelectedEbookForLookupId(id);
    storeData('selectedEbookForLookupId', id);
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
        persistSelectedEbookForLookupId(newEbookId); // Auto-select new e-book
        setEbookImportStatus(`电子书 "${file.name}" 已成功添加到您的书库并被选中！现在可以在添加单词时用于查找例句。`);
      } else {
         const newEbook: Ebook = { id: newEbookId, name: file.name, content: "" }; // Store name but indicate no content
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

  const addKnowledgePoint = useCallback((kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'>) => {
    const newKp: KnowledgePointItem = {
      ...kp,
      id: generateId(),
      type: 'knowledge',
      createdAt: new Date().toISOString(),
      lastReviewedAt: null,
      nextReviewAt: addDays(getTodayDateString(), SRS_INTERVALS_DAYS[0]).toISOString(),
      srsStage: 0,
    };
    persistKnowledgePoints([...knowledgePoints, newKp]);
  }, [knowledgePoints, persistKnowledgePoints]);

  const updateStudyItem = useCallback((updatedItem: WordItem | KnowledgePointItem) => {
    if (updatedItem.type === 'word') {
      persistWords(words.map(w => w.id === updatedItem.id ? updatedItem : w));
    } else {
      persistKnowledgePoints(knowledgePoints.map(kp => kp.id === updatedItem.id ? updatedItem : kp));
    }
  }, [words, knowledgePoints, persistWords, persistKnowledgePoints]);

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
  
  const deleteStudyItem = useCallback((itemId: string, itemType: 'word' | 'knowledge') => {
    if (itemType === 'word') {
      persistWords(words.filter(w => w.id !== itemId));
    } else {
      persistKnowledgePoints(knowledgePoints.filter(kp => kp.id !== itemId));
    }
  }, [words, knowledgePoints, persistWords, persistKnowledgePoints]);

  const handleMoveKnowledgePointCategory = useCallback((itemId: string, newSyllabusId: string | null) => {
    const updatedKps = knowledgePoints.map(kp =>
       kp.id === itemId ? { ...kp, syllabusItemId: newSyllabusId } : kp
    );
    persistKnowledgePoints(updatedKps);
  }, [knowledgePoints, persistKnowledgePoints]);


  const addSyllabusItem = useCallback((item: Omit<SyllabusItem, 'id'>) => {
    const newSyllabusItem = { ...item, id: generateId() };
    persistSyllabus([...syllabus, newSyllabusItem]);
  }, [syllabus, persistSyllabus]);

  const updateSyllabusItem = useCallback((updatedItem: SyllabusItem) => {
    persistSyllabus(syllabus.map(s => s.id === updatedItem.id ? updatedItem : s));
  }, [syllabus, persistSyllabus]);

  const deleteSyllabusItem = useCallback((itemId: string) => {
    persistSyllabus(syllabus.filter(s => s.id !== itemId && s.parentId !== itemId));
    const updatedKps = knowledgePoints.map(kp =>
      kp.syllabusItemId === itemId ? { ...kp, syllabusItemId: null } : kp
    );
    persistKnowledgePoints(updatedKps);
  }, [syllabus, persistSyllabus, knowledgePoints, persistKnowledgePoints]);

  const handleExportData = () => {
    exportDataToExcel(words, knowledgePoints, syllabus);
  };

  const handleInitiateImport = () => {
    if (window.confirm("导入 Excel 文件将向您当前的数据中添加新的单词和知识点，并可能创建新的大纲分类。现有数据不会被删除。确定要继续吗？\n\n请确保 Excel 文件包含名为 '单词' 和/或 '知识点' 的工作表，且列名符合预期格式。")) {
        fileInputRef.current?.click();
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportMessage("正在导入数据...");
    try {
      const { importedWords, importedKnowledgePoints, newlyCreatedSyllabusItems, message } = await importDataFromExcel(file, syllabus, generateId);

      if (newlyCreatedSyllabusItems.length > 0) {
        const currentSyllabusIds = new Set(syllabus.map(s => s.id));
        const trulyNewItems = newlyCreatedSyllabusItems.filter(newItem => !currentSyllabusIds.has(newItem.id));
        if (trulyNewItems.length > 0) {
           persistSyllabus([...syllabus, ...trulyNewItems]);
        }
      }

      if (importedWords.length > 0) {
        persistWords([...words, ...importedWords]);
      }
      if (importedKnowledgePoints.length > 0) {
        persistKnowledgePoints([...knowledgePoints, ...importedKnowledgePoints]);
      }
      setImportMessage(message);
      
    } catch (err) {
      console.error("Import failed:", err);
      setImportMessage(err instanceof Error ? err.message : "导入失败。请检查文件格式和内容。");
    } finally {
        if(fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setImportMessage(null), 7000);
    }
  };


  const handleReviewSessionCompleted = useCallback(() => {
    setActiveTab(ActiveTab.Learn);
  }, []);


  if (isTrulyLoading || appState === 'loading') {
    return <div className="flex justify-center items-center h-screen"><p className="text-lg text-gray-600">Lanlearner 加载中...</p></div>;
  }

  if (appState === 'selection') {
    return <InitialSelectionScreen
              onSelectLearn={() => { setActiveTab(ActiveTab.Learn); setAppState('main'); }}
              onSelectReview={() => { setActiveTab(ActiveTab.Review); setAppState('main'); }}
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
              <KnowledgePointInputForm onAddKnowledgePoint={addKnowledgePoint} syllabusItems={syllabus} />
            </div>
          )}
          {activeTab === ActiveTab.Review && (
            <ReviewDashboard
              words={words}
              knowledgePoints={knowledgePoints}
              onUpdateItem={updateStudyItem}
              onDeleteItem={deleteStudyItem}
              onReviewSessionCompleted={handleReviewSessionCompleted}
              key={itemsDueForReview.length}
              allSyllabusItems={syllabus}
              onMoveKnowledgePointCategory={handleMoveKnowledgePointCategory}
              onEditItem={handleEditItem}
            />
          )}
          {activeTab === ActiveTab.Syllabus && (
            <SyllabusManager
              syllabusItems={syllabus}
              knowledgePoints={knowledgePoints}
              onAddItem={addSyllabusItem}
              onUpdateItem={updateSyllabusItem}
              onDeleteItem={deleteSyllabusItem}
              onDeleteKnowledgePoint={deleteStudyItem}
              onMoveKnowledgePointCategory={handleMoveKnowledgePointCategory}
              onEditItem={handleEditItem}
              ebooks={ebooks} // Changed from activeEbook
              ebookImportStatus={ebookImportStatus}
              onUploadEbook={handleEbookUpload}
              onDeleteEbook={handleDeleteEbook} // Changed from onClearEbook
            />
          )}
          {activeTab === ActiveTab.AiChat && (
             <AiChat
                messages={chatMessages}
                setMessages={persistChatMessages}
              />
          )}
        </div>
      </main>
      <footer className="text-center p-4 text-sm text-gray-500">
        <div className="space-x-2 mb-2">
            <Button onClick={handleExportData} variant="ghost" size="sm">
              导出数据 (Excel)
            </Button>
            <Button onClick={handleInitiateImport} variant="ghost" size="sm">
              导入数据 (Excel)
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
            />
        </div>
        {importMessage && <p className={`text-sm mb-2 ${importMessage.includes('失败') || importMessage.includes('错误') ? 'text-red-500' : 'text-green-600'}`}>{importMessage}</p>}
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
    </div>
  );
};

export default App;
