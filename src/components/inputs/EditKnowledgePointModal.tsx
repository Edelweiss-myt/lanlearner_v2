import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { KnowledgePointItem } from '../../types';

interface EditKnowledgePointModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgePoint: KnowledgePointItem;
  onSave: (updatedKp: KnowledgePointItem) => void;
}

export const EditKnowledgePointModal: React.FC<EditKnowledgePointModalProps> = ({
  isOpen,
  onClose,
  knowledgePoint,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && knowledgePoint) {
      setTitle(knowledgePoint.title);
      setContent(knowledgePoint.content);
      setNotes(knowledgePoint.notes || '');
      setError(null);
    }
  }, [isOpen, knowledgePoint]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      setError('标题和内容为必填项。');
      return;
    }
    onSave({
      ...knowledgePoint,
      title: title.trim(),
      content: content.trim(), // Content is preserved as is (including newlines)
      notes: notes.trim() || undefined,
    });
    onClose(); 
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑知识点">
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div>
          <label htmlFor="edit-kp-title" className="block text-sm font-medium text-gray-700">
            标题
          </label>
          <input
            type="text"
            id="edit-kp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
          />
        </div>
        <div>
          <label htmlFor="edit-kp-content" className="block text-sm font-medium text-gray-700">
            内容 / 解释
          </label>
          <textarea
            id="edit-kp-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
          ></textarea>
        </div>
        <div>
          <label htmlFor="edit-kp-notes" className="block text-sm font-medium text-gray-700">
            备注 (可选)
          </label>
          <textarea
            id="edit-kp-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
          ></textarea>
        </div>
        <div className="flex justify-end space-x-2 pt-2">
          <Button onClick={onClose} variant="ghost">
            取消
          </Button>
          <Button onClick={handleSave}>保存更改</Button>
        </div>
      </div>
    </Modal>
  );
};