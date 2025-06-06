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

  const itemsDueForReview = useMemo(() => {
    const today = getTodayDateString();
    return allItems
      .filter(item => item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today)
      .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
  }, [allItems]);

  const prevItemsDueCountRef = useRef(itemsDueForReview.length);

  useEffect(() => {
    if (prevItemsDueCountRef.current > 0 && itemsDueForReview.length === 0) {
      onReviewSessionCompleted();
    }
    prevItemsDueCountRef.current = itemsDueForReview.length;
  }, [itemsDueForReview.length, onReviewSessionCompleted]);


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

  const handleDeleteUpcomingItem = useCallback((itemId: string, itemType: 'word' | 'knowledge') => {
    // The onDeleteItem prop from App.tsx is expected to be always defined.
    // This wrapper ensures a stable callback for StudyItemCard instances in upcomingItems list.
    onDeleteItem(itemId, itemType);
  }, [onDeleteItem]);

  const displayedItems = showAll ? allItems.sort((a,b) => (a.nextReviewAt && b.nextReviewAt) ? new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime() : (a.nextReviewAt ? -1 : 1)) : itemsDueForReview;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">
          {showAll ? "所有项目" : "今日复习"}
          {!showAll && ` (${itemsDueForReview.length})`}
        </h3>
         <Button onClick={() => setShowAll(!showAll)} variant="ghost">
            {showAll ? `仅显示到期 (${itemsDueForReview.length})` : `显示全部 (${allItems.length})`}
          </Button>
      </div>

      {displayedItems.length > 0 ? (
        <div className="space-y-4">
          {displayedItems.map(item => (
            <StudyItemCard
              key={item.id}
              item={item}
              onRemembered={handleRemembered}
              onForgot={handleForgot}
              onDeleteItem={showAll ? onDeleteItem : undefined}
              isReviewMode={!showAll || itemsDueForReview.some(dueItem => dueItem.id === item.id)}
              allSyllabusItems={showAll ? allSyllabusItems : undefined}
              onMoveItemCategory={showAll && item.type === 'knowledge' ? onMoveKnowledgePointCategory : undefined}
              onEditItem={showAll ? onEditItem : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-600">
            {showAll ? "尚未添加任何项目。开始学习新内容吧！" : "目前没有到期的复习项。太棒了！🎉"}
        </p>
      )}
      
      {!showAll && itemsDueForReview.length === 0 && upcomingItems.length > 0 && (
        <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-600 mb-2">即将复习 (接下来5个):</h4>
            <div className="space-y-3">
            {upcomingItems.map(item => (
                 <StudyItemCard
                    key={item.id}
                    item={item}
                    onRemembered={handleRemembered}
                    onForgot={handleForgot}
                    onDeleteItem={handleDeleteUpcomingItem} // Use the memoized handler
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

