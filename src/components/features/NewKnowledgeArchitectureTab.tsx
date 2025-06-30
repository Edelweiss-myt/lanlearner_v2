import React, { useMemo, useState } from 'react';
import { SyllabusItem, KnowledgePointItem, CurrentLearningPlan } from '../../types';
import { KnowledgePointInputForm } from '../inputs/KnowledgePointInputForm';
import { SyllabusManager } from './SyllabusManager';
import { Button } from '../common/Button';
import { NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../../constants';

interface NewKnowledgeArchitectureTabProps {
  newKnowledgeSyllabus: SyllabusItem[];
  newKnowledgeKnowledgePoints: KnowledgePointItem[];
  primaryNewKnowledgeSubjectCategoryId: string | null;
  onSetPrimaryCategoryAsSubject: (categoryId: string | null) => void; // Can be null to unset
  currentLearningPlan: CurrentLearningPlan | null;
  onSetLearningPlan: (plan: CurrentLearningPlan | null) => void;
  onMarkCategoryAsLearned: (categoryId: string) => void;
  onMarkCategoryAsUnlearned: (categoryId: string) => void;
  
  onAddSyllabusItem: (item: Omit<SyllabusItem, 'id'>) => void;
  onUpdateSyllabusItem: (item: SyllabusItem) => void;
  onDeleteSyllabusItem: (id: string) => void;
  onDeleteSyllabusItemAndKnowledgePoints: (id: string) => void;
  onAddKnowledgePoint: (kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type' | 'masterId' | 'subjectId'>) => void;
  onDeleteKnowledgePoint: (id: string, type: 'knowledge') => void;
  onMoveKnowledgePointCategory: (itemId: string, newSyllabusId: string | null) => void;
  onEditKnowledgePoint: (item: KnowledgePointItem) => void;
  onGraduateCategories: () => void;
  // onSyncKnowledgePointsToMainByCategory: (newKnowledgeCategoryId: string) => void; // Removed
  onSyncSingleKnowledgePointToMain: (kpId: string) => void;
}

export const NewKnowledgeArchitectureTab: React.FC<NewKnowledgeArchitectureTabProps> = ({
  newKnowledgeSyllabus,
  newKnowledgeKnowledgePoints,
  primaryNewKnowledgeSubjectCategoryId,
  onSetPrimaryCategoryAsSubject,
  currentLearningPlan,
  onSetLearningPlan,
  onMarkCategoryAsLearned,
  onMarkCategoryAsUnlearned,
  onAddSyllabusItem,
  onUpdateSyllabusItem,
  onDeleteSyllabusItem,
  onDeleteSyllabusItemAndKnowledgePoints,
  onAddKnowledgePoint,
  onDeleteKnowledgePoint,
  onMoveKnowledgePointCategory,
  onEditKnowledgePoint,
  onGraduateCategories,
  // onSyncKnowledgePointsToMainByCategory, // Removed
  onSyncSingleKnowledgePointToMain,
}) => {

  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
  const primarySubjectCategory = useMemo(() =>
    newKnowledgeSyllabus.find(s => s.id === primaryNewKnowledgeSubjectCategoryId),
  [newKnowledgeSyllabus, primaryNewKnowledgeSubjectCategoryId]);

  const handleSetPlanForCategory = (categoryId: string, categoryName: string) => {
    let topLevelParentId: string | null = null;
    let current: SyllabusItem | undefined = newKnowledgeSyllabus.find(s => s.id === categoryId);
    while(current) {
        if (current.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
            topLevelParentId = current.id;
            break;
        }
        if (current.id === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID || current.parentId === null) {
             break;
        }
        current = newKnowledgeSyllabus.find(s => s.id === current!.parentId);
    }
    
    if (topLevelParentId) {
        onSetLearningPlan({
            subjectId: topLevelParentId,
            categoryId: categoryId,
            categoryName: categoryName,
        });
    } else {
        const isTopLevelSubject = newKnowledgeSyllabus.find(s => s.id === categoryId && s.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID);
        if (isTopLevelSubject) {
            onSetLearningPlan({
                subjectId: categoryId,
                categoryId: categoryId,
                categoryName: categoryName,
            });
        } else {
            console.warn("Could not determine top-level subject for learning plan.");
            onSetLearningPlan(null);
        }
    }
  };

  const planSubjectName = useMemo(() => {
    if (currentLearningPlan && currentLearningPlan.subjectId) {
      const subject = newKnowledgeSyllabus.find(s => s.id === currentLearningPlan.subjectId);
      return subject ? subject.title : null;
    }
    return null;
  }, [currentLearningPlan, newKnowledgeSyllabus]);

  const learningStats = useMemo(() => {
    if (!primaryNewKnowledgeSubjectCategoryId) {
      return { level1Total: 0, level1Learned: 0, level2Total: 0, level2Learned: 0 };
    }
    const level1Categories = newKnowledgeSyllabus.filter(s => s.parentId === primaryNewKnowledgeSubjectCategoryId);
    const level1Ids = new Set(level1Categories.map(s => s.id));
    const level2Categories = newKnowledgeSyllabus.filter(s => s.parentId && level1Ids.has(s.parentId));

    return {
      level1Total: level1Categories.length,
      level1Learned: level1Categories.filter(s => s.isLearned).length,
      level2Total: level2Categories.length,
      level2Learned: level2Categories.filter(s => s.isLearned).length,
    };
  }, [newKnowledgeSyllabus, primaryNewKnowledgeSubjectCategoryId]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-lg shadow">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-2xl font-semibold text-secondary-700">
            搭建新知识体系
            </h2>
            <Button onClick={onGraduateCategories} size="sm" variant='primary' disabled={!primarySubjectCategory}>
                将主学体系目录导至主大纲
            </Button>
        </div>
        
        <div className="flex items-center justify-between text-md font-medium text-green-700 bg-green-100 p-2 rounded-md mb-3">
            <span>
                今日计划学习：
                {currentLearningPlan ? (
                    <>
                    {currentLearningPlan.categoryName}
                    {primaryNewKnowledgeSubjectCategoryId &&
                    currentLearningPlan.subjectId !== primaryNewKnowledgeSubjectCategoryId &&
                    planSubjectName &&
                    ` (体系: ${planSubjectName})`}
                    </>
                ) : (
                    "未设定"
                )}
            </span>
            <Button
                size="sm"
                variant="primary"
                onClick={() => currentLearningPlan && onMarkCategoryAsLearned(currentLearningPlan.categoryId)}
                disabled={!currentLearningPlan}
            >
                已学完
            </Button>
        </div>
        
        {primaryNewKnowledgeSubjectCategoryId && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-4 grid grid-cols-2 gap-x-4">
            <div><span className="font-semibold">完成：一级 </span>  {learningStats.level1Learned} / {learningStats.level1Total}</div>
            <div><span className="font-semibold">二级 </span>   {learningStats.level2Learned} / {learningStats.level2Total}</div>
          </div>
        )}
            
        <SyllabusManager
            syllabusItems={newKnowledgeSyllabus}
            knowledgePoints={newKnowledgeKnowledgePoints}
            onAddItem={onAddSyllabusItem}
            onUpdateItem={onUpdateSyllabusItem}
            onDeleteItem={onDeleteSyllabusItem}
            onDeleteItemAndKnowledgePoints={onDeleteSyllabusItemAndKnowledgePoints}
            onDeleteKnowledgePoint={(id, type) => onDeleteKnowledgePoint(id, type as 'knowledge')}
            onMoveKnowledgePointCategory={onMoveKnowledgePointCategory}
            onEditItem={(item) => onEditKnowledgePoint(item as KnowledgePointItem)}
            ebooks={[]}
            ebookImportStatus={null}
            onUploadEbook={async () => {}}
            onDeleteEbook={() => {}}
            isNewSubjectContext={true}
            currentSubjectRootId={NEW_KNOWLEDGE_SYLLABUS_ROOT_ID}
            currentSubjectName="新知识体系"
            onSyncSingleKnowledgePointToMain={onSyncSingleKnowledgePointToMain}
            onSetLearningPlanForCategory={handleSetPlanForCategory}
            primaryNewKnowledgeSubjectCategoryId={primaryNewKnowledgeSubjectCategoryId}
            onSetPrimaryCategoryAsSubject={onSetPrimaryCategoryAsSubject}
            onMarkAsUnlearned={onMarkCategoryAsUnlearned}
            selectedSyllabusId={selectedSyllabusId}
            onSelectSyllabusId={setSelectedSyllabusId}
        />
         <div className="mt-6">
            <KnowledgePointInputForm
            onAddKnowledgePoint={onAddKnowledgePoint}
            syllabusItems={newKnowledgeSyllabus}
            isNewSubjectContext={true}
            syllabusRootId={NEW_KNOWLEDGE_SYLLABUS_ROOT_ID}
            activeNewSubjectNameProp={primarySubjectCategory?.title || null} // Pass null if no primary subject
            preferredSyllabusId={selectedSyllabusId}
            />
        </div>
      </div>
    </div>
  );
};
