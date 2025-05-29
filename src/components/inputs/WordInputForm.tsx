import React, { useState, useEffect, useRef } from 'react';
import { WordItem, WordDefinition } from '../../types';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { fetchWordDefinition } from '../../services/geminiService';
import { findOfflineWord } from '../../offlineDictionary'; 

interface WordInputFormProps {
  onAddWord: (word: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'>) => void;
}

const API_LOOKUP_TIMEOUT_MS = 10000; // 10 seconds

export const WordInputForm: React.FC<WordInputFormProps> = ({ onAddWord }) => {
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

  // To keep track of the active timeout
  const timeoutIdRef = useRef<number | null>(null);

  const clearFormStates = (clearWord: boolean = true) => {
    if (clearWord) setWordText('');
    setCurrentDefinition(null);
    setError(null);
    setNotes('');
    setLookupStatusMessage(null);
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
    setLookupStatusMessage(null);

    // Clear any existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    // 1. Try offline dictionary first
    const offlineMatch = findOfflineWord(trimmedWord);
    if (offlineMatch) {
      setCurrentDefinition({
        definition: offlineMatch.chinese,
        partOfSpeech: offlineMatch.partOfSpeech || 'N/A',
        example: offlineMatch.example || '',
      });
      setLookupStatusMessage('释义来自离线词库。');
      setIsLoading(false);
      return;
    }

    // 2. If not found offline, try API with timeout
    setLookupStatusMessage('正在在线查询...');
    try {
      const timeoutPromise = new Promise<WordDefinition>((_, reject) => {
        timeoutIdRef.current = window.setTimeout(() => { // Use window.setTimeout for clarity in browser env
          reject(new Error('TIMEOUT'));
        }, API_LOOKUP_TIMEOUT_MS);
      });

      const result = await Promise.race([
        fetchWordDefinition(trimmedWord),
        timeoutPromise
      ]);
      
      // Clear timeout if fetchWordDefinition completed first
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (result.error) {
        setError(result.error);
        setAllowManualInput(true);
        setLookupStatusMessage(`在线查询失败。请手动输入释义，或检查API密钥/网络后重试。`);
      } else {
        setCurrentDefinition(result);
        setAllowManualInput(false); // API success, no manual input needed initially
        clearManualFields();
        setLookupStatusMessage('释义来自在线查询。');
      }
    } catch (err: any) {
      // Clear timeout in case of other errors from fetchWordDefinition itself
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      console.error('Failed to fetch definition via API or timed out:', err);
      let specificError = '查询释义时发生未知错误。';
      if (err.message === 'TIMEOUT') {
        specificError = `在线查询超时（超过 ${API_LOOKUP_TIMEOUT_MS / 1000} 秒）。`;
        setLookupStatusMessage(`${specificError} 请手动输入释义或稍后重试。`);
      } else if (err instanceof Error) {
        specificError = err.message;
        setLookupStatusMessage(`在线查询失败。请手动输入释义。 (${specificError})`);
      } else {
         setLookupStatusMessage('在线查询失败。请手动输入释义。');
      }
      
      setError(specificError);
      setAllowManualInput(true);
    } finally {
      setIsLoading(false);
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

    let wordDataToAdd: Omit<WordItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'> | null = null;

    if (currentDefinition && currentDefinition.definition && currentDefinition.partOfSpeech) {
      // Use definition from offline/online lookup
      wordDataToAdd = {
        text: trimmedWordText,
        definition: currentDefinition.definition,
        partOfSpeech: currentDefinition.partOfSpeech,
        exampleSentence: currentDefinition.example,
        notes: notes.trim() || undefined,
      };
    } else if (allowManualInput && manualDefinition.trim() && manualPartOfSpeech.trim()) {
      // Use manual input
      wordDataToAdd = {
        text: trimmedWordText,
        definition: manualDefinition.trim(),
        partOfSpeech: manualPartOfSpeech.trim(),
        exampleSentence: manualExample.trim(),
        notes: notes.trim() || undefined,
      };
    } else {
      // Not enough data to submit
      if (lookupStatusMessage?.includes('离线')) {
         setError('离线词库释义不完整。请尝试在线查询或手动填写。');
      } else if (allowManualInput) {
        setError('请手动填写释义、词性和例句，或尝试重新查询。');
      } else {
        setError('请先查询释义。如果查询失败，请手动填写必填项。');
      }
      return;
    }

    if (wordDataToAdd) {
      onAddWord(wordDataToAdd);
      clearFormStates(true); // Clear the whole form including word text
    }
  };
  
  const isAddDisabled = isLoading || !wordText.trim() || 
    !( (currentDefinition && currentDefinition.definition && currentDefinition.partOfSpeech) || 
       (allowManualInput && manualDefinition.trim() && manualPartOfSpeech.trim()) );


  useEffect(() => {
    // Reset states if wordText is cleared or significantly changed,
    // except for the wordText itself.
    if (wordText === '') {
      clearFormStates(false); // Don't clear wordText as it's already empty
    } else {
        // Optionally, could decide to clear dependent fields if wordText changes
        // after a lookup. For now, explicit lookup is required.
    }
     // Cleanup timeout on component unmount
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [wordText]);


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
                // Clear previous results when word changes to avoid confusion
                setCurrentDefinition(null);
                setLookupStatusMessage(null);
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

        {isLoading && <div className="py-4"><LoadingSpinner text={lookupStatusMessage || "正在查询..."} /></div>}
        
        {error && !isLoading && <p className="text-sm text-red-600 py-2">{error}</p>}
        
        {currentDefinition && !isLoading && (
          <div className="mt-4 p-4 bg-primary-50 rounded-md border border-primary-200">
            {lookupStatusMessage && <p className="text-xs text-primary-700 mb-1 italic">{lookupStatusMessage}</p>}
            <p><strong>释义：</strong> {currentDefinition.definition}</p>
            <p><strong>词性：</strong> {currentDefinition.partOfSpeech}</p>
            <p><strong>例句：</strong> {currentDefinition.example || (lookupStatusMessage?.includes("离线") ? <span className="text-gray-500 italic">离线词库未提供例句</span> : <span className="text-gray-500 italic">无例句</span>) }</p>
          </div>
        )}

        {allowManualInput && !currentDefinition?.definition && !isLoading && ( // Show manual input if API failed AND no successful currentDefinition
          <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-300 space-y-3">
            <h4 className="text-sm font-medium text-yellow-800">{lookupStatusMessage || "请手动输入释义信息："}</h4>
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
                placeholder="手动输入例句 (可选)"
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