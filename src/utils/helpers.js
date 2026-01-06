// ============== LIQUIDATION CALCULATIONS ==============
export const estimateLiquidationPrice = (entryPx, leverage, isLong, maintenanceMargin = 0.005) => {
    const lev = parseFloat(leverage) || 1;
    const entry = parseFloat(entryPx) || 0;
    if (entry === 0 || lev === 0) return 0;
    return isLong ? entry * (1 - (1 / lev) + maintenanceMargin) : entry * (1 + (1 / lev) - maintenanceMargin);
};

export const liquidationDistance = (currentPrice, liqPrice, isLong) => {
    const curr = parseFloat(currentPrice) || 0;
    const liq = parseFloat(liqPrice) || 0;
    if (curr === 0 || liq === 0) return 0;
    return isLong ? ((curr - liq) / curr) * 100 : ((liq - curr) / curr) * 100;
};
