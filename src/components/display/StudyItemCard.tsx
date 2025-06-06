import React, { useState } from 'react';
import { WordItem, KnowledgePointItem, SyllabusItem } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { formatDate, timeAgo } from '../../utils/dateUtils';
import { SYLLABUS_ROOT_ID } from '../../constants';

interface StudyItemCardProps {
  item: WordItem | KnowledgePointItem;
  onRemembered: (item: WordItem | KnowledgePointItem) => void;
  onForgot: (item: WordItem | KnowledgePointItem) => void;
  onDeleteItem?: (id: string, type: 'word' | 'knowledge') => void;
  isReviewMode: boolean;
  allSyllabusItems?: SyllabusItem[]; 
  onMoveItemCategory?: (itemId: string, newSyllabusId: string | null) => void;
  onEditItem?: (item: WordItem | KnowledgePointItem) => void; // Added for editing KP
}

export const StudyItemCard: React.FC<StudyItemCardProps> = ({ 
    item, 
    onRemembered, 
    onForgot, 
    onDeleteItem, 
    isReviewMode,
    allSyllabusItems,
    onMoveItemCategory,
    onEditItem
}) => {
  const [showDetails, setShowDetails] = useState(!isReviewMode);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveSyllabusId, setTargetMoveSyllabusId] = useState<string | null>(null);

  const toggleDetails = () => {
    if (isReviewMode) {
      setShowDetails(true);
    } else {
        setShowDetails(!showDetails);
    }
  };
  
  const handleDelete = () => {
    const itemTypeDisplay = item.type === 'word' ? '单词' : '知识点';
    if (onDeleteItem && window.confirm(`您确定要删除这个${itemTypeDisplay}：“${item.type === 'word' ? item.text : item.title}”吗？此操作无法撤销。`)) {
        onDeleteItem(item.id, item.type);
    }
  };

  const openMoveModal = () => {
    if (item.type === 'knowledge') {
        setTargetMoveSyllabusId(item.syllabusItemId || null);
        setIsMoveModalOpen(true);
    }
  };

  const handleSaveCategoryMove = () => {
    if (item.type === 'knowledge' && onMoveItemCategory) {
        onMoveItemCategory(item.id, targetMoveSyllabusId);
    }
    setIsMoveModalOpen(false);
  };
  
  const renderSyllabusOptionsForMove = (items: SyllabusItem[], parentId: string | null = null, depth = 0): React.ReactNode[] => {
    const children = items.filter(i => {
        if (parentId === null) return !i.parentId && i.id !== SYLLABUS_ROOT_ID; 
        return i.parentId === parentId && i.id !== SYLLABUS_ROOT_ID;
    });
    
    let options: React.ReactNode[] = [];
    children.forEach(sItem => {
      options.push(
        <option key={sItem.id} value={sItem.id}>
          {'\u00A0'.repeat(depth * 4) + sItem.title}
        </option>
      );
      options = options.concat(renderSyllabusOptionsForMove(items, sItem.id, depth + 1));
    });
    return options;
  };

  const handleEdit = () => {
    if (onEditItem) {
        onEditItem(item);
    }
  };

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-4">
        {item.type === 'word' ? (
          <>
            <h4 className="text-lg font-semibold text-primary-700">{item.text}</h4>
            {showDetails && (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p><strong>词性：</strong> {item.partOfSpeech}</p>
                <p><strong>释义：</strong> {item.definition}</p>
                <p><strong>例句：</strong> <em>{item.exampleSentence}</em></p>
              </div>
            )}
          </>
        ) : (
          <>
            <h4 className="text-lg font-semibold text-primary-700">{item.title}</h4>
            {showDetails && (
              <div className="mt-2 space-y-1 text-sm text-gray-600 prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            )}
          </>
        )}
          
        {item.type === 'word' && onEditItem && !isReviewMode && ( // onEditItem 也需要传递给单词卡片
              <Button onClick={handleEdit} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                  编辑
              </Button>
        )}

        {showDetails && item.notes && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            <strong>备注：</strong> <span className="whitespace-pre-wrap">{item.notes}</span>
          </div>
        )}
        
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-1">
          <p>复习阶段: {item.srsStage}</p>
          <p>上次复习: {item.lastReviewedAt ? timeAgo(new Date(item.lastReviewedAt)) : '从未'}</p>
          <p>下次复习: {item.nextReviewAt ? formatDate(new Date(item.nextReviewAt)) : '稍后安排'}</p>
           {item.type === 'knowledge' && allSyllabusItems && (
                <p>分类: {item.syllabusItemId ? allSyllabusItems.find(si => si.id === item.syllabusItemId)?.title || '未知分类' : '未分类'}</p>
            )}
        </div>

        {isReviewMode ? (
          <div className="mt-4 flex space-x-2">
            {!showDetails && (
              <Button onClick={toggleDetails} variant="secondary" size="sm" className="flex-1">
                显示答案
              </Button>
            )}
            {showDetails && (
              <>
                <Button onClick={() => onRemembered(item)} variant="primary" size="sm" className="flex-1 bg-green-500 hover:bg-green-600">
                  记住了 👍
                </Button>
                <Button onClick={() => onForgot(item)} variant="danger" size="sm" className="flex-1">
                  忘记了 👎
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 flex justify-between items-center">
              <Button onClick={toggleDetails} variant="ghost" size="sm">
                {showDetails ? '隐藏详情' : '显示详情'}
              </Button>
              <div className="flex space-x-1">
                {item.type === 'knowledge' && onEditItem && (
                    <Button onClick={handleEdit} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                        编辑
                    </Button>
                )}
                {item.type === 'knowledge' && onMoveItemCategory && allSyllabusItems && (
                    <Button onClick={openMoveModal} variant="ghost" size="sm" className="text-secondary-600 hover:text-secondary-700">
                        移动分类
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

      {item.type === 'knowledge' && allSyllabusItems && (
         <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title={`移动知识点: "${item.title}"`}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="kp-new-category" className="block text-sm font-medium text-gray-700">新分类</label>
                    <select
                        id="kp-new-category"
                        value={targetMoveSyllabusId || ''}
                        onChange={(e) => setTargetMoveSyllabusId(e.target.value || null)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                        <option value="">-- 无分类 --</option>
                        {renderSyllabusOptionsForMove(allSyllabusItems.filter(si => si.id !== SYLLABUS_ROOT_ID))}
                    </select>
                </div>
                <div className="flex justify-end space-x-2">
                    <Button onClick={() => setIsMoveModalOpen(false)} variant="ghost">取消</Button>
                    <Button onClick={handleSaveCategoryMove}>保存更改</Button>
                </div>
            </div>
         </Modal>
      )}
    </>
  );
};
