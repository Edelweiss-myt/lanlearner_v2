
import React, { useState } from 'react';
import { KnowledgePointItem, SyllabusItem } from '../../types';
import { Button } from '../common/Button';
// Removed unused import: import { SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../../constants';

interface KnowledgePointInputFormProps {
  onAddKnowledgePoint: (kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type' | 'masterId' | 'subjectId'>) => void;
  syllabusItems: SyllabusItem[]; // Full syllabus for the current context (main or new knowledge)
  isNewSubjectContext: boolean; // True if this form is for the newKnowledgeSyllabus
  syllabusRootId: string; // SYLLABUS_ROOT_ID or NEW_KNOWLEDGE_SYLLABUS_ROOT_ID
  activeNewSubjectNameProp?: string | null; // Name of the primary "subject" category if in new knowledge context
}

export const KnowledgePointInputForm: React.FC<KnowledgePointInputFormProps> = ({
  onAddKnowledgePoint,
  syllabusItems,
  isNewSubjectContext,
  syllabusRootId,
  activeNewSubjectNameProp
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setSelectedSyllabusId(null);
  }, [syllabusRootId, syllabusItems, activeNewSubjectNameProp]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('标题和内容为必填项。');
      return;
    }
    onAddKnowledgePoint({
      title: title.trim(),
      content: content.trim(),
      syllabusItemId: selectedSyllabusId,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setContent('');
    setNotes('');
    setSelectedSyllabusId(null);
    setError(null);
  };

  const renderSyllabusOptions = (items: SyllabusItem[], parentId: string | null, depth = 0): React.ReactNode[] => {
    const children = items.filter(item => item.parentId === parentId && item.id !== syllabusRootId);
    
    let options: React.ReactNode[] = [];
    
    children.forEach(item => {
      options.push(
        <option key={item.id} value={item.id}>
          {'\u00A0'.repeat(depth * 4) + item.title}
        </option>
      );
      options = options.concat(renderSyllabusOptions(items, item.id, depth + 1));
    });
    return options;
  };
  
  const initialParentIdForDropdown = syllabusRootId;

  const formTitle = isNewSubjectContext
    ? (activeNewSubjectNameProp ? `添加新知识点 (${activeNewSubjectNameProp})` : "添加新知识点")
    : "添加新知识点";

  return (
    <div className={`p-6 bg-white rounded-lg border ${isNewSubjectContext ? 'border-secondary-300' : 'border-gray-200'}`}>
      <h3 className="text-xl font-semibold mb-4 text-gray-700">
        {formTitle}
      </h3>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`kp-title-${syllabusRootId}`} className="block text-sm font-medium text-gray-700">标题</label>
          <input
            type="text"
            id={`kp-title-${syllabusRootId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="例如: 现在简单时"
          />
        </div>
        <div>
          <label htmlFor={`kp-content-${syllabusRootId}`} className="block text-sm font-medium text-gray-700">内容 / 解释</label>
          <textarea
            id={`kp-content-${syllabusRootId}`}
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="解释概念，提供例子等。"
          ></textarea>
        </div>
        <div>
          <label htmlFor={`kp-syllabus-${syllabusRootId}`} className="block text-sm font-medium text-gray-700">
            分类 (可选)
          </label>
          <select
            id={`kp-syllabus-${syllabusRootId}`}
            value={selectedSyllabusId || ''}
            onChange={(e) => setSelectedSyllabusId(e.target.value || null)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">
                {isNewSubjectContext ? `无分类 / ${activeNewSubjectNameProp || '新知识体系'}顶级` : "无分类 / 通用"}
            </option>
            {renderSyllabusOptions(syllabusItems, initialParentIdForDropdown, 0)}
            {syllabusItems.filter(si => si.parentId === initialParentIdForDropdown && si.id !== initialParentIdForDropdown).length === 0 && <option disabled>尚未定义有效分类</option>}
          </select>
        </div>
         <div>
          <label htmlFor={`kp-notes-${syllabusRootId}`} className="block text-sm font-medium text-gray-700">原文与备注 (可选)</label>
          <textarea
            id={`kp-notes-${syllabusRootId}`}
            name={`kp-notes-${syllabusRootId}`}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="记录知识点的原文出处、相关思考或其他备注信息..."
          ></textarea>
        </div>
        <Button type="submit" className="w-full" variant={isNewSubjectContext ? 'secondary' : 'primary'}>添加知识点</Button>
      </form>
    </div>
  );
};
