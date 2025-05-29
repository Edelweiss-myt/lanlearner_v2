import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold">Lanlearner 🚀</h1>
        <p className="text-sm text-primary-200">您的个人语言学习伙伴</p>
      </div>
    </header>
  );
};