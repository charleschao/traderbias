import { EXCHANGES, DEFAULT_EXCHANGE } from '../config/exchanges';

// ============== FORMATTERS ==============
export const formatUSD = (value, compact = true) => {
    const num = Math.abs(parseFloat(value) || 0);
    const sign = parseFloat(value) < 0 ? '-' : '';
    if (num >= 1e9) return `${sign}$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${sign}$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${sign}$${(num / 1e3).toFixed(compact ? 1 : 2)}K`;
    return `${sign}$${num.toFixed(2)}`;
};

export const formatPercent = (value) => {
    const num = parseFloat(value) * 100;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

export const formatPrice = (price) => {
    const p = parseFloat(price);
    if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (p >= 100) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return p.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

export const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const getProfileUrl = (addr, exchangeId = DEFAULT_EXCHANGE) => {
    const exchange = EXCHANGES[exchangeId] || EXCHANGES[DEFAULT_EXCHANGE];
    return exchange.profileUrl(addr);
};

export const timeAgo = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};
