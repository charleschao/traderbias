/**
 * Platform Improvement Research Agent
 *
 * Continuously analyzes traderbias.app to identify:
 * - Missing features that provide trading edge
 * - Data quality issues
 * - UX/UI improvements
 * - Performance optimizations
 * - Bug detection
 * - Competitive feature gaps
 */

import { FeatureGapAnalyzer } from './modules/FeatureGapAnalyzer.js';
import { DataQualityValidator } from './modules/DataQualityValidator.js';
import { UXImprovementIdentifier } from './modules/UXImprovementIdentifier.js';
import { PerformanceAnalyzer } from './modules/PerformanceAnalyzer.js';

export class PlatformImprovementAgent {
    constructor() {
        this.modules = {
            featureGap: new FeatureGapAnalyzer(),
            dataQuality: new DataQualityValidator(),
            uxImprovement: new UXImprovementIdentifier(),
            performance: new PerformanceAnalyzer()
        };

        this.findings = {
            critical: [],      // Must fix - breaks trading edge
            high: [],          // Should implement - significant edge
            medium: [],        // Nice to have - moderate improvement
            low: []            // Quality of life improvements
        };

        this.lastAnalysis = null;
        this.analysisInterval = null;
    }

    /**
     * Start continuous monitoring
     */
    start(intervalMinutes = 5) {
        console.log('[PlatformAgent] Starting continuous improvement analysis...');

        // Run initial analysis
        this.runFullAnalysis();

        // Schedule periodic analysis
        this.analysisInterval = setInterval(() => {
            this.runFullAnalysis();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        console.log('[PlatformAgent] Stopped');
    }

    /**
     * Run comprehensive platform analysis
     */
    async runFullAnalysis() {
        console.log('[PlatformAgent] Running full platform analysis...');

        const timestamp = Date.now();
        const results = {
            timestamp,
            featureGaps: await this.modules.featureGap.analyze(),
            dataQuality: await this.modules.dataQuality.validate(),
            uxImprovements: await this.modules.uxImprovement.identify(),
            performance: await this.modules.performance.analyze()
        };

        // Categorize findings by priority
        this.categorizeFindings(results);

        this.lastAnalysis = results;

        console.log('[PlatformAgent] Analysis complete:', {
            critical: this.findings.critical.length,
            high: this.findings.high.length,
            medium: this.findings.medium.length,
            low: this.findings.low.length
        });

        return this.getReport();
    }

    /**
     * Categorize findings by priority
     */
    categorizeFindings(results) {
        this.findings = { critical: [], high: [], medium: [], low: [] };

        // Process feature gaps
        results.featureGaps.forEach(gap => {
            this.findings[gap.priority].push({
                type: 'feature_gap',
                title: gap.title,
                description: gap.description,
                impact: gap.impact,
                effort: gap.effort,
                edgeValue: gap.edgeValue
            });
        });

        // Process data quality issues
        results.dataQuality.forEach(issue => {
            this.findings[issue.priority].push({
                type: 'data_quality',
                title: issue.title,
                description: issue.description,
                affectedFeatures: issue.affectedFeatures,
                fixSuggestion: issue.fixSuggestion
            });
        });

        // Process UX improvements
        results.uxImprovements.forEach(improvement => {
            this.findings[improvement.priority].push({
                type: 'ux_improvement',
                title: improvement.title,
                description: improvement.description,
                userBenefit: improvement.userBenefit,
                implementation: improvement.implementation
            });
        });

        // Process performance issues
        results.performance.forEach(perf => {
            this.findings[perf.priority].push({
                type: 'performance',
                title: perf.title,
                description: perf.description,
                metric: perf.metric,
                optimization: perf.optimization
            });
        });
    }

    /**
     * Get formatted report
     */
    getReport() {
        const total = Object.values(this.findings).reduce((sum, arr) => sum + arr.length, 0);

        return {
            timestamp: this.lastAnalysis?.timestamp || Date.now(),
            summary: {
                total,
                critical: this.findings.critical.length,
                high: this.findings.high.length,
                medium: this.findings.medium.length,
                low: this.findings.low.length
            },
            findings: this.findings,
            topRecommendations: this.getTopRecommendations(5),
            quickWins: this.getQuickWins()
        };
    }

    /**
     * Get top N recommendations by edge value
     */
    getTopRecommendations(n = 5) {
        const allFindings = [
            ...this.findings.critical,
            ...this.findings.high,
            ...this.findings.medium
        ];

        return allFindings
            .filter(f => f.edgeValue !== undefined)
            .sort((a, b) => b.edgeValue - a.edgeValue)
            .slice(0, n);
    }

    /**
     * Get quick wins (high impact, low effort)
     */
    getQuickWins() {
        const allFindings = [
            ...this.findings.high,
            ...this.findings.medium
        ];

        return allFindings
            .filter(f => f.effort === 'low' || f.effort === 'very_low')
            .sort((a, b) => (b.edgeValue || 0) - (a.edgeValue || 0))
            .slice(0, 5);
    }

    /**
     * Get issues for specific feature
     */
    getFeatureIssues(featureName) {
        const allFindings = Object.values(this.findings).flat();
        return allFindings.filter(f =>
            f.affectedFeatures?.includes(featureName) ||
            f.title.toLowerCase().includes(featureName.toLowerCase())
        );
    }

    /**
     * Manual analysis trigger
     */
    async analyzeNow() {
        return await this.runFullAnalysis();
    }
}

// Export singleton instance
export const platformAgent = new PlatformImprovementAgent();
