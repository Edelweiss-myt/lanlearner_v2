import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { RecentlyDeletedItem } from '../../types';
import { timeAgo } from '../../utils/dateUtils';

interface RecentlyDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentlyDeletedItems: RecentlyDeletedItem[];
  onRestoreItem: (item: RecentlyDeletedItem) => void;
}

export const RecentlyDeletedModal: React.FC<RecentlyDeletedModalProps> = ({
  isOpen,
  onClose,
  recentlyDeletedItems,
  onRestoreItem,
}) => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const itemsToShow = recentlyDeletedItems
    .filter(rd => (Date.now() - new Date(rd.deletedAt).getTime()) < TWENTY_FOUR_HOURS_MS)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="最近删除的项目 (24小时内)">
      {itemsToShow.length === 0 ? (
        <p className="text-gray-600">最近24小时内没有删除任何项目。</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {itemsToShow.map((rdItem) => (
            <div
              key={rdItem.item.id}
              className="p-3 bg-gray-50 rounded-md border border-gray-200 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-gray-800">
                  {rdItem.item.type === 'word' ? rdItem.item.text : rdItem.item.title}
                  <span className="text-xs text-gray-500 ml-1">({rdItem.item.type === 'word' ? '单词' : '知识点'})</span>
                </p>
                <p className="text-xs text-gray-500">
                  删除于: {timeAgo(new Date(rdItem.deletedAt))}
                </p>
              </div>
              <Button
                onClick={() => onRestoreItem(rdItem)}
                variant="secondary"
                size="sm"
              >
                恢复
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose} variant="primary">
          关闭
        </Button>
      </div>
    </Modal>
  );
};
