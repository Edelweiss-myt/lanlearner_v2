import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  let sizeClasses = 'h-8 w-8';
  if (size === 'sm') sizeClasses = 'h-5 w-5';
  if (size === 'lg') sizeClasses = 'h-12 w-12';

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <svg
        className={`animate-spin text-primary-600 ${sizeClasses}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );
};