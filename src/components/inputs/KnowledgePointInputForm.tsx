import React, { useState } from 'react';
import { KnowledgePointItem, SyllabusItem } from '../../types';
import { Button } from '../common/Button';
import { SYLLABUS_ROOT_ID } from '../../constants';

interface KnowledgePointInputFormProps {
  onAddKnowledgePoint: (kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type'>) => void;
  syllabusItems: SyllabusItem[];
}

export const KnowledgePointInputForm: React.FC<KnowledgePointInputFormProps> = ({ onAddKnowledgePoint, syllabusItems }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const renderSyllabusOptions = (items: SyllabusItem[], parentId: string | null = SYLLABUS_ROOT_ID, depth = 0): React.ReactNode[] => {
    const children = items.filter(item => item.parentId === parentId || (parentId === SYLLABUS_ROOT_ID && !item.parentId && item.id !== SYLLABUS_ROOT_ID) || (parentId === SYLLABUS_ROOT_ID && item.id === SYLLABUS_ROOT_ID));
    let options: React.ReactNode[] = [];
    
    children.forEach(item => {
      // Do not render the root item itself as a selectable option if it's the one named "All Topics" / "所有主题"
      if (item.id === SYLLABUS_ROOT_ID && parentId === SYLLABUS_ROOT_ID) { //This condition ensures we are talking about the root syllabus node if it's passed in items
          // Render its children directly if parentId is SYLLABUS_ROOT_ID (conceptual root)
          const childItems = items.filter(si => si.id !== SYLLABUS_ROOT_ID);
          options = options.concat(renderSyllabusOptions(childItems, item.id, depth + 0)); // depth doesn't increment for conceptual root's direct children list
          return; // stop processing this item further in this loop
      }
      
      options.push(
        <option key={item.id} value={item.id}>
          {'\u00A0'.repeat(depth * 4) + item.title}
        </option>
      );
      const childItems = items.filter(si => si.id !== SYLLABUS_ROOT_ID);
      if (item.id !== SYLLABUS_ROOT_ID) { 
         options = options.concat(renderSyllabusOptions(childItems, item.id, depth + 1));
      }
    });
    return options;
  };


  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-xl font-semibold mb-4 text-gray-700">添加新知识点</h3>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="kp-title" className="block text-sm font-medium text-gray-700">标题</label>
          <input
            type="text"
            id="kp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="例如: 现在简单时"
          />
        </div>
        <div>
          <label htmlFor="kp-content" className="block text-sm font-medium text-gray-700">内容 / 解释</label>
          <textarea
            id="kp-content"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="解释概念，提供例子等。"
          ></textarea>
        </div>
        <div>
          <label htmlFor="kp-syllabus" className="block text-sm font-medium text-gray-700">分类 (可选)</label>
          <select
            id="kp-syllabus"
            value={selectedSyllabusId || ''}
            onChange={(e) => setSelectedSyllabusId(e.target.value || null)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">无分类 / 通用</option>
            {renderSyllabusOptions(syllabusItems.filter(si => si.id !== SYLLABUS_ROOT_ID), null, 0)}
            {syllabusItems.filter(si => si.id !== SYLLABUS_ROOT_ID && si.parentId === null).length === 0 && <option disabled>尚未定义分类</option>}
          </select>
        </div>
         <div>
          <label htmlFor="kp-notes" className="block text-sm font-medium text-gray-700">备注 (可选)</label>
          <textarea
            id="kp-notes"
            name="kp-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="任何额外备注..."
          ></textarea>
        </div>
        <Button type="submit" className="w-full">添加知识点</Button>
      </form>
    </div>
  );
};