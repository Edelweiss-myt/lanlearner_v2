
import React from 'react';
import { Button } from '../common/Button';

interface InitialSelectionScreenProps {
  onSelectLearn: () => void;
  onSelectReview: () => void;
  activePrimaryNewSubjectName: string | null; 
  onSelectNewSubject: () => void;
}

export const InitialSelectionScreen: React.FC<InitialSelectionScreenProps> = ({ 
  onSelectLearn, 
  onSelectReview,
  activePrimaryNewSubjectName,
  onSelectNewSubject
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary-500 to-secondary-500 p-4 text-white">
      <div className="text-center bg-white/20 backdrop-blur-md p-8 md:p-12 rounded-xl shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">Lanlearner 🚀</h1>
        <p className="text-lg md:text-xl mb-8 text-primary-100">
          您有到期的复习项目
          {activePrimaryNewSubjectName && `，或可继续您的主学 "${activePrimaryNewSubjectName}" 的学习`}！
        </p>
        <div className="space-y-4 md:space-y-0 md:space-x-6 flex flex-col md:flex-row justify-center items-center">
          <Button
            onClick={onSelectReview}
            variant="secondary"
            size="lg"
            className="shadow-lg transform hover:scale-105 transition-transform duration-150 w-full md:w-auto"
          >
            开始复习
          </Button>
          <Button
            onClick={onSelectLearn}
            variant="primary"
            size="lg"
            className="shadow-lg transform hover:scale-105 transition-transform duration-150 w-full md:w-auto"
          >
            学习新知识
          </Button>
          <Button
            onClick={onSelectNewSubject} 
            variant="primary" 
            style={{backgroundColor: '#14b8a6', borderColor: '#0f766e'}} // Teal color
            size="lg"
            className="shadow-lg transform hover:scale-105 transition-transform duration-150 w-full md:w-auto"
          >
            {activePrimaryNewSubjectName ? `"${activePrimaryNewSubjectName}" 主学体系` : "搭建新体系"}
          </Button>
        </div>
      </div>
       <footer className="absolute bottom-4 text-center text-xs text-primary-200/80">
        © {new Date().getFullYear()} Lanlearner
      </footer>
    </div>
  );
};