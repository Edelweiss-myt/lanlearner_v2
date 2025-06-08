import React, { useState, useMemo, useRef } from 'react';
import { SyllabusItem, KnowledgePointItem, LearningItem, Ebook } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { SYLLABUS_ROOT_ID } from '../../constants';
import { StudyItemCard } from '../display/StudyItemCard';
import { findExampleInEbook } from '../../utils/ebookUtils'; // Added import

interface SyllabusManagerProps {
  syllabusItems: SyllabusItem[];
  knowledgePoints: KnowledgePointItem[];
  onAddItem: (item: Omit<SyllabusItem, 'id'>) => void;
  onUpdateItem: (item: SyllabusItem) => void;
  onDeleteItem: (id: string) => void;
  onDeleteKnowledgePoint?: (id: string, type: 'word' | 'knowledge') => void;
  onMoveKnowledgePointCategory?: (itemId: string, newSyllabusId: string | null) => void;
  onEditItem?: (item: LearningItem) => void;
  // E-book related props
  ebooks: Ebook[];
  ebookImportStatus: string | null;
  onUploadEbook: (file: File) => Promise<void>;
  onDeleteEbook: (ebookId: string) => void;
}

interface EditableSyllabusItem {
  id?: string;
  title: string;
  parentId: string | null;
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
    onDeleteEbook
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableSyllabusItem | null>(null);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(SYLLABUS_ROOT_ID);
  const ebookFileInputRef = useRef<HTMLInputElement>(null);

  const openModal = (item?: SyllabusItem) => {
    setEditingItem(item ? { ...item } : { title: '', parentId: selectedSyllabusId === SYLLABUS_ROOT_ID ? null : selectedSyllabusId });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = () => {
    if (editingItem && editingItem.title.trim()) {
      if (editingItem.id) {
        const itemToUpdate: SyllabusItem = {
          id: editingItem.id,
          title: editingItem.title.trim(),
          parentId: editingItem.parentId,
        };
        onUpdateItem(itemToUpdate);
      } else {
        onAddItem({ title: editingItem.title.trim(), parentId: editingItem.parentId });
      }
      closeModal();
    }
  };
  
  const handleDeleteSyllabusItem = (id: string) => {
    if (window.confirm("您确定要删除此目录项及其子项吗？相关的知识点将变为未分类状态。")) {
      onDeleteItem(id);
      if(selectedSyllabusId === id) setSelectedSyllabusId(SYLLABUS_ROOT_ID);
    }
  };

  const itemsByParent = useMemo(() => {
    const map = new Map<string | null, SyllabusItem[]>();
    syllabusItems.forEach(item => {
      const parentKey = item.parentId === SYLLABUS_ROOT_ID ? null : item.parentId;
      
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      if (item.id !== SYLLABUS_ROOT_ID) {
          map.get(parentKey)!.push(item);
      }
    });
    return map;
  }, [syllabusItems]);


  const renderSyllabusTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const children = itemsByParent.get(parentId) || [];
    
    return (
      <ul className={depth > 0 ? "pl-4" : ""}>
        {children.map(item => (
          <li key={item.id} className="my-1 p-2 rounded-md hover:bg-gray-100 group">
            <div className="flex justify-between items-center">
              <span
                onClick={() => setSelectedSyllabusId(item.id)}
                className={`cursor-pointer ${selectedSyllabusId === item.id ? 'font-bold text-primary-600' : ''}`}
              >
                {item.title}
              </span>
              <div className="space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => openModal(item)}>✎</Button>
                 {item.id !== SYLLABUS_ROOT_ID && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteSyllabusItem(item.id)} className="text-red-500 hover:text-red-700">🗑</Button>
                 )}
              </div>
            </div>
            {itemsByParent.has(item.id) && renderSyllabusTree(item.id, depth + 1)}
          </li>
        ))}
         {parentId === null && children.length === 0 && syllabusItems.filter(si => si.id !== SYLLABUS_ROOT_ID).length === 0 && (
            <li className="text-sm text-gray-500 pl-0">暂无顶级分类。</li>
         )}
      </ul>
    );
  };

  const currentKnowledgePoints = useMemo(() => {
    if (selectedSyllabusId === SYLLABUS_ROOT_ID) {
      return knowledgePoints.filter(kp => !kp.syllabusItemId || !syllabusItems.find(si => si.id === kp.syllabusItemId));
    }
    return knowledgePoints.filter(kp => kp.syllabusItemId === selectedSyllabusId);
  }, [knowledgePoints, selectedSyllabusId, syllabusItems]);
  
  const selectedSyllabusItemTitle = useMemo(() => {
    if (selectedSyllabusId === SYLLABUS_ROOT_ID) {
        const rootItem = syllabusItems.find(i => i.id === SYLLABUS_ROOT_ID);
        return rootItem ? rootItem.title : UNCATEGORIZED_TEXT;
    }
    const item = syllabusItems.find(i => i.id === selectedSyllabusId);
    return item ? item.title : UNCATEGORIZED_TEXT;
  }, [selectedSyllabusId, syllabusItems]);

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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-700">学习大纲 / 目录</h3>
        <Button onClick={() => openModal()} size="sm">添加分类</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 p-3 border rounded-md bg-gray-50 max-h-96 overflow-y-auto">
          <h4 className="font-semibold mb-2 text-gray-600">分类</h4>
           <div
                onClick={() => setSelectedSyllabusId(SYLLABUS_ROOT_ID)}
                className={`p-2 cursor-pointer rounded-md ${selectedSyllabusId === SYLLABUS_ROOT_ID ? 'font-bold text-primary-600 bg-primary-100' : 'hover:bg-gray-100'}`}
            >
                {syllabusItems.find(si => si.id === SYLLABUS_ROOT_ID)?.title || UNCATEGORIZED_TEXT}
            </div>
          {renderSyllabusTree(null)}
        </div>

        <div className="md:col-span-2">
          <h4 className="font-semibold mb-2 text-gray-600">分类下的知识点: <span className="text-primary-600">{selectedSyllabusItemTitle}</span></h4>
          {currentKnowledgePoints.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {currentKnowledgePoints.map(kp => (
              <StudyItemCard
                key={kp.id}
                item={kp}
                isReviewMode={false}
                onRemembered={()=>{}}
                onForgot={()=>{}}
                onDeleteItem={onDeleteKnowledgePoint}
                allSyllabusItems={syllabusItems}
                onMoveItemCategory={onMoveKnowledgePointCategory}
                onEditItem={onEditItem}
                selectedEbookContent={null}
                findExampleInEbook={findExampleInEbook}
              />
            ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">此分类下暂无知识点。</p>
          )}
        </div>
      </div>

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
              value={editingItem?.parentId === null ? SYLLABUS_ROOT_ID : editingItem?.parentId || ''}
              onChange={(e) => setEditingItem(prev => prev ? { ...prev, parentId: e.target.value === SYLLABUS_ROOT_ID ? null : e.target.value } : null)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value={SYLLABUS_ROOT_ID}>无 (顶级分类)</option>
              {syllabusItems.filter(i => i.id !== editingItem?.id && i.id !== SYLLABUS_ROOT_ID).map(opt => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button onClick={closeModal} variant="ghost">取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
