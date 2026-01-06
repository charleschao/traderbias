import React from 'react';

const SectionBiasHeader = ({ title, icon, bias, updateInterval }) => (
    <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {icon} {title}
            <span className="text-[10px] font-normal text-slate-400">Updates: {updateInterval}</span>
        </h3>
        {bias && (
            <div className={`px-2 py-1 rounded text-xs font-bold ${bias.bg} ${bias.color}`}>
                {bias.icon} {bias.label}
            </div>
        )}
    </div>
);

export default SectionBiasHeader;
