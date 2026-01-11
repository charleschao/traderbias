import React from 'react';

/**
 * Notification toggle button for whale alerts
 */
const NotificationToggle = ({
    enabled,
    permission,
    isSupported,
    onToggle
}) => {
    if (!isSupported) {
        return (
            <div className="text-xs text-slate-400" title="Browser doesn't support notifications">
                🔕 No notifications
            </div>
        );
    }

    const getStatusText = () => {
        if (permission === 'denied') return 'Blocked';
        if (enabled) return 'ON';
        return 'OFF';
    };

    const getStatusColor = () => {
        if (permission === 'denied') return 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-500/10';
        if (enabled) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/10';
        return 'text-neutral-600 dark:text-slate-400 bg-neutral-200 dark:bg-slate-700/50';
    };

    return (
        <button
            onClick={onToggle}
            disabled={permission === 'denied'}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all ${getStatusColor()} ${permission === 'denied' ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
            title={permission === 'denied' ? 'Notifications blocked - enable in browser settings' : enabled ? 'Click to disable notifications' : 'Click to enable notifications'}
        >
            <span>{enabled ? '🔔' : '🔕'}</span>
            <span>Alerts {getStatusText()}</span>
        </button>
    );
};

export default NotificationToggle;
