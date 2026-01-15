import React from 'react';

const BiasHistoryBar = ({ history = [], label = '15m' }) => {
  const blocks = [];
  const titles = [];

  for (let i = 0; i < 15; i++) {
    const entry = history[i];
    let color = 'bg-neutral-200';
    let title = 'No data';

    if (entry) {
      const score = entry.score || 0;
      if (score >= 0.2) {
        color = 'bg-green-500';
        title = `Bullish (${(score * 100).toFixed(0)}%)`;
      } else if (score >= 0.05) {
        color = 'bg-green-300';
        title = `Lean Bull (${(score * 100).toFixed(0)}%)`;
      } else if (score > -0.05) {
        color = 'bg-neutral-300';
        title = `Neutral (${(score * 100).toFixed(0)}%)`;
      } else if (score > -0.2) {
        color = 'bg-red-300';
        title = `Lean Bear (${(score * 100).toFixed(0)}%)`;
      } else {
        color = 'bg-red-500';
        title = `Bearish (${(score * 100).toFixed(0)}%)`;
      }
    }

    titles.push(title);
    blocks.push(
      <div
        key={i}
        className={`h-2 w-1.5 rounded-sm ${color} transition-colors duration-300`}
        title={title}
        aria-hidden="true"
      />
    );
  }

  const latestBias = titles[titles.length - 1] || 'No data';

  return (
    <div className="flex flex-col gap-1" role="img" aria-label={`Bias history over ${label}: current is ${latestBias}`}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {blocks}
      </div>
      <div className="flex justify-between text-[8px] text-neutral-400">
        <span>{label} ago</span>
        <span>now</span>
      </div>
    </div>
  );
};

export default BiasHistoryBar;
