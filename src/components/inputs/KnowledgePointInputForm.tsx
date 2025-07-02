import React, { useState, useRef, useEffect } from 'react';
import { KnowledgePointItem, SyllabusItem } from '../../types';
import { Button } from '../common/Button';
// Removed unused import: import { SYLLABUS_ROOT_ID, NEW_KNOWLEDGE_SYLLABUS_ROOT_ID } from '../../constants';

interface KnowledgePointInputFormProps {
  onAddKnowledgePoint: (kp: Omit<KnowledgePointItem, 'id' | 'createdAt' | 'lastReviewedAt' | 'nextReviewAt' | 'srsStage' | 'type' | 'masterId' | 'subjectId'>) => void;
  syllabusItems: SyllabusItem[]; // Full syllabus for the current context (main or new knowledge)
  isNewSubjectContext: boolean; // True if this form is for the newKnowledgeSyllabus
  syllabusRootId: string; // SYLLABUS_ROOT_ID or NEW_KNOWLEDGE_SYLLABUS_ROOT_ID
  activeNewSubjectNameProp?: string | null; // Name of the primary "subject" category if in new knowledge context
  preferredSyllabusId?: string | null;
}

export const KnowledgePointInputForm: React.FC<KnowledgePointInputFormProps> = ({
  onAddKnowledgePoint,
  syllabusItems,
  isNewSubjectContext,
  syllabusRootId,
  activeNewSubjectNameProp,
  preferredSyllabusId
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const [imageExtension, setImageExtension] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to compress image
  const compressImage = async (dataUrl: string, maxSizeKB: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const MAX_WIDTH = 800; // Define max width for compressed image
        const MAX_HEIGHT = 800; // Define max height for compressed image
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

        let quality = 0.8; // Initial quality
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Compress until size is under maxSizeKB or quality is too low
        while (compressedDataUrl.length * 0.75 / 1024 > maxSizeKB && quality > 0.1) {
          quality -= 0.05;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(dataUrl); // In case of error, return original
      };
    });
  };

  useEffect(() => {
    setSelectedSyllabusId(preferredSyllabusId || null);
  }, [preferredSyllabusId]);

  useEffect(() => {
    if (!preferredSyllabusId) {
      setSelectedSyllabusId(null);
    }
  }, [syllabusRootId, syllabusItems, activeNewSubjectNameProp, preferredSyllabusId]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalDataUrl = reader.result as string;
        // Check file size before compression
        const originalSizeKB = originalDataUrl.length * 0.75 / 1024; // Base64 to KB approximation
        console.log(`Original image size: ${originalSizeKB.toFixed(2)} KB`);

        if (originalSizeKB > 100) { // Only compress if larger than 100KB (0.1MB)
          try {
            const compressedDataUrl = await compressImage(originalDataUrl, 100); // Compress to 100KB
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
      };
      reader.readAsDataURL(file);
    }
  };

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
      imageUrl,
      imageName: imageName ? `${imageName.trim()}${imageExtension}` : undefined,
    });
    setTitle('');
    setContent('');
    setNotes('');
    setImageUrl(undefined);
    setImageName(undefined);
    setImageExtension(undefined);
    if (!preferredSyllabusId) {
        setSelectedSyllabusId(null);
    }
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
                <label htmlFor={`kp-image-name-${syllabusRootId}`} className="block text-sm font-medium text-gray-700">图片名称 (可选)</label>
                <div className="mt-1 flex items-center">
                  <input
                      type="text"
                      id={`kp-image-name-${syllabusRootId}`}
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
