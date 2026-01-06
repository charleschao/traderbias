import React, { useState, useEffect } from 'react';

/**
 * Platform Improvements Panel
 *
 * Displays findings from the Platform Improvement Research Agent
 * Shows feature gaps, data quality issues, UX improvements, and performance optimizations
 */
export default function PlatformImprovementsPanel({ agentReport }) {
    const [activeTab, setActiveTab] = useState('quickWins');
    const [expandedItems, setExpandedItems] = useState(new Set());

    if (!agentReport) {
        return (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                    <p className="text-slate-400">Analyzing platform...</p>
                </div>
            </div>
        );
    }

    const { summary, findings, topRecommendations, quickWins } = agentReport;

    const toggleExpand = (index) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    const getPriorityColor = (priority) => {
        const colors = {
            critical: 'text-red-400 bg-red-500/20',
            high: 'text-orange-400 bg-orange-500/20',
            medium: 'text-yellow-400 bg-yellow-500/20',
            low: 'text-blue-400 bg-blue-500/20'
        };
        return colors[priority] || colors.low;
    };

    const getPriorityIcon = (priority) => {
        const icons = {
            critical: '🚨',
            high: '⚡',
            medium: '💡',
            low: '✨'
        };
        return icons[priority] || '📌';
    };

    const getTypeIcon = (type) => {
        const icons = {
            feature_gap: '🎯',
            data_quality: '📊',
            ux_improvement: '🎨',
            performance: '⚡'
        };
        return icons[type] || '📋';
    };

    const getEffortBadge = (effort) => {
        const badges = {
            very_low: { label: 'Quick Win', color: 'bg-green-500/20 text-green-400' },
            low: { label: 'Easy', color: 'bg-lime-500/20 text-lime-400' },
            medium: { label: 'Moderate', color: 'bg-yellow-500/20 text-yellow-400' },
            high: { label: 'Complex', color: 'bg-orange-500/20 text-orange-400' },
            very_high: { label: 'Major Project', color: 'bg-red-500/20 text-red-400' }
        };
        const badge = badges[effort] || badges.medium;
        return <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>{badge.label}</span>;
    };

    const renderFindingCard = (finding, index) => {
        const isExpanded = expandedItems.has(index);

        return (
            <div
                key={index}
                className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
            >
                {/* Header - Always Visible */}
                <button
                    onClick={() => toggleExpand(index)}
                    className="w-full p-4 text-left flex items-start gap-3 hover:bg-slate-700/30 transition-colors"
                >
                    <span className="text-2xl flex-shrink-0">{getTypeIcon(finding.type)}</span>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="text-white font-medium">{finding.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPriorityColor(finding.priority || 'medium')}`}>
                                {finding.priority || 'medium'}
                            </span>
                            {finding.effort && getEffortBadge(finding.effort)}
                            {finding.edgeValue !== undefined && (
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                    Edge: {finding.edgeValue}/100
                                </span>
                            )}
                        </div>
                        <p className="text-slate-400 text-sm">{finding.description}</p>
                    </div>

                    <span className="text-slate-500 flex-shrink-0">
                        {isExpanded ? '▼' : '▶'}
                    </span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
                        {finding.impact && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Impact</p>
                                <p className="text-green-400 text-sm">{finding.impact}</p>
                            </div>
                        )}

                        {finding.userBenefit && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">User Benefit</p>
                                <p className="text-green-400 text-sm">{finding.userBenefit}</p>
                            </div>
                        )}

                        {finding.reasoning && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Why This Matters</p>
                                <p className="text-slate-300 text-sm">{finding.reasoning}</p>
                            </div>
                        )}

                        {finding.fixSuggestion && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fix Suggestion</p>
                                <p className="text-blue-400 text-sm">{finding.fixSuggestion}</p>
                            </div>
                        )}

                        {finding.implementation && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Implementation</p>
                                <p className="text-blue-400 text-sm">{finding.implementation}</p>
                            </div>
                        )}

                        {finding.optimization && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Optimization</p>
                                <p className="text-blue-400 text-sm">{finding.optimization}</p>
                            </div>
                        )}

                        {finding.affectedFeatures && finding.affectedFeatures.length > 0 && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Affected Features</p>
                                <div className="flex flex-wrap gap-2">
                                    {finding.affectedFeatures.map((feature, i) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300">
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {finding.file && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">File Location</p>
                                <code className="text-xs text-cyan-400 bg-slate-900/50 px-2 py-1 rounded">
                                    {finding.file}:{finding.line}
                                </code>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-slate-900/50 rounded-lg border border-slate-700">
            {/* Header */}
            <div className="border-b border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">Platform Improvement Research Agent</h3>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">
                            Last Analysis: {new Date(agentReport.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                                {summary.critical} Critical
                            </span>
                            <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                                {summary.high} High
                            </span>
                            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">
                                {summary.medium} Medium
                            </span>
                            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                                {summary.low} Low
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('quickWins')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'quickWins'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-white'
                            }`}
                    >
                        ⚡ Quick Wins ({quickWins?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('topRecommendations')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'topRecommendations'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-white'
                            }`}
                    >
                        🎯 Top Edge Features ({topRecommendations?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('critical')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-white'
                            }`}
                    >
                        🚨 Critical ({findings.critical?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'all'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-white'
                            }`}
                    >
                        📋 All Issues ({summary.total})
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {activeTab === 'quickWins' && (
                    <div className="space-y-3">
                        {quickWins && quickWins.length > 0 ? (
                            quickWins.map((finding, idx) => renderFindingCard(finding, `qw-${idx}`))
                        ) : (
                            <p className="text-slate-400 text-center py-8">No quick wins identified</p>
                        )}
                    </div>
                )}

                {activeTab === 'topRecommendations' && (
                    <div className="space-y-3">
                        {topRecommendations && topRecommendations.length > 0 ? (
                            topRecommendations.map((finding, idx) => renderFindingCard(finding, `top-${idx}`))
                        ) : (
                            <p className="text-slate-400 text-center py-8">No top recommendations available</p>
                        )}
                    </div>
                )}

                {activeTab === 'critical' && (
                    <div className="space-y-3">
                        {findings.critical && findings.critical.length > 0 ? (
                            findings.critical.map((finding, idx) => renderFindingCard(finding, `crit-${idx}`))
                        ) : (
                            <p className="text-green-400 text-center py-8">✅ No critical issues found!</p>
                        )}
                    </div>
                )}

                {activeTab === 'all' && (
                    <div className="space-y-4">
                        {['critical', 'high', 'medium', 'low'].map(priority => {
                            const items = findings[priority] || [];
                            if (items.length === 0) return null;

                            return (
                                <div key={priority}>
                                    <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${getPriorityColor(priority)}`}>
                                        {getPriorityIcon(priority)} {priority.toUpperCase()} ({items.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {items.map((finding, idx) => renderFindingCard(finding, `${priority}-${idx}`))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
