import React from 'react';

// BiasHistoryBar - Shows last 15 minutes of bias signals as colored blocks
const BiasHistoryBar = ({ history = [], label = '15m' }) => {
    // Ensure we have 15 blocks (one per minute)
    const blocks = [];

    for (let i = 0; i < 15; i++) {
        const entry = history[i];
        let color = 'bg-slate-600'; // Default neutral
        let title = 'No data';

        if (entry) {
            const score = entry.score || 0;
            if (score >= 0.4) {
                color = 'bg-green-500';
                title = `Strong Bull (${(score * 100).toFixed(0)}%)`;
            } else if (score >= 0.2) {
                color = 'bg-green-400';
                title = `Bullish (${(score * 100).toFixed(0)}%)`;
            } else if (score >= 0.05) {
                color = 'bg-lime-400';
                title = `Lean Bull (${(score * 100).toFixed(0)}%)`;
            } else if (score > -0.05) {
                color = 'bg-slate-500';
                title = `Neutral (${(score * 100).toFixed(0)}%)`;
            } else if (score > -0.2) {
                color = 'bg-orange-400';
                title = `Lean Bear (${(score * 100).toFixed(0)}%)`;
            } else if (score > -0.4) {
                color = 'bg-red-400';
                title = `Bearish (${(score * 100).toFixed(0)}%)`;
            } else {
                color = 'bg-red-500';
                title = `Strong Bear (${(score * 100).toFixed(0)}%)`;
            }
        }

        blocks.push(
            <div
                key={i}
                className={`h-2 w-1.5 rounded-sm ${color} transition-colors duration-300`}
                title={title}
            />
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-0.5">
                {blocks}
            </div>
            <div className="flex justify-between text-[8px] text-slate-500">
                <span>{label} ago</span>
                <span>now</span>
            </div>
        </div>
    );
};

export default BiasHistoryBar;
