import React from 'react';

const Sparkline = ({
  data = [],
  width = 60,
  height = 20,
  strokeWidth = 1.5,
  color = null,
  className = ''
}) => {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="#d4d4d4" strokeWidth={strokeWidth} strokeDasharray="2,2"
        />
      </svg>
    );
  }

  const values = data.filter(d => d != null).map(d => (typeof d === 'object' ? d.value : d));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = strokeWidth;
  const innerHeight = height - (padding * 2);
  const innerWidth = width - (padding * 2);

  const points = values.map((val, i) => {
    const x = padding + (i / (values.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((val - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  const trend = values[values.length - 1] - values[0];
  const strokeColor = color || (trend >= 0 ? '#16a34a' : '#dc2626'); // green-600 / red-600

  const fillColor = trend >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)';

  const fillPathD = `${pathD} L ${padding + innerWidth},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={fillPathD} fill={fillColor} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={padding + innerWidth}
        cy={padding + innerHeight - ((values[values.length - 1] - min) / range) * innerHeight}
        r={strokeWidth}
        fill={strokeColor}
      />
    </svg>
  );
};

export default Sparkline;
