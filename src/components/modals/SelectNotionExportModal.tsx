
import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface SelectNotionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSelected: (exportType: 'main' | string, subjectCatName?: string) => void; // 'main' or primaryNewKnowledgeSubjectCategoryId
  mainSyllabusName: string;
  primaryNewKnowledgeSubject: { id: string; name: string } | null; // The primary top-level category from newKnowledgeSyllabus
}

export const SelectNotionExportModal: React.FC<SelectNotionExportModalProps> = ({
  isOpen,
  onClose,
  onExportSelected,
  mainSyllabusName,
  primaryNewKnowledgeSubject,
}) => {
  const [selectedExport, setSelectedExport] = useState<'main' | string>('main');

  const handleConfirm = () => {
    let nameForExport = mainSyllabusName;
    if (selectedExport !== 'main' && primaryNewKnowledgeSubject && selectedExport === primaryNewKnowledgeSubject.id) {
        nameForExport = primaryNewKnowledgeSubject.name;
    }
    onExportSelected(selectedExport, nameForExport);
  };
  
  // Ensure default selection is valid
  React.useEffect(() => {
    if (isOpen) { // Reset on open
        if (primaryNewKnowledgeSubject) {
            setSelectedExport('main'); // Default to main, or could be primaryNewKnowledgeSubject.id
        } else {
            setSelectedExport('main');
        }
    }
  }, [isOpen, primaryNewKnowledgeSubject]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="选择要导入Notion的内容">
      <div className="space-y-4">
        <div>
          <label htmlFor="notion-export-select" className="block text-sm font-medium text-gray-700 mb-1">
            选择导出源:
          </label>
          <select
            id="notion-export-select"
            value={selectedExport}
            onChange={(e) => setSelectedExport(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="main">{mainSyllabusName}</option>
            {primaryNewKnowledgeSubject && (
              <option key={primaryNewKnowledgeSubject.id} value={primaryNewKnowledgeSubject.id}>
                主学体系: {primaryNewKnowledgeSubject.name}
              </option>
            )}
          </select>
        </div>
        {!primaryNewKnowledgeSubject && selectedExport !== 'main' && (
            <p className="text-sm text-yellow-600">提示: 尚未设置主学体系。</p>
        )}

        <div className="flex justify-end space-x-2 pt-2">
          <Button onClick={onClose} variant="ghost">
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedExport || (!primaryNewKnowledgeSubject && selectedExport !== 'main')}>
            确认并导出
          </Button>
        </div>
      </div>
    </Modal>
  );
};