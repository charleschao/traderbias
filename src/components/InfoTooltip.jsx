import React, { useState } from 'react';

const InfoTooltip = ({ children, position = 'bottom-left' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    'bottom-left': 'top-full right-0 mt-2',
    'bottom-right': 'top-full left-0 mt-2',
    'top-left': 'bottom-full right-0 mb-2',
    'top-right': 'bottom-full left-0 mb-2',
    'left': 'right-full top-1/2 -translate-y-1/2 mr-2',
    'right': 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        className="w-4 h-4 flex items-center justify-center rounded-full border border-neutral-300 dark:border-slate-600 text-neutral-400 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-900 dark:hover:border-slate-400 transition-colors text-[10px] font-semibold cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
        aria-label="More information"
      >
        i
      </button>

      {isVisible && (
        <div
          className={`absolute z-[100] ${positionClasses[position]} w-80 p-3 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg shadow-lg dark:shadow-slate-900/50 animate-fadeIn`}
          style={{ maxWidth: '90vw' }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className="text-xs text-neutral-700 dark:text-slate-300 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
