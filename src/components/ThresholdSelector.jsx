import React from 'react';

export const THRESHOLD_OPTIONS = [
  { value: 450_000, label: '450K' },
  { value: 1_000_000, label: '1M' },
  { value: 4_000_000, label: '4M' },
  { value: 10_000_000, label: '10M' },
];

const ThresholdSelector = ({ value, onChange }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-slate-700 border border-neutral-300 dark:border-slate-600 text-neutral-900 dark:text-white text-xs font-semibold px-2 py-1 rounded cursor-pointer hover:border-neutral-400 dark:hover:border-slate-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-slate-500"
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
