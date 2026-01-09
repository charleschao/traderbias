import React, { useState } from 'react';

/**
 * Info tooltip component - shows an (i) icon that reveals explanation on hover
 * Similar to CoinMarketMan's info tooltips
 */
const InfoTooltip = ({ children, position = 'bottom-left' }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Position classes for the tooltip
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
                className="w-4 h-4 flex items-center justify-center rounded-full border border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-400 transition-colors text-[10px] font-semibold cursor-help"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
                aria-label="More information"
            >
                i
            </button>

            {isVisible && (
                <div
                    className={`absolute z-50 ${positionClasses[position]} w-72 p-3 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl animate-fadeIn`}
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={() => setIsVisible(false)}
                >
                    <div className="text-xs text-slate-200 leading-relaxed">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InfoTooltip;
