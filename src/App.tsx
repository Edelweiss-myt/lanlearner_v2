import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActiveTab, WordItem, KnowledgePointItem, SyllabusItem, ChatMessage, LearningItem } from './types';
import { Header } from './components/layout/Header';
import { WordInputForm } from './components/inputs/WordInputForm';
import { KnowledgePointInputForm } from './components/inputs/KnowledgePointInputForm';
import { ReviewDashboard } from './components/features/ReviewDashboard';
import { SyllabusManager } from './components/features/SyllabusManager';
import { AiChat } from './components/features/AiChat';
import { Tabs } from './components/common/Tabs';
import { Button } from './components/common/Button';
import { InitialSelectionScreen } from './components/layout/InitialSelectionScreen';
import { EditKnowledgePointModal } from './components/inputs/EditKnowledgePointModal'; // New import
import { addDays, getTodayDateString } from './utils/dateUtils';
import { SRS_INTERVALS_DAYS, SYLLABUS_ROOT_ID } from './constants';
import { getStoredData, storeData } from './services/storageService';
import { generateId } from './utils/miscUtils';
import { exportDataToExcel } from './utils/exportUtils';
import { importDataFromExcel } from './utils/importUtils'; 

type AppState = 'loading' | 'selection' | 'main';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.Learn);
  const [words, setWords] = useState<WordItem[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePointItem[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTrulyLoading, setIsTrulyLoading] = useState<boolean>(true);

  const [editingKnowledgePoint, setEditingKnowledgePoint] = useState<KnowledgePointItem | null>(null);
  const [isEditKpModalOpen, setIsEditKpModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);


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
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        setTimeout(() => setImportMessage(null), 7000); // Clear message after 7s (increased for longer messages)
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
              <WordInputForm onAddWord={addWord} />
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
              onEditKnowledgePoint={openEditKpModal}
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
              onEditKnowledgePoint={openEditKpModal}
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
    </div>
  );
};

export default App;