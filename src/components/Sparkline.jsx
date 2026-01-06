import React from 'react';

/**
 * Lightweight sparkline component for inline trend visualization
 * No external dependencies - pure SVG
 */
const Sparkline = ({
    data = [],
    width = 60,
    height = 20,
    strokeWidth = 1.5,
    color = null, // auto-detect from trend if null
    className = ''
}) => {
    if (!data || data.length < 2) {
        return (
            <svg width={width} height={height} className={className}>
                <line
                    x1={0} y1={height / 2} x2={width} y2={height / 2}
                    stroke="#475569" strokeWidth={strokeWidth} strokeDasharray="2,2"
                />
            </svg>
        );
    }

    // Normalize data to fit within SVG bounds
    const values = data.filter(d => d != null).map(d => (typeof d === 'object' ? d.value : d));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Calculate padding for stroke
    const padding = strokeWidth;
    const innerHeight = height - (padding * 2);
    const innerWidth = width - (padding * 2);

    // Generate SVG path points
    const points = values.map((val, i) => {
        const x = padding + (i / (values.length - 1)) * innerWidth;
        const y = padding + innerHeight - ((val - min) / range) * innerHeight;
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    // Determine color based on trend (first vs last value)
    const trend = values[values.length - 1] - values[0];
    const strokeColor = color || (trend >= 0 ? '#22c55e' : '#ef4444'); // green-500 / red-500

    // Create gradient fill
    const fillColor = trend >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // Create fill path (close the area under the line)
    const fillPathD = `${pathD} L ${padding + innerWidth},${height - padding} L ${padding},${height - padding} Z`;

    return (
        <svg
            width={width}
            height={height}
            className={className}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
        >
            {/* Area fill under line */}
            <path
                d={fillPathD}
                fill={fillColor}
            />
            {/* Main line */}
            <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End point dot */}
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
