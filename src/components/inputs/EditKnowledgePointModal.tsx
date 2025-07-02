import React, { useState, useEffect, useRef } from 'react';
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
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const [imageExtension, setImageExtension] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (dataUrl: string, maxSizeKB: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        let quality = 0.8; 
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        while (compressedDataUrl.length * 0.75 / 1024 > maxSizeKB && quality > 0.1) {
          quality -= 0.05;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(dataUrl); 
      };
    });
  };

  useEffect(() => {
    if (isOpen && knowledgePoint) {
      setTitle(knowledgePoint.title);
      setContent(knowledgePoint.content);
      setNotes(knowledgePoint.notes || '');
      setImageUrl(knowledgePoint.imageUrl);
      setImageName(knowledgePoint.imageName ? knowledgePoint.imageName.split('.')[0] : undefined);
      setImageExtension(knowledgePoint.imageName ? `.${knowledgePoint.imageName.split('.').pop()}` : undefined);
      setError(null);
    }
  }, [isOpen, knowledgePoint]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalDataUrl = reader.result as string;
        const originalSizeKB = originalDataUrl.length * 0.75 / 1024; 
        console.log(`Original image size: ${originalSizeKB.toFixed(2)} KB`);

        if (originalSizeKB > 100) { 
          try {
            const compressedDataUrl = await compressImage(originalDataUrl, 100); 
            const compressedSizeKB = compressedDataUrl.length * 0.75 / 1024;
            console.log(`Compressed image size: ${compressedSizeKB.toFixed(2)} KB`);
            setImageUrl(compressedDataUrl);
          } catch (e) {
            console.error("Error compressing image, using original:", e);
            setImageUrl(originalDataUrl);
          }
        } else {
          setImageUrl(originalDataUrl);
        }
        
        const extension = file.name.slice(file.name.lastIndexOf('.'));
        setImageExtension(extension);
        if (!imageName) {
          setImageName(file.name.slice(0, file.name.lastIndexOf('.')));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      setError('标题和内容为必填项。');
      return;
    }
    onSave({
      ...knowledgePoint,
      title: title.trim(),
      content: content.trim(),
      notes: notes.trim() || undefined,
      imageUrl: imageUrl || undefined,
      imageName: imageName && imageExtension ? `${imageName.trim()}${imageExtension}` : undefined,
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
           <label className="block text-sm font-medium text-gray-700">图片 (可选)</label>
           <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          {imageUrl ? (
            <div className="mt-2 space-y-2">
              <img src={imageUrl} alt="Preview" className="max-h-40 rounded-lg border" />
              <div>
                <label htmlFor="edit-kp-image-name" className="block text-sm font-medium text-gray-700">图片名称 (可选)</label>
                <div className="mt-1 flex items-center">
                  <input
                      type="text"
                      id="edit-kp-image-name"
                      value={imageName || ''}
                      onChange={(e) => setImageName(e.target.value)}
                      className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
                      placeholder="为图片添加一个名称"
                  />
                  {imageExtension && <span className="ml-2 text-gray-500">{imageExtension}</span>}
                </div>
              </div>
              <Button type="button" onClick={() => { setImageUrl(undefined); setImageName(undefined); setImageExtension(undefined); }} className="mt-2" variant="danger_outline">移除图片</Button>
            </div>
          ) : (
            <Button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2">添加图片</Button>
          )}
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
