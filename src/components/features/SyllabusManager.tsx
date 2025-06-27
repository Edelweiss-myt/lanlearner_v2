import React, { useState, useMemo, useRef } from 'react';
import { SyllabusItem, KnowledgePointItem, LearningItem, Ebook } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { StudyItemCard } from '../display/StudyItemCard';
import { findExampleInEbook } from '../../utils/ebookUtils';
import { SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../../constants';

interface SyllabusManagerProps {
  syllabusItems: SyllabusItem[];
  knowledgePoints: KnowledgePointItem[];
  onAddItem: (item: Omit<SyllabusItem, 'id'>) => void;
  onUpdateItem: (item: SyllabusItem) => void;
  onDeleteItem: (id: string) => void;
  onDeleteKnowledgePoint?: (id: string, type: 'word' | 'knowledge') => void;
  onMoveKnowledgePointCategory?: (itemId: string, newSyllabusId: string | null) => void;
  onEditItem?: (item: LearningItem) => void;
  ebooks: Ebook[];
  ebookImportStatus: string | null;
  onUploadEbook: (file: File) => Promise<void>;
  onDeleteEbook: (ebookId: string) => void;
  isNewSubjectContext: boolean;
  currentSubjectRootId: string | null; // SYLLABUS_ROOT_ID or NEW_KNOWLEDGE_SYLLABUS_ROOT_ID
  currentSubjectName: string;
  // onSyncKnowledgePointsToMainByCategory?: (newKnowledgeCategoryId: string) => void; // Removed
  onSyncSingleKnowledgePointToMain?: (kpId: string) => void;
  onSetLearningPlanForCategory?: (categoryId: string, categoryName: string) => void;
  primaryNewKnowledgeSubjectCategoryId?: string | null; // For "BuildNewSystem" context
  onSetPrimaryCategoryAsSubject?: (categoryId: string | null) => void; // For "BuildNewSystem" context
  onMarkAsUnlearned?: (id: string) => void;
}

interface EditableSyllabusItem {
  id?: string;
  title: string;
  parentId: string | null;
  isLearned?: boolean;
}

const UNCATEGORIZED_TEXT = "全部 / 未分类";
const EBOOK_ACCEPTED_FORMATS = ".txt,.pdf,.epub,.doc,.docx";

export const SyllabusManager: React.FC<SyllabusManagerProps> = ({
    syllabusItems,
    knowledgePoints,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
    onDeleteKnowledgePoint,
    onMoveKnowledgePointCategory,
    onEditItem,
    ebooks,
    ebookImportStatus,
    onUploadEbook,
    onDeleteEbook,
    isNewSubjectContext,
    currentSubjectRootId,
    currentSubjectName,
    // onSyncKnowledgePointsToMainByCategory, // Removed
    onSyncSingleKnowledgePointToMain,
    onSetLearningPlanForCategory,
    primaryNewKnowledgeSubjectCategoryId,
    onSetPrimaryCategoryAsSubject,
    onMarkAsUnlearned,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableSyllabusItem | null>(null);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(currentSubjectRootId);
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => {
    if (isNewSubjectContext) {
      // For the "New Knowledge" view, initialize all categories with children to be collapsed.
      const parentIds = new Set<string>();
      syllabusItems.forEach(item => {
        // Only consider items that are part of the current syllabus context
        if (item.parentId && item.parentId !== NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
           parentIds.add(item.parentId);
        }
      });
       // Also add all top-level categories to be collapsed by default
       syllabusItems.forEach(item => {
         if (item.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) {
           parentIds.add(item.id);
         }
       })
      return parentIds;
    }
    return new Set<string>(); // Default for other views: start expanded.
  });
  const ebookFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setSelectedSyllabusId(currentSubjectRootId);
  }, [currentSubjectRootId]);

  const openModal = (item?: SyllabusItem) => {
    const parentForNew = selectedSyllabusId || currentSubjectRootId;
    setEditingItem(item ? { ...item } : { title: '', parentId: parentForNew, isLearned: false });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = () => {
    if (editingItem && editingItem.title.trim()) {
      const parentIdToSave = editingItem.id === editingItem.parentId
        ? currentSubjectRootId
        : (editingItem.parentId || currentSubjectRootId);

      if (editingItem.id) {
        const itemToUpdate: SyllabusItem = {
          id: editingItem.id,
          title: editingItem.title.trim(),
          parentId: parentIdToSave,
        };
        onUpdateItem(itemToUpdate);
      } else {
        onAddItem({ title: editingItem.title.trim(), parentId: parentIdToSave });
      }
      closeModal();
    }
  };
  
  const handleDeleteSyllabusItem = (id: string) => {
    const itemToDelete = syllabusItems.find(s=>s.id === id);
    const confirmMessage = `您确定要删除此分类 "${itemToDelete?.title || '未知'}" 及其所有子分类吗？相关的知识点将变为未分类。此操作不可逆。`;
    if (window.confirm(confirmMessage)) {
      onDeleteItem(id);
      if(selectedSyllabusId === id) setSelectedSyllabusId(currentSubjectRootId);
      closeModal();
    }
  };

  const toggleCollapse = (itemId: string) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const itemsByParent = useMemo(() => {
    const map = new Map<string | null, SyllabusItem[]>();
    syllabusItems.forEach(item => {
      if (item.id === SYLLABUS_ROOT_ID || item.id === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID) return;
      
      const parentKey = item.parentId;
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      map.get(parentKey)!.push(item);
    });
    return map;
  }, [syllabusItems]);


  const renderSyllabusTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = itemsByParent.get(parentId) || [];
    
    return (
      <ul className={depth > 0 ? "pl-4" : ""}>
        {children.map(item => {
          const hasChildren = itemsByParent.has(item.id) && itemsByParent.get(item.id)!.length > 0;
          const isCollapsed = collapsedItems.has(item.id);
          const isTopLevelSubjectCategory = isNewSubjectContext && item.parentId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID;
          const setPrimaryStyle = "text-green-600 hover:text-green-700 text-[10px] leading-tight";
          const planStyle = "text-blue-600 hover:text-blue-700 text-[10px] leading-tight";
          const editStyle = "text-gray-600 hover:text-gray-800 text-[10px] leading-tight";

          return (
            <li key={item.id} className="my-1">
              <div className="relative flex justify-between items-center p-2 rounded-md hover:bg-gray-100 group">
                <div className="flex items-center flex-1">
                  {hasChildren && (
                    <span onClick={() => toggleCollapse(item.id)} className="cursor-pointer pr-1 text-gray-500">
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  )}
                <span
                  onClick={() => setSelectedSyllabusId(item.id)}
                    className={`cursor-pointer ${!hasChildren ? 'ml-4' : ''} ${selectedSyllabusId === item.id ? 'font-bold text-primary-600' : (item.isLearned ? 'text-green-700' : 'text-gray-900')}`}
                    title={item.title}
                >
                  {item.title}
                </span>
                  {isNewSubjectContext && item.id === primaryNewKnowledgeSubjectCategoryId && <span className="text-xs text-green-700 font-semibold ml-1 flex-shrink-0">(主学)</span>}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-row items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm p-1 rounded-md shadow-lg">
                  {isNewSubjectContext && onSetPrimaryCategoryAsSubject && isTopLevelSubjectCategory && item.id !== primaryNewKnowledgeSubjectCategoryId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSetPrimaryCategoryAsSubject(item.id)}
                      className={setPrimaryStyle}
                      title={`设 "${item.title}" 为主学`}
                    >
                      设为主学
                    </Button>
                  )}
                  {isNewSubjectContext && onSetLearningPlanForCategory && !isTopLevelSubjectCategory && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSetLearningPlanForCategory(item.id, item.title)}
                      className={planStyle}
                      title={`设 "${item.title}" 为学习计划`}
                    >
                      计划
                    </Button>
                  )}
                  {item.id !== currentSubjectRootId && ( // Edit button
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openModal(item)}
                      aria-label={`编辑分类 ${item.title}`}
                      className={editStyle}
                    >编辑</Button>
                  )}
                </div>
              </div>
              {!isCollapsed && hasChildren && renderSyllabusTree(item.id, depth + 1)}
            </li>
          );
        })}
         {parentId === currentSubjectRootId && children.length === 0 && (
            <li className="text-sm text-gray-500 pl-0">暂无顶级分类。点击"添加新分类"开始。</li>
         )}
      </ul>
    );
  };

  const renderParentOptionsForModal = (parentId: string | null, depth = 0, currentEditingItemId?: string): React.ReactNode[] => {
    const children = itemsByParent.get(parentId) || [];
    let options: React.ReactNode[] = [];

    children.forEach(item => {
      // Prevent selecting the item being edited or its own children as its parent
      if (item.id === currentEditingItemId) return;

      options.push(
        <option key={item.id} value={item.id}>
          {'\u00A0'.repeat(depth * 4) + item.title}
        </option>
      );
      // Recursively gather options from children, excluding the current item if it's being edited
      if (item.id !== currentEditingItemId) {
        options = options.concat(renderParentOptionsForModal(item.id, depth + 1, currentEditingItemId));
      }
    });
    return options;
  };


  const currentKnowledgePoints = useMemo(() => {
    if (selectedSyllabusId === currentSubjectRootId) {
      return knowledgePoints.filter(kp => kp.syllabusItemId === currentSubjectRootId || !kp.syllabusItemId);
    }
    return knowledgePoints.filter(kp => kp.syllabusItemId === selectedSyllabusId);
  }, [knowledgePoints, selectedSyllabusId, currentSubjectRootId]);
  
  const selectedSyllabusItemTitle = useMemo(() => {
    if (selectedSyllabusId === currentSubjectRootId) {
        if (isNewSubjectContext) return "新知识体系";
        return currentSubjectName === "主大纲" ? UNCATEGORIZED_TEXT : `${currentSubjectName} (全部/未分类)`;
    }
    const item = syllabusItems.find(i => i.id === selectedSyllabusId);
    return item ? item.title : (isNewSubjectContext ? "新知识体系" : UNCATEGORIZED_TEXT);
  }, [selectedSyllabusId, syllabusItems, currentSubjectRootId, currentSubjectName, isNewSubjectContext]);

  const handleEbookFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadEbook(file);
    }
    if (ebookFileInputRef.current) {
      ebookFileInputRef.current.value = "";
    }
  };

  const confirmAndDeleteEbook = (ebookId: string, ebookName: string) => {
    if (window.confirm(`您确定要从书库中删除电子书 "${ebookName}" 吗？此操作无法撤销。`)) {
      onDeleteEbook(ebookId);
    }
  };

  const titleText = currentSubjectName;


  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">{titleText}</h3>
        <div>
        <Button
            onClick={() => openModal()}
            size="sm"
            aria-label={`添加新分类到 ${currentSubjectName}`}
            variant={isNewSubjectContext ? 'secondary' : 'primary'}
        >
          添加新分类
        </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className={`md:col-span-2 p-3 border rounded-md ${isNewSubjectContext ? 'bg-secondary-50' : 'bg-gray-50'} max-h-96 overflow-y-auto`}>
          <h4 className="font-semibold mb-2 text-gray-600">分类</h4>
           <div
                onClick={() => setSelectedSyllabusId(currentSubjectRootId)}
                className={`p-2 cursor-pointer rounded-md ${selectedSyllabusId === currentSubjectRootId ? 'font-bold text-primary-600 bg-primary-100' : 'hover:bg-gray-100'}`}
            >
                { isNewSubjectContext ? "新知识体系" : (currentSubjectName === "主大纲" ? UNCATEGORIZED_TEXT : `${currentSubjectName} (全部/未分类)`) }
            </div>
          {renderSyllabusTree(currentSubjectRootId)}
        </div>

        <div className="md:col-span-3">
          <h4 className="font-semibold mb-2 text-gray-600">
            知识点列表: <span className="text-primary-600">{selectedSyllabusItemTitle}</span>
          </h4>
          {currentKnowledgePoints.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {currentKnowledgePoints.map(kp => (
              <StudyItemCard
                key={kp.id}
                item={kp}
                isReviewMode={false}
                onDeleteItem={onDeleteKnowledgePoint}
                allSyllabusItems={syllabusItems}
                onMoveItemCategory={onMoveKnowledgePointCategory}
                onEditItem={onEditItem}
                selectedEbookContent={null}
                findExampleInEbook={findExampleInEbook}
                isDisplayingInNewSubjectContext={isNewSubjectContext}
                onSyncToMainSyllabus={isNewSubjectContext ? onSyncSingleKnowledgePointToMain : undefined}
                contextualSyllabusRootId={isNewSubjectContext ? NEW_KNOWLEDGE_SYLLABUS_ROOT_ID : SYLLABUS_ROOT_ID}
              />
            ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">此分类下暂无知识点。</p>
          )}
        </div>
      </div>

    {!isNewSubjectContext && (
      <div className="mt-8 mb-6 p-4 border rounded-md bg-primary-50">
        <h4 className="text-lg font-semibold text-primary-700 mb-3">电子书库</h4>
        <div className="mb-3">
            <input
              type="file"
              ref={ebookFileInputRef}
              onChange={handleEbookFileSelect}
              style={{ display: 'none' }}
              accept={EBOOK_ACCEPTED_FORMATS}
            />
            <Button onClick={() => ebookFileInputRef.current?.click()} variant="secondary" size="sm">
              上传新电子书到书库
            </Button>
        </div>

        {ebookImportStatus && (
          <p className={`mb-3 text-xs ${ebookImportStatus.includes('错误') || ebookImportStatus.includes('失败') ? 'text-red-500' : (ebookImportStatus.includes('成功') ? 'text-green-600' : 'text-yellow-600')}`}>
            {ebookImportStatus}
          </p>
        )}
        
        {ebooks.length > 0 ? (
          <div className="space-y-2">
            <h5 className="text-md font-medium text-primary-600">已存电子书:</h5>
            <ul className="list-disc list-inside pl-1 space-y-1 text-sm max-h-48 overflow-y-auto">
              {ebooks.map(ebook => (
                <li key={ebook.id} className="flex justify-between items-center p-1.5 bg-primary-100 rounded">
                  <span className="text-gray-700 truncate" title={ebook.name}>{ebook.name}</span>
                  <Button
                    onClick={() => confirmAndDeleteEbook(ebook.id, ebook.name)}
                    variant="danger"
                    size="sm"
                    className="px-2 py-0.5 text-xs"
                    aria-label={`删除电子书 ${ebook.name}`}
                  >
                    删除
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-500">您的电子书库为空。上传一本电子书以开始使用。</p>
        )}
      </div>
    )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingItem?.id ? '编辑分类' : '添加新分类'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="catTitle" className="block text-sm font-medium text-gray-700">标题</label>
            <input
              type="text"
              id="catTitle"
              value={editingItem?.title || ''}
              onChange={(e) => setEditingItem(prev => prev ? { ...prev, title: e.target.value } : null)}
              className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            />
          </div>
          <div>
            <label htmlFor="catParent" className="block text-sm font-medium text-gray-700">父分类</label>
            <select
              id="catParent"
              value={editingItem?.parentId || (currentSubjectRootId || '')}
              onChange={(e) => setEditingItem(prev => prev ? { ...prev, parentId: e.target.value || currentSubjectRootId } : null)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value={currentSubjectRootId || ''}>
                {currentSubjectRootId === SYLLABUS_ROOT_ID ? '设为主大纲顶级' : (currentSubjectRootId === NEW_KNOWLEDGE_SYLLABUS_ROOT_ID ? '设为新知识体系顶级学科' : '无父分类 (设为顶级)')}
              </option>
              {renderParentOptionsForModal(currentSubjectRootId, 0, editingItem?.id)}
            </select>
            {isNewSubjectContext && <p className="text-xs text-gray-500 mt-1">分类将添加到 "{currentSubjectName}" 下。</p>}
          </div>
          <div className="flex justify-between items-center mt-6">
              <div className="flex items-center space-x-2">
                {editingItem?.id && (
                  <Button variant="danger" onClick={() => handleDeleteSyllabusItem(editingItem.id!)}>
                    删除
                  </Button>
                )}
                {editingItem?.id && editingItem.isLearned && onMarkAsUnlearned && (
                    <Button variant="warning" onClick={() => {
                        onMarkAsUnlearned(editingItem.id!);
                        closeModal();
                    }}>
                        标记为未学
                    </Button>
                )}
              </div>
              <div className="flex space-x-2">
            <Button onClick={closeModal} variant="ghost">取消</Button>
            <Button onClick={handleSave} variant={isNewSubjectContext ? 'secondary' : 'primary'}>保存</Button>
              </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
