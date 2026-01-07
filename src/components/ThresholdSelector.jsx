import React from 'react';

// Available threshold options in USD
export const THRESHOLD_OPTIONS = [
    { value: 450_000, label: '450K' },
    { value: 1_000_000, label: '1M' },
    { value: 4_000_000, label: '4M' },
    { value: 10_000_000, label: '10M' },
];

/**
 * Dropdown to select whale trade threshold
 */
const ThresholdSelector = ({ value, onChange }) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 border border-slate-600 text-amber-400 text-xs font-bold px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
            title="Filter trades by minimum size"
        >
            {THRESHOLD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}+
                </option>
            ))}
        </select>
    );
};

export default ThresholdSelector;
