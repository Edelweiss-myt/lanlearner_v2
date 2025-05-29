import React from 'react';
import { ActiveTab } from '../../types';

interface TabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const tabOptions: ActiveTab[] = Object.values(ActiveTab); // Explicitly type here

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="mb-6 border-b border-gray-300">
      <nav className="-mb-px flex space-x-4" aria-label="Tabs">
        {tabOptions.map((tab) => ( // tab is now correctly typed as ActiveTab (string)
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
};