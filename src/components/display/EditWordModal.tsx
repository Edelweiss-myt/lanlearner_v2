import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { WordItem } from '../../types';

interface EditWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: WordItem;
  onSave: (updatedWord: WordItem) => void;
}

export const EditWordModal: React.FC<EditWordModalProps> = ({
  isOpen,
  onClose,
  word,
  onSave,
}) => {
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [definition, setDefinition] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && word) {
      setPartOfSpeech(word.partOfSpeech);
      setDefinition(word.definition);
      setExampleSentence(word.exampleSentence);
      setNotes(word.notes || '');
      setError(null); // Reset error on open
    }
  }, [isOpen, word]);

  const handleSave = () => {
    if (!partOfSpeech.trim()) {
      setError('词性不能为空。');
      return;
    }
    if (!definition.trim()) {
      setError('释义不能为空。');
      return;
    }
    // Example sentence can be empty

    onSave({
      ...word,
      partOfSpeech: partOfSpeech.trim(),
      definition: definition.trim(),
      exampleSentence: exampleSentence.trim(),
      notes: notes.trim() || undefined,
    });
    setError(null);
    onClose();
  };

  if (!word) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`编辑单词: ${word.text}`}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div>
          <p className="block text-sm font-medium text-gray-700">单词</p>
          <p className="mt-1 text-gray-900 p-2 bg-gray-100 rounded-md">{word.text}</p>
        </div>
        <div>
          <label htmlFor="edit-word-pos" className="block text-sm font-medium text-gray-700">
            词性 <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-word-pos"
            type="text"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="例如: 名词, 动词"
          />
        </div>
        <div>
          <label htmlFor="edit-word-definition" className="block text-sm font-medium text-gray-700">
            释义 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="edit-word-definition"
            rows={3}
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="输入中文释义"
          ></textarea>
        </div>
        <div>
          <label htmlFor="edit-word-example" className="block text-sm font-medium text-gray-700">
            例句
          </label>
          <textarea
            id="edit-word-example"
            rows={3}
            value={exampleSentence}
            onChange={(e) => setExampleSentence(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="输入英文例句 (可选)"
          ></textarea>
        </div>
        <div>
          <label htmlFor="edit-word-notes" className="block text-sm font-medium text-gray-700">
            备注 (可选)
          </label>
          <textarea
            id="edit-word-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
            placeholder="关于这个单词的任何额外备注..."
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

