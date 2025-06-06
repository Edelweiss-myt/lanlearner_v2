import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { WordItem, KnowledgePointItem, LearningItem, SyllabusItem } from '../../types';
import { StudyItemCard } from '../display/StudyItemCard';
import { SRS_INTERVALS_DAYS, MAX_SRS_STAGE } from '../../constants';
import { addDays, getTodayDateString } from '../../utils/dateUtils';
import { Button } from '../common/Button';

interface ReviewDashboardProps {
  words: WordItem[];
  knowledgePoints: KnowledgePointItem[];
  onUpdateItem: (item: WordItem | KnowledgePointItem) => void;
  onDeleteItem: (id: string, type: 'word' | 'knowledge') => void;
  onReviewSessionCompleted: () => void;
  allSyllabusItems?: SyllabusItem[];
  onMoveKnowledgePointCategory?: (itemId: string, newSyllabusId: string | null) => void;
  onEditItem?: (item: LearningItem) => void;
}

type FilterType = 'all' | 'word' | 'knowledge';

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
    words,
    knowledgePoints,
    onUpdateItem,
    onDeleteItem,
    onReviewSessionCompleted,
    allSyllabusItems,
    onMoveKnowledgePointCategory,
    onEditItem
}) => {
  const allItems: LearningItem[] = useMemo(() => [...words, ...knowledgePoints], [words, knowledgePoints]);
  
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');

  const itemsDueForReview = useMemo(() => {
    const today = getTodayDateString();
    return allItems
      .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
  }, [allItems]);

  const prevItemsDueCountRef = useRef(itemsDueForReview.length);

  useEffect(() => {
    if (prevItemsDueCountRef.current > 0 && itemsDueForReview.length === 0 && !showAll) {
      // Only trigger session completed if not in "show all" mode,
      // as "show all" mode is for browsing, not active review session.
      onReviewSessionCompleted();
    }
    prevItemsDueCountRef.current = itemsDueForReview.length;
  }, [itemsDueForReview.length, onReviewSessionCompleted, showAll]);


  const upcomingItems = useMemo(() => {
     const today = getTodayDateString();
     return allItems
      .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] > today)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime())
      .slice(0, 5);
  }, [allItems]);


  const handleRemembered = useCallback((item: LearningItem) => {
    const newSrsStage = Math.min(item.srsStage + 1, MAX_SRS_STAGE);
    const reviewInterval = SRS_INTERVALS_DAYS[newSrsStage] ?? SRS_INTERVALS_DAYS[MAX_SRS_STAGE];
    const nextReviewDate = addDays(getTodayDateString(), reviewInterval);

    onUpdateItem({
      ...item,
      srsStage: newSrsStage,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: nextReviewDate.toISOString(),
    });
  }, [onUpdateItem]);

  const handleForgot = useCallback((item: LearningItem) => {
    const newSrsStage = 0;
    const nextReviewDate = addDays(getTodayDateString(), SRS_INTERVALS_DAYS[newSrsStage]);
    
    onUpdateItem({
      ...item,
      srsStage: newSrsStage,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: nextReviewDate.toISOString(),
    });
  }, [onUpdateItem]);

  const displayedItems = useMemo(() => {
    if (showAll) {
      let itemsToDisplay = allItems;
      if (filterType === 'word') {
        itemsToDisplay = allItems.filter(item => item.type === 'word');
      } else if (filterType === 'knowledge') {
        itemsToDisplay = allItems.filter(item => item.type === 'knowledge');
      }
      return itemsToDisplay.sort((a,b) => (a.createdAt && b.createdAt) ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : (a.createdAt ? -1 : 1)); // Sort by newest first for "Show All"
    }
    return itemsDueForReview; // Already sorted by nextReviewAt for due items
  }, [allItems, itemsDueForReview, showAll, filterType]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">
          {showAll ? "所有项目" : "今日复习"}
          {!showAll && ` (${itemsDueForReview.length})`}
          {showAll && ` (${displayedItems.length}${filterType !== 'all' ? ` ${filterType === 'word' ? '单词' : '知识点'}` : ''} / ${allItems.length} 总计)`}
        </h3>
         <Button
            onClick={() => {
              setShowAll(!showAll);
              if (showAll) setFilterType('all'); // Reset filter when switching from "Show All" to "Due"
            }}
            variant="ghost"
          >
            {showAll ? `仅显示到期 (${itemsDueForReview.length})` : `显示全部 (${allItems.length})`}
          </Button>
      </div>

      {showAll && (
        <div className="my-3 flex items-center space-x-2 border-b pb-3 mb-3">
          <span className="text-sm font-medium text-gray-600">筛选:</span>
          <Button
            variant={filterType === 'all' ? 'primary' : 'ghost'}
            onClick={() => setFilterType('all')}
            size="sm"
            aria-pressed={filterType === 'all'}
          >
            全部 ({allItems.length})
          </Button>
          <Button
            variant={filterType === 'word' ? 'primary' : 'ghost'}
            onClick={() => setFilterType('word')}
            size="sm"
            aria-pressed={filterType === 'word'}
          >
            单词 ({words.length})
          </Button>
          <Button
            variant={filterType === 'knowledge' ? 'primary' : 'ghost'}
            onClick={() => setFilterType('knowledge')}
            size="sm"
            aria-pressed={filterType === 'knowledge'}
          >
            知识点 ({knowledgePoints.length})
          </Button>
        </div>
      )}

      {displayedItems.length > 0 ? (
        <div className="space-y-4">
          {displayedItems.map(item => (
            <StudyItemCard
              key={item.id}
              item={item}
              onRemembered={handleRemembered}
              onForgot={handleForgot}
              onDeleteItem={showAll ? onDeleteItem : undefined} // Only allow delete in "Show All" mode
              isReviewMode={!showAll && itemsDueForReview.some(dueItem => dueItem.id === item.id)} // Review mode if not showAll AND item is due
              allSyllabusItems={allSyllabusItems} // Pass allSyllabusItems for KP category display/move
              onMoveItemCategory={showAll && item.type === 'knowledge' ? onMoveKnowledgePointCategory : undefined}
              onEditItem={showAll ? onEditItem : undefined} // Only allow edit in "Show All" mode
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-600">
            {showAll ? (filterType === 'all' ? "尚未添加任何项目。开始学习新内容吧！" : `没有符合当前筛选条件的${filterType === 'word' ? '单词' : '知识点'}。`) : "目前没有到期的复习项。太棒了！🎉"}
        </p>
      )}
      
      {!showAll && itemsDueForReview.length === 0 && upcomingItems.length > 0 && (
        <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-600 mb-2">即将复习 (接下来5个):</h4>
            <div className="space-y-3">
            {upcomingItems.map(item => (
                 <StudyItemCard // Upcoming items are not in "review mode" but can be viewed/edited/deleted
                    key={item.id}
                    item={item}
                    onRemembered={handleRemembered}
                    onForgot={handleForgot}
                    onDeleteItem={onDeleteItem}
                    isReviewMode={false}
                    allSyllabusItems={allSyllabusItems}
                    onMoveItemCategory={item.type === 'knowledge' ? onMoveKnowledgePointCategory : undefined}
                    onEditItem={onEditItem}
                />
            ))}
            </div>
        </div>
      )}
       {!showAll && itemsDueForReview.length === 0 && upcomingItems.length === 0 && allItems.length > 0 && (
         <p className="text-gray-600 mt-4">所有项目都已复习完毕或已安排复习。可以去学习新内容了！</p>
       )}
    </div>
  );
};
