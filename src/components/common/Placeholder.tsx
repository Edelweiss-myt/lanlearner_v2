import React from 'react';

interface PlaceholderProps {
  text?: string;
  height?: string | number;
  width?: string | number;
  className?: string;
  icon?: React.ReactNode; // Optional icon
}

/**
 * A generic placeholder component.
 * Can be used to signify areas where content will be loaded or features are planned.
 */
export const Placeholder: React.FC<PlaceholderProps> = ({
  text = 'Placeholder Content',
  height = '100px',
  width = '100%',
  className = '',
  icon,
}) => {
  const style: React.CSSProperties = {
    height,
    width,
    display: 'flex',
    flexDirection: 'column', // Allow icon and text to stack
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed #cbd5e1', // slate-300 from Tailwind config
    backgroundColor: '#f8fafc',   // slate-50 from Tailwind config (lighter than slate-100)
    color: '#64748b',         // slate-500
    borderRadius: '0.375rem', // rounded-md
    padding: '1rem',
    textAlign: 'center',
    gap: '0.5rem', // Space between icon and text
  };

  return (
    <div
      style={style}
      className={`placeholder-component ${className}`}
      role="status"
      aria-label={text}
    >
      {icon && <div className="placeholder-icon" style={{ fontSize: '2rem', marginBottom: text ? '0.5rem' : '0' }}>{icon}</div>}
      {text && <p className="text-sm">{text}</p>}
    </div>
  );
};
