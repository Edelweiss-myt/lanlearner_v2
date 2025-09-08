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
  existingWords: WordItem[];
}

const API_LOOKUP_TIMEOUT_MS = 4000; // 4 seconds

export const WordInputForm: React.FC<WordInputFormProps> = ({
  onAddWord,
  ebooks,
  selectedEbookForLookupId,
  onSelectEbookForLookup,
  existingWords
}) => {
  const [wordText, setWordText] = useState('');
  const [currentDefinition, setCurrentDefinition] = useState<WordDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lookupStatusMessage, setLookupStatusMessage] = useState<string | null>(null);

  const [manualDefinition, setManualDefinition] = useState('');
  const [manualPartOfSpeech, setManualPartOfSpeech] = useState('');
  // const [manualExample, setManualExample] = useState(''); // REMOVED - Unused
  const [allowManualInput, setAllowManualInput] = useState(false);
  
  const [ebookExampleSentences, setEbookExampleSentences] = useState<string[]>([]);
  const [selectedEbookExampleRadioIndex, setSelectedEbookExampleRadioIndex] = useState<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  // This state will hold the example sentence that is displayed and edited by the user.
  const [displayExampleSentence, setDisplayExampleSentence] = useState('');
  
  // State to track existing word information
  const [existingWord, setExistingWord] = useState<WordItem | null>(null);
  const [showExistingWordInfo, setShowExistingWordInfo] = useState(false);


  const clearFormStates = (clearWord: boolean = true) => {
    if (clearWord) setWordText('');
    setCurrentDefinition(null);
    setError(null);
    setNotes('');
    setDisplayExampleSentence('');
    clearManualFields();
    setAllowManualInput(false);
    setExistingWord(null);
    setShowExistingWordInfo(false);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  };
  
  const clearManualFields = () => {
    setManualDefinition('');
    setManualPartOfSpeech('');
    // setManualExample(''); // REMOVED - Unused
  };

  // Function to check for existing word
  const checkExistingWord = (word: string) => {
    const trimmedWord = word.trim().toLowerCase();
    if (trimmedWord) {
      const found = existingWords.find(w => w.text.toLowerCase() === trimmedWord);
      if (found) {
        setExistingWord(found);
        setShowExistingWordInfo(true);
        // Pre-fill form with existing data
        setNotes(found.notes || '');
        setDisplayExampleSentence(found.exampleSentence || '');
      } else {
        setExistingWord(null);
        setShowExistingWordInfo(false);
      }
    } else {
      setExistingWord(null);
      setShowExistingWordInfo(false);
    }
  };

  useEffect(() => {
    const trimmedWord = wordText.trim();
    let ebookStatus = "";

    // Check for existing word
    checkExistingWord(trimmedWord);

    if (!trimmedWord || !selectedEbookForLookupId) {
      setEbookExampleSentences([]);
      setSelectedEbookExampleRadioIndex(null);
      if (trimmedWord && !selectedEbookForLookupId) {
        // ebookStatus = "请选择一本电子书以查找例句。"; // REMOVED as per request
        ebookStatus = "";
      } else if (!trimmedWord && selectedEbookForLookupId) {
        ebookStatus = "请输入单词以从选定电子书查找例句。";
      } else {
        ebookStatus = "";
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
      setSelectedEbookExampleRadioIndex(0); // Auto-select first example
      setDisplayExampleSentence(examples[0]); // And set it to display
      ebookStatus = `从电子书 "${ebookToSearch.name}" 找到 ${examples.length} 个关于 "${trimmedWord}" 的例句。`;
    } else {
      setSelectedEbookExampleRadioIndex(null);
      // Don't clear displayExampleSentence here if it was populated by API/Offline
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
    
    const initialExampleFromEbook = ebookExampleSentences.length > 0 ? ebookExampleSentences[0] : '';
    setDisplayExampleSentence(initialExampleFromEbook);

    let initialStatusFromEbookEffect = lookupStatusMessage || "";
    // Ensure "请选择一本电子书以查找例句。" is not in initialStatusFromEbookEffect
    initialStatusFromEbookEffect = initialStatusFromEbookEffect.replace("请选择一本电子书以查找例句。", "").trim();


    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    const offlineMatch = findOfflineWord(trimmedWord);
    if (offlineMatch) {
      const def = {
        definition: offlineMatch.chinese,
        partOfSpeech: offlineMatch.partOfSpeech || 'N/A',
        example: offlineMatch.example || '',
      };
      setCurrentDefinition(def);
      setDisplayExampleSentence(initialExampleFromEbook || def.example);
      setLookupStatusMessage(initialStatusFromEbookEffect); // Display status from ebook effect, no ". 释义来自离线词库。"
      setIsLoading(false);
      return;
    }

    setLookupStatusMessage(
        initialStatusFromEbookEffect
        ? `${initialStatusFromEbookEffect}. 正在在线查询释义...`
        : '正在在线查询释义...'
    );

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
        // setManualExample(initialExampleFromEbook); // REMOVED - Unused (displayExampleSentence is set above)
        const failureMsg = `在线查询失败: ${result.error}. 请手动输入释义。`;
        setLookupStatusMessage(
            initialStatusFromEbookEffect
            ? `${initialStatusFromEbookEffect}. ${failureMsg}`
            : failureMsg
        );
      } else {
        setCurrentDefinition(result);
        setDisplayExampleSentence(initialExampleFromEbook || result.example || '');
        setAllowManualInput(false);
        clearManualFields();
        setLookupStatusMessage(initialStatusFromEbookEffect); // Display status from ebook effect, no ". 释义来自在线查询。"
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
      // setManualExample(initialExampleFromEbook); // REMOVED - Unused (displayExampleSentence is set above)
      const failureMsg = `${specificError}. 请手动输入释义。`;
      setLookupStatusMessage(
        initialStatusFromEbookEffect
        ? `${initialStatusFromEbookEffect}. ${failureMsg}`
        : failureMsg
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEbookExampleRadioSelection = (index: number) => {
    setSelectedEbookExampleRadioIndex(index);
    if (ebookExampleSentences[index]) {
      setDisplayExampleSentence(ebookExampleSentences[index]);
      // if (allowManualInput) { // REMOVED logic block - setManualExample was unused
      //   setManualExample(ebookExampleSentences[index]);
      // }
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedWordText = wordText.trim();

    if (!trimmedWordText) {
      setError('请输入单词。');
      return;
    }
    
    const finalExampleSentence = displayExampleSentence.trim();

    let wordDataToAdd: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'> | null = null;

    if (currentDefinition && currentDefinition.definition && currentDefinition.partOfSpeech && !allowManualInput) {
      wordDataToAdd = {
        text: trimmedWordText,
        definition: currentDefinition.definition.trim(),
        partOfSpeech: currentDefinition.partOfSpeech.trim(),
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
       } else if (currentDefinition && (!currentDefinition.definition.trim() || !currentDefinition.partOfSpeech.trim()) && !allowManualInput) {
           formError = '释义和词性为必填项。';
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
    !( (currentDefinition && currentDefinition.definition.trim() && currentDefinition.partOfSpeech.trim() && !allowManualInput) ||
       (allowManualInput && manualDefinition.trim() && manualPartOfSpeech.trim()) );


  useEffect(() => {
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
                setWordText(e.target.value);
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

        {/* Display existing word information */}
        {showExistingWordInfo && existingWord && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-blue-800">已保存的单词信息</h4>
              <span className="text-xs text-blue-600">再次添加将覆盖原数据</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-blue-700">释义：</span>
                <span className="text-blue-600">{existingWord.definition}</span>
              </div>
              <div>
                <span className="font-medium text-blue-700">词性：</span>
                <span className="text-blue-600">{existingWord.partOfSpeech}</span>
              </div>
              {existingWord.exampleSentence && (
                <div>
                  <span className="font-medium text-blue-700">例句：</span>
                  <span className="text-blue-600">{existingWord.exampleSentence}</span>
                </div>
              )}
              {existingWord.notes && (
                <div>
                  <span className="font-medium text-blue-700">备注：</span>
                  <span className="text-blue-600">{existingWord.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-2">
            <label htmlFor="ebook-select" className="block text-sm font-medium text-gray-700 mb-1">
              选择电子书查找例句 (可选)
            </label>
            <select
              id="ebook-select"
              value={selectedEbookForLookupId || ''}
              onChange={(e) => onSelectEbookForLookup(e.target.value || null)}
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
        
        {((currentDefinition && !allowManualInput) || allowManualInput) && !isLoading && (
          <div className={`mt-4 p-4 rounded-md border ${allowManualInput ? 'bg-yellow-50 border-yellow-300' : 'bg-primary-50 border-primary-200'}`}>
            {allowManualInput && (
              <h4 className="text-sm font-medium text-yellow-800 mb-2">{lookupStatusMessage?.includes("在线查询失败") || lookupStatusMessage?.includes("超时") ? lookupStatusMessage : "请手动输入释义信息："}</h4>
            )}
            
            {allowManualInput ? (
              <>
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
                <div className="mt-2">
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
              </>
            ) : currentDefinition && (
              <>
                <div>
                  <label htmlFor="current-definition" className="block text-xs font-medium text-gray-700">释义 <span className="text-red-500">*</span></label>
                  <textarea
                    id="current-definition"
                    value={currentDefinition.definition}
                    onChange={(e) => setCurrentDefinition(prevDef => prevDef ? { ...prevDef, definition: e.target.value } : null)}
                    className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                    placeholder="释义"
                    rows={2}
                  />
                </div>
                <div className="mt-2">
                  <label htmlFor="current-pos" className="block text-xs font-medium text-gray-700">词性 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="current-pos"
                    value={currentDefinition.partOfSpeech}
                    onChange={(e) => setCurrentDefinition(prevDef => prevDef ? { ...prevDef, partOfSpeech: e.target.value } : null)}
                    className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                    placeholder="例如：名词, 动词"
                  />
                </div>
              </>
            )}

            <div className="mt-2">
                <label htmlFor="display-example-sentence" className="block text-xs font-medium text-gray-700">例句</label>
                <textarea
                    id="display-example-sentence"
                    rows={3}
                    value={displayExampleSentence}
                    onChange={(e) => setDisplayExampleSentence(e.target.value)}
                    className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2"
                    placeholder="输入或选择例句..."
                />
            </div>
          </div>
        )}
        
        {ebookExampleSentences.length > 0 && !isLoading && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-md border border-indigo-200">
            <h5 className="text-sm font-semibold text-indigo-800 mb-2">来自电子书的例句 ({ebookExampleSentences.length}): 选择一个填充到上方可编辑例句框</h5>
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
