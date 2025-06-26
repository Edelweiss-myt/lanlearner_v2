
import React, { useState, useMemo } from 'react';
import { LearningItem, SyllabusItem, KnowledgePointItem } from '../../types';
import { Button } from '../common/Button';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import { SYLLABUS_PATH_SEPARATOR } from '../../constants'; // Removed SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID from here

interface StudyItemCardProps {
  item: LearningItem;
  isReviewMode: boolean;
  onRemembered?: (item: LearningItem) => void;
  onForgot?: (item: LearningItem) => void;
  onDeleteItem?: (id: string, type: 'word' | 'knowledge') => void;
  onEditItem?: (item: LearningItem) => void;
  allSyllabusItems?: SyllabusItem[];
  onMoveItemCategory?: (itemId: string, newSyllabusId: string | null) => void;
  selectedEbookContent: string | null;
  findExampleInEbook: (word: string, content: string | null) => string[];
  isDisplayingInNewSubjectContext?: boolean;
  onSyncToMainSyllabus?: (kpId: string) => void;
  contextualSyllabusRootId: string; // Added prop for dynamic root ID
}

export const StudyItemCard: React.FC<StudyItemCardProps> = ({
  item,
  isReviewMode,
  onRemembered,
  onForgot,
  onDeleteItem,
  onEditItem,
  allSyllabusItems,
  onMoveItemCategory,
  selectedEbookContent,
  findExampleInEbook,
  isDisplayingInNewSubjectContext,
  onSyncToMainSyllabus,
  contextualSyllabusRootId, // Destructured prop
}) => {
  const [showDetails, setShowDetails] = useState(!isReviewMode);
  const [showCategoryMove, setShowCategoryMove] = useState(false);

  const getSyllabusPathDisplay = (
    syllabusItemId: string | null,
    currentSyllabusItems: SyllabusItem[],
    currentContextRootId: string // Use passed root ID
  ): string => {
    if (!syllabusItemId || !currentSyllabusItems || currentSyllabusItems.length === 0) {
      return '未分类';
    }
    const pathParts: string[] = [];
    let currentId: string | null = syllabusItemId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const currentItem = currentSyllabusItems.find(s => s.id === currentId);
      if (currentItem && currentItem.id !== currentContextRootId) { // Use dynamic root ID
        pathParts.unshift(currentItem.title);
        currentId = currentItem.parentId === currentContextRootId ? null : currentItem.parentId; // Use dynamic root ID
      } else {
        currentId = null;
      }
    }
    return pathParts.length > 0 ? pathParts.join(SYLLABUS_PATH_SEPARATOR) : '未分类';
  };

  const syllabusPath = useMemo(() => {
    if (item.type === 'knowledge' && allSyllabusItems) {
      return getSyllabusPathDisplay(item.syllabusItemId, allSyllabusItems, contextualSyllabusRootId);
    }
    return '';
  }, [item, allSyllabusItems, contextualSyllabusRootId]);

  const isHighFrequency = useMemo(() => {
    if (item.type === 'word' && selectedEbookContent) {
      const examples = findExampleInEbook(item.text, selectedEbookContent);
      return examples.length > 5;
    }
    return false;
  }, [item, selectedEbookContent, findExampleInEbook]);

  const handleDelete = () => {
    const itemIdentifier = item.type === 'word' ? item.text : item.title;
    const confirmMessage = `您确定要删除这个${item.type === 'word' ? '单词' : '知识点'}：“${itemIdentifier}”吗？此项目将被移至“最近删除”，可在24小时内恢复。`;
    if (window.confirm(confirmMessage)) {
      onDeleteItem?.(item.id, item.type);
    }
  };

  const wordSpecificDetails = item.type === 'word' ? (
    <>
      <p className="text-sm text-gray-600"><strong className="font-medium text-gray-700">词性:</strong> {item.partOfSpeech}</p>
      <p className="text-sm text-gray-600"><strong className="font-medium text-gray-700">释义:</strong> {item.definition}</p>
      {item.exampleSentence && <p className="text-sm text-gray-600 italic"><strong className="font-medium text-gray-700 not-italic">例句:</strong> {item.exampleSentence}</p>}
    </>
  ) : null;

  const knowledgePointSpecificDetails = item.type === 'knowledge' ? (
    <>
      <p className="text-sm text-gray-600 whitespace-pre-wrap break-words"><strong className="font-medium text-gray-700">内容:</strong> {item.content}</p>
      <p className="text-sm text-gray-500 mt-1"><strong className="font-medium text-gray-700">分类:</strong> {syllabusPath}</p>
    </>
  ) : null;

  const toggleDetails = () => setShowDetails(!showDetails);
  const handleEdit = () => onEditItem?.(item);
  const openMoveModal = () => setShowCategoryMove(prev => !prev);

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div>
          {item.type === 'word' ? (
            <h4 className={`text-lg font-semibold break-all ${isHighFrequency ? 'text-red-700' : 'text-gray-800'}`}>
              {item.text}
            </h4>
          ) : (
            <h4 className="text-lg font-semibold break-words text-gray-800">{item.title}</h4>
          )}
        </div>
      </div>

      {((isReviewMode && showDetails) || (!isReviewMode && showDetails)) && (
        <div id={`details-${item.id}`} className="mt-2 space-y-1">
          {wordSpecificDetails}
          {knowledgePointSpecificDetails}
          {item.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap break-words"><strong className="font-medium text-gray-700">备注:</strong> {item.notes}</p>}
          <div className="text-xs text-gray-400 pt-1">
            <span>创建于: {formatDate(new Date(item.createdAt))}</span>
            {item.lastReviewedAt && <span className="ml-2">上次复习: {timeAgo(new Date(item.lastReviewedAt))}</span>}
            {item.nextReviewAt && <span className="ml-2">下次复习: {formatDate(new Date(item.nextReviewAt))} (复习次数: {item.srsStage})</span>}
          </div>
        </div>
      )}
      
      <div className="mt-4">
        {isReviewMode ? (
          <div className="flex space-x-2">
            {!showDetails && (
              <Button onClick={toggleDetails} variant="secondary" size="sm" className="flex-1">
                显示答案
              </Button>
            )}
            {showDetails && (
              <>
                <Button onClick={() => onRemembered?.(item)} variant="primary" size="sm" className="flex-1 bg-green-500 hover:bg-green-600">
                  记住了 👍
                </Button>
                <Button onClick={() => onForgot?.(item)} variant="danger" size="sm" className="flex-1">
                  忘记了 👎
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-between items-center">
              <Button onClick={toggleDetails} variant="ghost" size="sm">
                {showDetails ? '隐藏详情' : '显示详情'}
              </Button>
              <div className="flex space-x-1 items-center">
                {onEditItem && (
                    <Button onClick={handleEdit} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                        编辑
                    </Button>
                )}
                {item.type === 'knowledge' && onMoveItemCategory && allSyllabusItems && (
                    <div className="relative">
                        <Button onClick={openMoveModal} variant="ghost" size="sm" className="text-secondary-600 hover:text-secondary-700">
                            移动分类
                        </Button>
                        {showCategoryMove && (
                            <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                            <button
                                onClick={() => { onMoveItemCategory(item.id, null); setShowCategoryMove(false); }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                移至 未分类
                            </button>
                            {allSyllabusItems.filter(si => si.id !== contextualSyllabusRootId).map(cat => (
                                <button
                                key={cat.id}
                                onClick={() => { onMoveItemCategory(item.id, cat.id); setShowCategoryMove(false); }}
                                className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                {getSyllabusPathDisplay(cat.id, allSyllabusItems, contextualSyllabusRootId)}
                                </button>
                            ))}
                            </div>
                        )}
                    </div>
                )}
                {isDisplayingInNewSubjectContext && item.type === 'knowledge' && onSyncToMainSyllabus && (
                  <Button
                    onClick={() => onSyncToMainSyllabus(item.id)}
                    variant="ghost"
                    size="sm"
                    className="text-teal-600 hover:text-teal-700 text-xs px-1 py-0.5"
                    title={`同步此知识点至主大纲`}
                    aria-label={`同步知识点 "${(item as KnowledgePointItem).title}" 至主大纲`}
                  >
                    同步至主大纲
                  </Button>
                )}
                {onDeleteItem && (
                    <Button onClick={handleDelete} variant="danger" size="sm">
                        删除
                    </Button>
                )}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};
