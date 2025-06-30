import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { WordItem, KnowledgePointItem, LearningItem, SyllabusItem, Ebook } from '../../types'; // Removed NewSubject
import { StudyItemCard } from '../display/StudyItemCard';
import { SRS_INTERVALS_DAYS, MAX_SRS_STAGE, SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../../constants';
import { addDays, getTodayDateString } from '../../utils/dateUtils';
import { Button } from '../common/Button';
import { findExampleInEbook } from '../../utils/ebookUtils';

interface ReviewDashboardProps {
  words: WordItem[];
  mainKnowledgePoints: KnowledgePointItem[];
  onUpdateItem: (item: WordItem | KnowledgePointItem) => void;
  onDeleteItem: (id: string, type: 'word' | 'knowledge') => void;
  onReviewSessionCompleted: () => void;
  mainSyllabus: SyllabusItem[];
  onMoveKnowledgePointCategory?: (itemId: string, newSyllabusId: string | null, isNewKnowledgeContext?: boolean) => void;
  onEditItem?: (item: LearningItem) => void;
  ebooks: Ebook[];
  selectedEbookForLookupId: string | null;
}

type FilterType = 'all' | 'word' | 'main_knowledge';

export const ReviewDashboard: React.FC<ReviewDashboardProps> = ({
    words,
    mainKnowledgePoints,
    onUpdateItem,
    onDeleteItem,
    onReviewSessionCompleted,
    mainSyllabus,
    onMoveKnowledgePointCategory,
    onEditItem,
    ebooks,
    selectedEbookForLookupId
}) => {
  
  const allItems: LearningItem[] = useMemo(() => [...words, ...mainKnowledgePoints], [words, mainKnowledgePoints]);
  
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const itemsDueForReview = useMemo(() => {
    const today = getTodayDateString();
    const uniqueDueItems = new Map<string, LearningItem>();
    allItems.forEach(item => {
        if (item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] <= today) {
            if (item.type === 'word') {
                uniqueDueItems.set(item.id, item);
            } else {
                // For main knowledge points, the logic is simpler as there are no duplicates to handle across systems.
                uniqueDueItems.set(item.id, item);
            }
        }
    });
    return Array.from(uniqueDueItems.values())
                 .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
  }, [allItems]);


  const prevItemsDueCountRef = useRef(itemsDueForReview.length);

  useEffect(() => {
    if (prevItemsDueCountRef.current > 0 && itemsDueForReview.length === 0 && !showAll) {
      onReviewSessionCompleted();
    }
    prevItemsDueCountRef.current = itemsDueForReview.length;
  }, [itemsDueForReview.length, onReviewSessionCompleted, showAll]);


  const upcomingItems = useMemo(() => {
     const today = getTodayDateString();
     const uniqueUpcomingItems = new Map<string, LearningItem>();
     allItems.forEach(item => {
         if (item.nextReviewAt && new Date(item.nextReviewAt).toISOString().split('T')[0] > today) {
             if (item.type === 'word') {
                 uniqueUpcomingItems.set(item.id, item);
             } else {
                uniqueUpcomingItems.set(item.id, item);
             }
         }
     });
     return Array.from(uniqueUpcomingItems.values())
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

  const selectedEbookContent = useMemo(() => {
    if (!selectedEbookForLookupId) return null;
    const ebook = ebooks.find(eb => eb.id === selectedEbookForLookupId);
    return ebook ? ebook.content : null;
  }, [ebooks, selectedEbookForLookupId]);

  const displayedItems = useMemo(() => {
    let itemsToDisplay: LearningItem[];
    if (showAll) {
      if (filterType === 'word') {
        itemsToDisplay = allItems.filter(item => item.type === 'word');
        if (searchTerm) {
          itemsToDisplay = itemsToDisplay.filter(item =>
            (item as WordItem).text.toLowerCase().startsWith(searchTerm.toLowerCase())
          );
        }
      } else if (filterType === 'main_knowledge') {
        itemsToDisplay = mainKnowledgePoints;
      } else { // 'all'
        itemsToDisplay = allItems;
      }
      return itemsToDisplay.sort((a,b) => (a.createdAt && b.createdAt) ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : (a.createdAt ? -1 : 1));
    }
    return itemsDueForReview;
  }, [allItems, itemsDueForReview, showAll, filterType, searchTerm, mainKnowledgePoints]);
  
  const getSyllabusForKpDisplay = (_kp: KnowledgePointItem): SyllabusItem[] => {
      // Since this dashboard only handles main syllabus KPs, always return mainSyllabus.
      return mainSyllabus;
  };
  
  const isKpInNewKnowledgeContextForDisplay = (_kp: KnowledgePointItem): boolean => {
      // This dashboard does not handle new knowledge context items.
      return false;
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">
          {showAll ? "所有项目" : "今日复习"}
          {!showAll && ` (${itemsDueForReview.length})`}
          {showAll && ` (${displayedItems.length}${filterType !== 'all' ? ` ${filterType === 'word' ? '单词' : '主大纲知识点'}` : ''} / ${allItems.length} 总计)`}
        </h3>
         <Button
            onClick={() => {
              setShowAll(!showAll);
              if (showAll) {
                setFilterType('all');
                setSearchTerm('');
              }
            }}
            variant="ghost"
          >
            {showAll ? `仅显示到期 (${itemsDueForReview.length})` : `显示全部 (${allItems.length})`}
          </Button>
      </div>

      {showAll && (
        <>
          <div className="my-3 flex items-center space-x-2 border-b pb-3 mb-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600 mr-2">筛选:</span>
            <Button
              variant={filterType === 'all' ? 'primary' : 'ghost'}
              onClick={() => { setFilterType('all'); setSearchTerm(''); }}
              size="sm"
              aria-pressed={filterType === 'all'}
              className="mb-1"
            >
              全部 ({allItems.length})
            </Button>
            <Button
              variant={filterType === 'word' ? 'primary' : 'ghost'}
              onClick={() => setFilterType('word')}
              size="sm"
              aria-pressed={filterType === 'word'}
              className="mb-1"
            >
              单词 ({words.length})
            </Button>
            <Button
              variant={filterType === 'main_knowledge' ? 'primary' : 'ghost'}
              onClick={() => { setFilterType('main_knowledge'); setSearchTerm(''); }}
              size="sm"
              aria-pressed={filterType === 'main_knowledge'}
              className="mb-1"
            >
              主大纲知识点 ({mainKnowledgePoints.length})
            </Button>
          </div>
          {filterType === 'word' && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="搜索单词 (按开头字母)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          )}
        </>
      )}

      {displayedItems.length > 0 ? (
        <div className="space-y-4">
          {displayedItems.map(item => {
            const isNewKnowledgeContext = item.type === 'knowledge' ? isKpInNewKnowledgeContextForDisplay(item as KnowledgePointItem) : false;
            return (
              <StudyItemCard
                key={item.id + (item.type === 'knowledge' ? ((item as KnowledgePointItem).subjectId || 'main') : '')}
                item={item}
                onRemembered={handleRemembered}
                onForgot={handleForgot}
                onDeleteItem={showAll ? onDeleteItem : undefined}
                isReviewMode={
                  !showAll &&
                  itemsDueForReview.some(dueItem => {
                    if (dueItem.type === 'word' && item.type === 'word') {
                      return dueItem.id === item.id;
                    }
                    if (dueItem.type === 'knowledge' && item.type === 'knowledge') {
                      const dueKp = dueItem as KnowledgePointItem;
                      const currentKp = item as KnowledgePointItem;
                      const dueMasterId = dueKp.masterId || dueKp.id;
                      const currentMasterId = currentKp.masterId || currentKp.id;
                      return dueMasterId === currentMasterId;
                    }
                    return false;
                  })
                }
                allSyllabusItems={item.type === 'knowledge' ? getSyllabusForKpDisplay(item as KnowledgePointItem) : undefined}
                onMoveItemCategory={
                  showAll && item.type === 'knowledge' && onMoveKnowledgePointCategory
                  ? (itemId, newSyllabusId) => onMoveKnowledgePointCategory(itemId, newSyllabusId, isNewKnowledgeContext)
                  : undefined
                }
                onEditItem={showAll ? onEditItem : undefined}
                selectedEbookContent={selectedEbookContent}
                findExampleInEbook={findExampleInEbook}
                isDisplayingInNewSubjectContext={isNewKnowledgeContext}
                contextualSyllabusRootId={isNewKnowledgeContext ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-gray-600">
            {showAll ? (filterType === 'all' ? "尚未添加任何项目。开始学习新内容吧！" : "目前没有到期的复习项。太棒了！🎉") : "目前没有到期的复习项。太棒了！🎉"}
        </p>
      )}
      
      {!showAll && itemsDueForReview.length === 0 && upcomingItems.length > 0 && (
        <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-600 mb-2">即将复习 (接下来5个):</h4>
            <div className="space-y-3">
            {upcomingItems.map(item => {
              const isNewKnowledgeContext = item.type === 'knowledge' ? isKpInNewKnowledgeContextForDisplay(item as KnowledgePointItem) : false;
              return (
                 <StudyItemCard
                    key={item.id + "-upcoming" + (item.type === 'knowledge' ? ((item as KnowledgePointItem).subjectId || 'main') : '')}
                    item={item}
                    onRemembered={handleRemembered}
                    onForgot={handleForgot}
                    onDeleteItem={onDeleteItem}
                    isReviewMode={false}
                    allSyllabusItems={item.type === 'knowledge' ? getSyllabusForKpDisplay(item as KnowledgePointItem) : undefined}
                    onMoveItemCategory={
                      item.type === 'knowledge' && onMoveKnowledgePointCategory
                      ? (itemId, newSyllabusId) => onMoveKnowledgePointCategory(itemId, newSyllabusId, isNewKnowledgeContext)
                      : undefined
                    }
                    onEditItem={onEditItem}
                    selectedEbookContent={selectedEbookContent}
                    findExampleInEbook={findExampleInEbook}
                    isDisplayingInNewSubjectContext={isNewKnowledgeContext}
                    contextualSyllabusRootId={isNewKnowledgeContext ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID}
                />
              );
            })}
            </div>
        </div>
      )}
       {!showAll && itemsDueForReview.length === 0 && upcomingItems.length === 0 && allItems.length > 0 && (
         <p className="text-gray-600 mt-4">所有项目都已复习完毕或已安排复习。可以去学习新内容了！</p>
       )}
    </div>
  );
};
