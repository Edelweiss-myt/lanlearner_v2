import React, { useState, useEffect, useRef } from 'react';
import { WordItem, WordDefinition, Ebook } from '../../types';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { fetchWordDefinition } from '../../services/geminiService';
import { findOfflineWord } from '../../offlineDictionary';
import { findExampleInEbook } from '../../utils/ebookUtils';

interface WordInputFormProps {
  onAddWord: (word: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'>) => void;
  ebooks: Ebook[];
  selectedEbookForLookupId: string | null;
  onSelectEbookForLookup: (ebookId: string | null) => void;
}

const API_LOOKUP_TIMEOUT_MS = 4000; // 4 seconds

export const WordInputForm: React.FC<WordInputFormProps> = ({
  onAddWord,
  ebooks,
  selectedEbookForLookupId,
  onSelectEbookForLookup
}) => {
  const [wordText, setWordText] = useState('');
  const [currentDefinition, setCurrentDefinition] = useState<WordDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lookupStatusMessage, setLookupStatusMessage] = useState<string | null>(null);

  const [manualDefinition, setManualDefinition] = useState('');
  const [manualPartOfSpeech, setManualPartOfSpeech] = useState('');
  const [manualExample, setManualExample] = useState('');
  const [allowManualInput, setAllowManualInput] = useState(false);
  
  const [ebookExampleSentences, setEbookExampleSentences] = useState<string[]>([]);
  const [selectedEbookExampleRadioIndex, setSelectedEbookExampleRadioIndex] = useState<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const clearFormStates = (clearWord: boolean = true) => {
    if (clearWord) setWordText(''); // This will trigger the useEffect for ebook examples
    setCurrentDefinition(null);
    setError(null);
    setNotes('');
    // lookupStatusMessage, ebookExampleSentences, selectedEbookExampleRadioIndex are handled by useEffect or word input onChange
    clearManualFields();
    setAllowManualInput(false);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  };
  
  const clearManualFields = () => {
    setManualDefinition('');
    setManualPartOfSpeech('');
    setManualExample('');
  };

  // Effect to automatically lookup examples from selected e-book when wordText or selectedEbookForLookupId changes
  useEffect(() => {
    const trimmedWord = wordText.trim();
    let ebookStatus = "";

    if (!trimmedWord || !selectedEbookForLookupId) {
      setEbookExampleSentences([]);
      setSelectedEbookExampleRadioIndex(null);
      if (trimmedWord && !selectedEbookForLookupId) {
        ebookStatus = "请选择一本电子书以查找例句。";
      } else if (!trimmedWord && selectedEbookForLookupId) {
        ebookStatus = "请输入单词以从选定电子书查找例句。";
      } else {
        ebookStatus = ""; // Default empty state, no explicit prompt needed unless both are missing
      }
      setLookupStatusMessage(ebookStatus);
      return;
    }

    const ebookToSearch = ebooks.find(eb => eb.id === selectedEbookForLookupId);

    if (!ebookToSearch || !ebookToSearch.content || ebookToSearch.content.trim().length === 0) {
      setEbookExampleSentences([]);
      setSelectedEbookExampleRadioIndex(null);
      ebookStatus = ebookToSearch ? `选中的电子书 "${ebookToSearch.name}" 内容为空。` : "未找到选中的电子书。";
      setLookupStatusMessage(ebookStatus);
      return;
    }

    const examples = findExampleInEbook(trimmedWord, ebookToSearch.content);
    setEbookExampleSentences(examples);

    if (examples.length > 0) {
      setSelectedEbookExampleRadioIndex(0);
      ebookStatus = `从电子书 "${ebookToSearch.name}" 找到 ${examples.length} 个关于 "${trimmedWord}" 的例句。`;
    } else {
      setSelectedEbookExampleRadioIndex(null);
      ebookStatus = `在电子书 "${ebookToSearch.name}" 中未找到关于 "${trimmedWord}" 的例句。`;
    }
    setLookupStatusMessage(ebookStatus);

  }, [wordText, selectedEbookForLookupId, ebooks]);


  const handleLookupDefinition = async () => {
    const trimmedWord = wordText.trim();
    if (!trimmedWord) {
      setError('请输入单词。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCurrentDefinition(null);
    setAllowManualInput(false);
    clearManualFields();
    // E-book lookup is now handled by the useEffect above.
    // lookupStatusMessage should already reflect the e-book search status.

    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    let initialExampleForFields: string | null = null;
    if (selectedEbookExampleRadioIndex !== null && ebookExampleSentences[selectedEbookExampleRadioIndex]) {
      initialExampleForFields = ebookExampleSentences[selectedEbookExampleRadioIndex];
    }
    
    let currentLookupStatus = lookupStatusMessage || ""; // Get status from e-book useEffect
    if (currentLookupStatus.length > 0 && !currentLookupStatus.endsWith(". ") && !currentLookupStatus.endsWith("。 ")) {
        currentLookupStatus += ". ";
    }


    const offlineMatch = findOfflineWord(trimmedWord);
    if (offlineMatch) {
      setCurrentDefinition({
        definition: offlineMatch.chinese,
        partOfSpeech: offlineMatch.partOfSpeech || 'N/A',
        example: initialExampleForFields || offlineMatch.example || '',
      });
      setLookupStatusMessage(currentLookupStatus + '释义来自离线词库。');
      setIsLoading(false);
      return;
    }

    setLookupStatusMessage(currentLookupStatus + '正在在线查询释义...');
    try {
      const timeoutPromise = new Promise<WordDefinition>((_, reject) => {
        timeoutIdRef.current = window.setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, API_LOOKUP_TIMEOUT_MS);
      });

      const result = await Promise.race([
        fetchWordDefinition(trimmedWord),
        timeoutPromise
      ]);
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (result.error) {
        setError(result.error);
        setAllowManualInput(true);
        if (initialExampleForFields) setManualExample(initialExampleForFields);
        setLookupStatusMessage(currentLookupStatus + `在线查询失败: ${result.error}. 请手动输入释义。`);
      } else {
        setCurrentDefinition({
          ...result,
          example: initialExampleForFields || result.example || '',
        });
        setAllowManualInput(false);
        clearManualFields();
        setLookupStatusMessage(currentLookupStatus + '释义来自在线查询。');
      }
    } catch (err: any) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      console.error('Failed to fetch definition via API or timed out:', err);
      let specificError = '查询释义时发生未知错误。';
      if (err.message === 'TIMEOUT') {
        specificError = `在线查询超时（超过 ${API_LOOKUP_TIMEOUT_MS / 1000} 秒）。`;
      } else if (err instanceof Error) {
        specificError = err.message;
      }
      
      setError(specificError);
      setAllowManualInput(true);
      if (initialExampleForFields) setManualExample(initialExampleForFields);
      setLookupStatusMessage(currentLookupStatus + `${specificError} 请手动输入释义。`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEbookExampleRadioSelection = (index: number) => {
    setSelectedEbookExampleRadioIndex(index);
  };
  
  useEffect(() => {
    if (selectedEbookExampleRadioIndex !== null && ebookExampleSentences[selectedEbookExampleRadioIndex]) {
      const selectedSentence = ebookExampleSentences[selectedEbookExampleRadioIndex];
      if (currentDefinition && !allowManualInput) {
        setCurrentDefinition(prevDef => prevDef ? { ...prevDef, example: selectedSentence } : null);
      } else if (allowManualInput) {
        setManualExample(selectedSentence);
      }
    }
  }, [selectedEbookExampleRadioIndex, ebookExampleSentences, currentDefinition, allowManualInput]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedWordText = wordText.trim();

    if (!trimmedWordText) {
      setError('请输入单词。');
      return;
    }

    let finalExampleSentence = "";
    // Prioritize radio selected e-book example
    if (selectedEbookExampleRadioIndex !== null && ebookExampleSentences[selectedEbookExampleRadioIndex]) {
        finalExampleSentence = ebookExampleSentences[selectedEbookExampleRadioIndex];
    }
    // If not, use example from current definition (API/Offline), which might have been updated by radio selection if it was populated first
    else if (currentDefinition && currentDefinition.example) {
        finalExampleSentence = currentDefinition.example;
    }
    // Fallback to manual example if manual input is active
    else if (allowManualInput && manualExample.trim()) {
        finalExampleSentence = manualExample.trim();
    }


    let wordDataToAdd: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'> | null = null;

    if (currentDefinition && currentDefinition.definition && currentDefinition.partOfSpeech) {
      wordDataToAdd = {
        text: trimmedWordText,
        definition: currentDefinition.definition,
        partOfSpeech: currentDefinition.partOfSpeech,
        exampleSentence: finalExampleSentence,
        notes: notes.trim() || undefined,
      };
    } else if (allowManualInput && manualDefinition.trim() && manualPartOfSpeech.trim()) {
      wordDataToAdd = {
        text: trimmedWordText,
        definition: manualDefinition.trim(),
        partOfSpeech: manualPartOfSpeech.trim(),
        exampleSentence: finalExampleSentence,
        notes: notes.trim() || undefined,
      };
    } else {
      let formError = '请先查询释义或手动填写必填项。';
       if (isLoading) {
           formError = '请等待当前查询操作完成。';
       } else if (!trimmedWordText) {
           formError = '请输入单词。';
       } else if (allowManualInput && (!manualDefinition.trim() || !manualPartOfSpeech.trim())) {
           formError = '手动输入时，释义和词性为必填项。';
       } else if (!currentDefinition && !allowManualInput){
           formError = '请点击“查询释义”按钮。如果查询失败，系统将允许您手动输入。';
       }
      setError(formError);
      return;
    }

    if (wordDataToAdd) {
      onAddWord(wordDataToAdd);
      clearFormStates(true);
    }
  };
  
  const isAddDisabled = isLoading || !wordText.trim() ||
    !( (currentDefinition && currentDefinition.definition && currentDefinition.partOfSpeech) ||
       (allowManualInput && manualDefinition.trim() && manualPartOfSpeech.trim()) );


  useEffect(() => {
    // This effect handles cleanup if the component unmounts while a timeout is pending.
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);


  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-xl font-semibold mb-4 text-gray-700">添加新单词</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="word" className="block text-sm font-medium text-gray-700">单词</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              name="word"
              id="word"
              value={wordText}
              onChange={(e) => {
                setWordText(e.target.value); // Triggers useEffect for e-book examples
                // Clear states related to a full lookup of the *previous* word
                setCurrentDefinition(null);
                setError(null);
                setAllowManualInput(false);
                clearManualFields();
                if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                    timeoutIdRef.current = null;
                }
              }}
              className="focus:ring-primary-500 focus:border-primary-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 p-2"
              placeholder="例如: serendipity"
            />
            <Button type="button" onClick={handleLookupDefinition} isLoading={isLoading} disabled={isLoading || !wordText.trim()} className="rounded-l-none">
              {isLoading ? '查询中...' : '查询释义'}
            </Button>
          </div>
        </div>

        { /* E-book related UI elements - they will react to state changes from useEffects */ }
        <div className="mt-2">
            <label htmlFor="ebook-select" className="block text-sm font-medium text-gray-700 mb-1">
              选择电子书查找例句 (可选)
            </label>
            <select
              id="ebook-select"
              value={selectedEbookForLookupId || ''}
              onChange={(e) => onSelectEbookForLookup(e.target.value || null)} // Triggers useEffect
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm"
              disabled={isLoading}
            >
              <option value="">不使用电子书</option>
              {ebooks.map(ebook => (
                <option key={ebook.id} value={ebook.id}>
                  {ebook.name}
                </option>
              ))}
            </select>
        </div>

        {lookupStatusMessage && !isLoading && <p className="text-xs text-indigo-700 mt-1 mb-0 italic">{lookupStatusMessage}</p>}
        
        {isLoading && <div className="py-4"><LoadingSpinner text={lookupStatusMessage?.includes("正在在线查询") ? lookupStatusMessage : "处理中..."} /></div>}
        
        {error && !isLoading && <p className="text-sm text-red-600 py-2">{error}</p>}
        
        {currentDefinition && !isLoading && (
          <div className="mt-4 p-4 bg-primary-50 rounded-md border border-primary-200">
            {/* lookupStatusMessage is shown globally now */}
            <p><strong>释义：</strong> {currentDefinition.definition}</p>
            <p><strong>词性：</strong> {currentDefinition.partOfSpeech}</p>
            <p><strong>例句：</strong> {currentDefinition.example || (lookupStatusMessage?.includes("离线") && !lookupStatusMessage?.includes("电子书") && ebookExampleSentences.length === 0 ? <span className="text-gray-500 italic">离线词库未提供例句</span> : <span className="text-gray-500 italic">无例句</span>) }</p>
          </div>
        )}
        
        {ebookExampleSentences.length > 0 && !isLoading && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-md border border-indigo-200">
            <h5 className="text-sm font-semibold text-indigo-800 mb-2">来自电子书的例句 ({ebookExampleSentences.length}): 选择一个添加到学习列表</h5>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {ebookExampleSentences.map((ex, index) => (
                <label key={index} className="flex items-start p-2 rounded-md hover:bg-indigo-100 cursor-pointer">
                  <input
                    type="radio"
                    name="ebookExample"
                    value={index}
                    checked={selectedEbookExampleRadioIndex === index}
                    onChange={() => handleEbookExampleRadioSelection(index)}
                    className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500 mt-0.5"
                  />
                  <span className="ml-2 text-xs text-indigo-700"><em>{ex}</em></span>
                </label>
              ))}
            </div>
          </div>
        )}

        {allowManualInput && !currentDefinition?.definition && !isLoading && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-300 space-y-3">
            <h4 className="text-sm font-medium text-yellow-800">{lookupStatusMessage?.includes("在线查询失败") || lookupStatusMessage?.includes("超时") ? lookupStatusMessage : "请手动输入释义信息："}</h4>
            <div>
              <label htmlFor="manual-definition" className="block text-xs font-medium text-gray-700">释义 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="manual-definition"
                value={manualDefinition}
                onChange={(e) => setManualDefinition(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                placeholder="手动输入释义"
              />
            </div>
            <div>
              <label htmlFor="manual-pos" className="block text-xs font-medium text-gray-700">词性 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="manual-pos"
                value={manualPartOfSpeech}
                onChange={(e) => setManualPartOfSpeech(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                placeholder="例如：名词, 动词"
              />
            </div>
            <div>
              <label htmlFor="manual-example" className="block text-xs font-medium text-gray-700">例句</label>
              <textarea
                id="manual-example"
                rows={2}
                value={manualExample}
                onChange={(e) => setManualExample(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                placeholder="手动输入例句 (可选，或从上方电子书例句选择)"
              ></textarea>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="word-notes" className="block text-sm font-medium text-gray-700">备注 (可选)</label>
          <textarea
            id="word-notes"
            name="word-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="关于这个单词的任何额外备注..."
          ></textarea>
        </div>
        
        <Button type="submit" disabled={isAddDisabled} className="w-full">
          添加到学习列表
        </Button>
      </form>
    </div>
  );
};
