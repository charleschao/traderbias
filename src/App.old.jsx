import React, { useState, useEffect, useRef, useCallback } from 'react';

// API endpoints
const LEADERBOARD_API = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// ============== EXCHANGE CONFIGURATION ==============
const EXCHANGES = {
  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    shortName: 'HL',
    icon: '🔷',
    color: 'cyan',
    status: 'active',
    description: 'Top perps DEX on Arbitrum',
    profileUrl: (addr) => `https://hyperscreener.asxn.xyz/profile/${addr}`,
    features: ['market', 'orderbook', 'funding', 'leaderboard', 'whales', 'cvd', 'liquidations'],
    apiBase: HYPERLIQUID_API,
    coins: ['BTC', 'ETH', 'SOL']
  },
  binance: {
    id: 'binance',
    name: 'Binance',
    shortName: 'BN',
    icon: '🟡',
    color: 'yellow',
    status: 'active',
    description: 'World\'s largest crypto exchange',
    profileUrl: (addr) => `https://www.binance.com/en/futures-activity/leaderboard/user?encryptedUid=${addr}`,
    features: ['market', 'orderbook', 'funding', 'cvd'],
    apiBase: 'https://fapi.binance.com',
    coins: ['BTC', 'ETH', 'SOL'],
    // Note: No public leaderboard API - would need third-party scraper
    hasLeaderboard: false
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    shortName: 'BB',
    icon: '🟠',
    color: 'orange',
    status: 'active',
    description: 'Leading crypto derivatives exchange',
    profileUrl: (addr) => `https://www.bybit.com/user/public-profile?uid=${addr}`,
    features: ['market', 'orderbook', 'funding', 'cvd'],
    apiBase: 'https://api.bybit.com',
    coins: ['BTC', 'ETH', 'SOL'],
    hasLeaderboard: false
  },
  nado: {
    id: 'nado',
    name: 'Nado',
    shortName: 'NADO',
    icon: '🔶',
    color: 'amber',
    status: 'active',
    description: 'Orderbook perps DEX on Ink L2',
    profileUrl: (addr) => `https://app.nado.xyz`,
    features: ['market', 'orderbook', 'funding'],
    apiBase: 'https://archive.prod.nado.xyz/v1',
    coins: ['BTC', 'ETH', 'SOL'],
    hasLeaderboard: false
  },
  asterdex: {
    id: 'asterdex',
    name: 'AsterDex',
    shortName: 'ASTER',
    icon: '⭐',
    color: 'cyan',
    status: 'active',
    description: 'Multi-chain perps DEX (ex-APX)',
    profileUrl: (addr) => `https://www.asterdex.com`,
    features: ['market', 'orderbook', 'funding'],
    apiBase: 'https://fapi.asterdex.com',
    coins: ['BTC', 'ETH', 'SOL'],
    hasLeaderboard: false
  },
  lighter: {
    id: 'lighter',
    name: 'Lighter',
    shortName: 'LT',
    icon: '⚡',
    color: 'purple',
    status: 'api_required',
    description: 'Verifiable perps exchange',
    statusMessage: 'API Key Required - Sign up at lighter.xyz',
    profileUrl: (addr) => `https://app.lighter.xyz/portfolio/${addr}`,
    features: ['market', 'orderbook', 'funding', 'trades'],
    apiBase: 'https://mainnet.zklighter.elliot.ai/api/v1',
    coins: ['BTC', 'ETH', 'SOL']
  },
  variational: {
    id: 'variational',
    name: 'Variational',
    shortName: 'VAR',
    icon: '🟣',
    color: 'violet',
    status: 'coming_soon',
    description: 'P2P derivatives protocol',
    statusMessage: 'API Coming Soon - Join waitlist at variational.io',
    profileUrl: (addr) => `https://omni.variational.io/`,
    features: [],
    apiBase: null,
    coins: []
  }
};

const EXCHANGE_LIST = Object.values(EXCHANGES);
const DEFAULT_EXCHANGE = 'hyperliquid';

// ============== MEGA WHALE TRADE WEBSOCKET CONFIG ==============
const WHALE_THRESHOLD = 4_000_000; // $4M minimum trade size

const WHALE_WS_CONFIG = {
  // Binance Spot - BTC, ETH, SOL
  binanceSpot: {
    id: 'binanceSpot',
    name: 'Binance',
    type: 'SPOT',
    icon: '🟡',
    color: 'yellow',
    url: 'wss://stream.binance.com:9443/ws',
    streams: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade'],
    subscribe: (streams) => ({ method: 'SUBSCRIBE', params: streams, id: 1 }),
    parse: (msg) => {
      if (msg.e !== 'aggTrade') return null;
      const price = parseFloat(msg.p);
      const size = parseFloat(msg.q);
      return {
        symbol: msg.s.replace('USDT', ''),
        price,
        size,
        notional: price * size,
        side: msg.m ? 'SELL' : 'BUY', // m=true means buyer is maker, so taker sold
        timestamp: msg.T,
        tradeId: msg.a
      };
    }
  },
  // Binance USDⓈ-M Futures
  binanceFutures: {
    id: 'binanceFutures',
    name: 'Binance',
    type: 'PERP',
    icon: '🟡',
    color: 'yellow',
    url: 'wss://fstream.binance.com/ws',
    streams: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade'],
    subscribe: (streams) => ({ method: 'SUBSCRIBE', params: streams, id: 1 }),
    parse: (msg) => {
      if (msg.e !== 'aggTrade') return null;
      const price = parseFloat(msg.p);
      const size = parseFloat(msg.q);
      return {
        symbol: msg.s.replace('USDT', ''),
        price,
        size,
        notional: price * size,
        side: msg.m ? 'SELL' : 'BUY',
        timestamp: msg.T,
        tradeId: msg.a
      };
    }
  },
  // Bybit Linear Perpetuals
  bybitLinear: {
    id: 'bybitLinear',
    name: 'Bybit',
    type: 'PERP',
    icon: '🟠',
    color: 'orange',
    url: 'wss://stream.bybit.com/v5/public/linear',
    streams: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT', 'publicTrade.SOLUSDT'],
    subscribe: (streams) => ({ op: 'subscribe', args: streams }),
    parse: (msg) => {
      if (!msg.topic?.startsWith('publicTrade') || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.p);
        const size = parseFloat(t.v);
        return {
          symbol: t.s.replace('USDT', ''),
          price,
          size,
          notional: price * size,
          side: t.S === 'Buy' ? 'BUY' : 'SELL',
          timestamp: t.T,
          tradeId: t.i
        };
      });
    }
  },
  // Bybit Spot
  bybitSpot: {
    id: 'bybitSpot',
    name: 'Bybit',
    type: 'SPOT',
    icon: '🟠',
    color: 'orange',
    url: 'wss://stream.bybit.com/v5/public/spot',
    streams: ['publicTrade.BTCUSDT', 'publicTrade.ETHUSDT', 'publicTrade.SOLUSDT'],
    subscribe: (streams) => ({ op: 'subscribe', args: streams }),
    parse: (msg) => {
      if (!msg.topic?.startsWith('publicTrade') || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.p);
        const size = parseFloat(t.v);
        return {
          symbol: t.s.replace('USDT', ''),
          price,
          size,
          notional: price * size,
          side: t.S === 'Buy' ? 'BUY' : 'SELL',
          timestamp: t.T,
          tradeId: t.i
        };
      });
    }
  },
  // OKX Spot
  okxSpot: {
    id: 'okxSpot',
    name: 'OKX',
    type: 'SPOT',
    icon: '⚫',
    color: 'slate',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    streams: [
      { channel: 'trades', instId: 'BTC-USDT' },
      { channel: 'trades', instId: 'ETH-USDT' },
      { channel: 'trades', instId: 'SOL-USDT' }
    ],
    subscribe: (streams) => ({ op: 'subscribe', args: streams }),
    parse: (msg) => {
      if (msg.event || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.px);
        const size = parseFloat(t.sz);
        return {
          symbol: t.instId.split('-')[0],
          price,
          size,
          notional: price * size,
          side: t.side === 'buy' ? 'BUY' : 'SELL',
          timestamp: parseInt(t.ts),
          tradeId: t.tradeId
        };
      });
    }
  },
  // OKX Perpetual Swaps
  okxSwap: {
    id: 'okxSwap',
    name: 'OKX',
    type: 'PERP',
    icon: '⚫',
    color: 'slate',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    streams: [
      { channel: 'trades', instId: 'BTC-USDT-SWAP' },
      { channel: 'trades', instId: 'ETH-USDT-SWAP' },
      { channel: 'trades', instId: 'SOL-USDT-SWAP' }
    ],
    subscribe: (streams) => ({ op: 'subscribe', args: streams }),
    parse: (msg) => {
      if (msg.event || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.px);
        const size = parseFloat(t.sz);
        return {
          symbol: t.instId.split('-')[0],
          price,
          size,
          notional: price * size,
          side: t.side === 'buy' ? 'BUY' : 'SELL',
          timestamp: parseInt(t.ts),
          tradeId: t.tradeId
        };
      });
    }
  },
  // Coinbase Advanced Trade (Spot only)
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    type: 'SPOT',
    icon: '🔵',
    color: 'blue',
    url: 'wss://advanced-trade-ws.coinbase.com',
    streams: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    subscribe: (streams) => ({
      type: 'subscribe',
      product_ids: streams,
      channel: 'market_trades'
    }),
    parse: (msg) => {
      if (msg.channel !== 'market_trades' || !msg.events) return null;
      const trades = [];
      msg.events.forEach(event => {
        if (event.trades) {
          event.trades.forEach(t => {
            const price = parseFloat(t.price);
            const size = parseFloat(t.size);
            trades.push({
              symbol: t.product_id.split('-')[0],
              price,
              size,
              notional: price * size,
              side: t.side === 'BUY' ? 'BUY' : 'SELL',
              timestamp: new Date(t.time).getTime(),
              tradeId: t.trade_id
            });
          });
        }
      });
      return trades.length > 0 ? trades : null;
    }
  },
  // Kraken Spot
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    type: 'SPOT',
    icon: '🟣',
    color: 'purple',
    url: 'wss://ws.kraken.com/v2',
    streams: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
    subscribe: (streams) => ({
      method: 'subscribe',
      params: { channel: 'trade', symbol: streams }
    }),
    parse: (msg) => {
      if (msg.channel !== 'trade' || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.price);
        const size = parseFloat(t.qty);
        return {
          symbol: t.symbol.split('/')[0],
          price,
          size,
          notional: price * size,
          side: t.side === 'buy' ? 'BUY' : 'SELL',
          timestamp: new Date(t.timestamp).getTime(),
          tradeId: t.trade_id
        };
      });
    }
  },
  // Hyperliquid Perpetuals
  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    type: 'PERP',
    icon: '🔷',
    color: 'cyan',
    url: 'wss://api.hyperliquid.xyz/ws',
    streams: ['BTC', 'ETH', 'SOL'],
    subscribe: (streams) => streams.map(coin => ({
      method: 'subscribe',
      subscription: { type: 'trades', coin }
    })),
    parse: (msg) => {
      if (msg.channel !== 'trades' || !msg.data) return null;
      return msg.data.map(t => {
        const price = parseFloat(t.px);
        const size = parseFloat(t.sz);
        return {
          symbol: t.coin,
          price,
          size,
          notional: price * size,
          side: t.side === 'B' ? 'BUY' : 'SELL',
          timestamp: t.time,
          tradeId: t.tid,
          users: t.users // Unique to HL - shows wallet addresses
        };
      });
    }
  }
};

// ============== HELPERS ==============
const formatUSD = (value, compact = true) => {
  const num = Math.abs(parseFloat(value) || 0);
  const sign = parseFloat(value) < 0 ? '-' : '';
  if (num >= 1e9) return `${sign}$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${sign}$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${sign}$${(num / 1e3).toFixed(compact ? 1 : 2)}K`;
  return `${sign}$${num.toFixed(2)}`;
};

const formatPercent = (value) => {
  const num = parseFloat(value) * 100;
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatPrice = (price) => {
  const p = parseFloat(price);
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 100) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return p.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const getProfileUrl = (addr, exchangeId = DEFAULT_EXCHANGE) => {
  const exchange = EXCHANGES[exchangeId] || EXCHANGES[DEFAULT_EXCHANGE];
  return exchange.profileUrl(addr);
};

// eslint-disable-next-line no-unused-vars
const timeAgo = (date) => {
  if (!date) return 'Unknown';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// Liquidation calculations
const estimateLiquidationPrice = (entryPx, leverage, isLong, maintenanceMargin = 0.005) => {
  const lev = parseFloat(leverage) || 1;
  const entry = parseFloat(entryPx) || 0;
  if (entry === 0 || lev === 0) return 0;
  return isLong ? entry * (1 - (1 / lev) + maintenanceMargin) : entry * (1 + (1 / lev) - maintenanceMargin);
};

const liquidationDistance = (currentPrice, liqPrice, isLong) => {
  const curr = parseFloat(currentPrice) || 0;
  const liq = parseFloat(liqPrice) || 0;
  if (curr === 0 || liq === 0) return 0;
  return isLong ? ((curr - liq) / curr) * 100 : ((liq - curr) / curr) * 100;
};

// ============== BIAS CALCULATIONS ==============

// Get bias label and color
const getBiasIndicator = (score, maxScore = 10) => {
  const pct = score / maxScore;
  if (pct >= 0.6) return { label: 'STRONG BULL', color: 'text-green-400', bg: 'bg-green-500/20', icon: '🟢' };
  if (pct >= 0.3) return { label: 'BULLISH', color: 'text-green-300', bg: 'bg-green-500/10', icon: '🟢' };
  if (pct >= 0.1) return { label: 'LEAN BULL', color: 'text-lime-400', bg: 'bg-lime-500/10', icon: '🟡' };
  if (pct > -0.1) return { label: 'NEUTRAL', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: '⚪' };
  if (pct > -0.3) return { label: 'LEAN BEAR', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: '🟡' };
  if (pct > -0.6) return { label: 'BEARISH', color: 'text-red-300', bg: 'bg-red-500/10', icon: '🔴' };
  return { label: 'STRONG BEAR', color: 'text-red-400', bg: 'bg-red-500/20', icon: '🔴' };
};

// Calculate OI Bias: Based on OI change + price direction + funding
const calculateOIBias = (coin, oiData, fundingData, priceData) => {
  if (!oiData || !fundingData || !priceData) return { score: 0, reason: 'Loading...' };

  const oiChange = oiData.sessionChange || 0; // % change from session start
  const fundingRate = fundingData.rate || 0;
  const priceChange = priceData.sessionChange || 0;

  let score = 0;
  let reasons = [];

  // OI Rising scenarios
  if (oiChange > 2) {
    if (fundingRate > 0 && priceChange > 0) {
      score = 8; // New longs entering, price rising
      reasons.push('New longs entering aggressively');
    } else if (fundingRate > 0 && priceChange < 0) {
      score = -6; // Longs paying funding + price dropping = bearish divergence
      reasons.push('Aggressive Shorting / Bulls Trapped');
    } else if (fundingRate < 0 && priceChange < 0) {
      score = -8; // New shorts entering, price falling
      reasons.push('New shorts entering aggressively');
    } else if (fundingRate < 0 && priceChange > 0) {
      score = -3; // Shorts entering but price rising - could be top fishing
      reasons.push('Shorts building on rally');
    }
  }
  // OI Falling scenarios
  else if (oiChange < -2) {
    if (fundingRate > 0 && priceChange < 0) {
      score = -6; // Long liquidations
      reasons.push('Long liquidations / exits');
    } else if (fundingRate < 0 && priceChange > 0) {
      score = 6; // Short squeeze
      reasons.push('Short squeeze in progress');
    } else if (fundingRate > 0 && priceChange > 0) {
      score = 2; // Longs taking profit
      reasons.push('Profit taking by longs');
    } else {
      score = -2; // Shorts covering
      reasons.push('Shorts covering');
    }
  }
  // OI Stable
  else {
    reasons.push('OI stable - no strong flow');
  }

  return { score, reason: reasons.join(', '), oiChange, priceChange };
};

// Calculate Funding Bias: Based on rate magnitude and trend
const calculateFundingBias = (coin, fundingData) => {
  if (!fundingData) return { score: 0, reason: 'Loading...' };

  const rate = fundingData.rate || 0;
  const trend = fundingData.trend || 0; // Change from last reading
  const annualized = rate * 3 * 365 * 100; // 8h funding (3x per day)

  let score = 0;
  let reasons = [];

  // Extreme funding = crowded trade, contrarian signal
  if (rate > 0.0005) { // >0.05% per 8h = ~55% APR
    score = -4; // Contrarian bearish - too crowded long
    reasons.push(`Extremely crowded longs (${annualized.toFixed(0)}% APR)`);
  } else if (rate > 0.0002) {
    score = 2; // Moderate bullish bias
    reasons.push('Bullish sentiment');
  } else if (rate < -0.0005) {
    score = 4; // Contrarian bullish - too crowded short
    reasons.push(`Extremely crowded shorts (${annualized.toFixed(0)}% APR)`);
  } else if (rate < -0.0002) {
    score = -2; // Moderate bearish bias
    reasons.push('Bearish sentiment');
  } else {
    reasons.push('Neutral funding');
  }

  // Trend adjustment
  if (trend > 0.0001) {
    score += 1;
    reasons.push('Funding rising');
  } else if (trend < -0.0001) {
    score -= 1;
    reasons.push('Funding falling');
  }

  return { score, reason: reasons.join(' • '), rate, annualized, trend };
};

// Calculate Orderbook Bias: Based on sustained imbalance
const calculateOrderbookBias = (coin, obData) => {
  if (!obData) return { score: 0, reason: 'Loading...' };

  const currentImbalance = obData.imbalance || 0;
  const avgImbalance = obData.avgImbalance || 0; // Rolling average

  let score = 0;
  let reasons = [];

  // Sustained imbalance matters more than snapshot
  if (avgImbalance > 20) {
    score = 6;
    reasons.push('Strong sustained bid wall');
  } else if (avgImbalance > 10) {
    score = 3;
    reasons.push('Bid heavy orderbook');
  } else if (avgImbalance < -20) {
    score = -6;
    reasons.push('Strong sustained ask wall');
  } else if (avgImbalance < -10) {
    score = -3;
    reasons.push('Ask heavy orderbook');
  } else {
    reasons.push('Balanced orderbook');
  }

  // Current vs average divergence
  if (currentImbalance > avgImbalance + 10) {
    score += 1;
    reasons.push('Bids strengthening');
  } else if (currentImbalance < avgImbalance - 10) {
    score -= 1;
    reasons.push('Asks strengthening');
  }

  return { score, reason: reasons.join(' • '), currentImbalance, avgImbalance };
};

// Calculate CVD Bias: Based on 5-minute rolling delta trend
const calculateCVDBias = (coin, cvdData, priceData) => {
  if (!cvdData) return { score: 0, reason: 'Loading...' };

  const cumulativeDelta = cvdData.sessionDelta || 0; // Keep for reference
  const rollingDelta = cvdData.rolling5mDelta || 0; // Rolling 5 min window (Primary Signal)
  const deltaTrend = cvdData.trend || 0; // Is delta growing or shrinking
  const priceChange = priceData?.sessionChange || 0;

  let score = 0;
  let reasons = [];

  // Rolling delta direction (Short term flow)
  if (rollingDelta > 0) {
    if (deltaTrend > 0) {
      score = 6;
      reasons.push('Buyers dominating 5m flow');
    } else {
      score = 3;
      reasons.push('Buyers in control (5m)');
    }
  } else if (rollingDelta < 0) {
    if (deltaTrend < 0) {
      score = -6;
      reasons.push('Sellers dominating 5m flow');
    } else {
      score = -3;
      reasons.push('Sellers in control (5m)');
    }
  }

  // Divergence detection (price vs rolling flow)
  if (priceChange > 0.5 && rollingDelta < 0) {
    score -= 3;
    reasons.push('⚠️ DIVERGENCE: Price rising into selling');
  } else if (priceChange < -0.5 && rollingDelta > 0) {
    score += 3;
    reasons.push('⚠️ DIVERGENCE: Price dropping into buying');
  }

  return { score, reason: reasons.join(' • '), cumulativeDelta, rollingDelta, deltaTrend };
};

// Calculate Flow Confluence: Pro trading confluence table (Price + OI + CVD)
// Updates: 30s data refresh, 5min rolling CVD window
const calculateFlowConfluence = (coin, oiData, cvdData, priceData) => {
  if (!oiData || !cvdData || !priceData) {
    return {
      confluenceType: 'NEUTRAL',
      signal: 'neutral',
      score: 0,
      strength: 'weak',
      divergence: null,
      reason: 'Loading...',
      priceDir: '↔',
      oiDir: '↔',
      cvdDir: '↔'
    };
  }

  const oiChange = oiData.sessionChange || 0;
  const cvdDelta = cvdData.rolling5mDelta || 0;
  const cvdTrend = cvdData.trend || 0;
  const priceChange = priceData.sessionChange || 0;

  // Determine directions with thresholds
  const priceUp = priceChange > 0.3;
  const priceDown = priceChange < -0.3;
  const oiUp = oiChange > 1;
  const oiDown = oiChange < -1;
  const cvdUp = cvdDelta > 0 && cvdTrend >= 0;
  const cvdDown = cvdDelta < 0 && cvdTrend <= 0;

  // Direction arrows for display
  const priceDir = priceUp ? '↑' : priceDown ? '↓' : '↔';
  const oiDir = oiUp ? '↑' : oiDown ? '↓' : '↔';
  const cvdDir = cvdUp ? '↑' : cvdDown ? '↓' : '↔';

  let confluenceType = 'NEUTRAL';
  let signal = 'neutral';
  let score = 0;
  let strength = 'weak';
  let reason = '';
  let divergence = null;

  // Pro Confluence Table Logic
  if (priceUp && oiUp && cvdUp) {
    // Price ↑, OI ↑, CVD ↑ = STRONG BULL
    confluenceType = 'STRONG_BULL';
    signal = 'bullish';
    score = 9;
    strength = 'strong';
    reason = 'New longs + aggressive buying backing the move';
  } else if (priceUp && oiDown && cvdDown) {
    // Price ↑, OI ↓, CVD ↓ = WEAK BULL / potential reversal
    confluenceType = 'WEAK_BULL';
    signal = 'bullish';
    score = 3;
    strength = 'weak';
    reason = 'Shorts covering, sellers absorbing - watch for reversal';
    divergence = { type: 'bearish', message: 'Price up but flow weakening' };
  } else if (priceDown && oiUp && cvdDown) {
    // Price ↓, OI ↑, CVD ↓ = STRONG BEAR
    confluenceType = 'STRONG_BEAR';
    signal = 'bearish';
    score = -9;
    strength = 'strong';
    reason = 'New shorts + aggressive selling pressuring price';
  } else if (priceDown && oiDown && cvdUp) {
    // Price ↓, OI ↓, CVD ↑ = WEAK BEAR / potential reversal
    confluenceType = 'WEAK_BEAR';
    signal = 'bearish';
    score = -3;
    strength = 'weak';
    reason = 'Longs exiting, buyers absorbing - watch for bounce';
    divergence = { type: 'bullish', message: 'Price down but buyers stepping in' };
  }
  // Additional confluence patterns
  else if (priceUp && oiUp && cvdDown) {
    // Price rising with new positions but selling pressure
    confluenceType = 'DIVERGENCE';
    signal = 'neutral';
    score = 2;
    strength = 'weak';
    reason = 'Price up, OI up, but CVD negative - distribution possible';
    divergence = { type: 'bearish', message: 'Hidden selling into rally' };
  } else if (priceDown && oiUp && cvdUp) {
    // Price falling with new positions but buying pressure
    confluenceType = 'DIVERGENCE';
    signal = 'neutral';
    score = -2;
    strength = 'weak';
    reason = 'Price down, OI up, but CVD positive - accumulation possible';
    divergence = { type: 'bullish', message: 'Hidden buying into dip' };
  } else if (priceUp && cvdUp) {
    // Price up with buying - moderately bullish
    confluenceType = 'BULLISH';
    signal = 'bullish';
    score = 5;
    strength = 'moderate';
    reason = 'Price rising with buy flow support';
  } else if (priceDown && cvdDown) {
    // Price down with selling - moderately bearish
    confluenceType = 'BEARISH';
    signal = 'bearish';
    score = -5;
    strength = 'moderate';
    reason = 'Price falling with sell flow pressure';
  } else {
    // No clear confluence
    confluenceType = 'NEUTRAL';
    signal = 'neutral';
    score = 0;
    strength = 'weak';
    reason = 'No clear flow confluence';
  }

  return {
    confluenceType,
    signal,
    score,
    strength,
    divergence,
    reason,
    priceDir,
    oiDir,
    cvdDir,
    oiChange,
    cvdDelta,
    priceChange
  };
};


// Calculate Whale Consensus Bias
const calculateWhaleBias = (coin, consensus) => {
  if (!consensus || !consensus[coin]) return { score: 0, reason: 'No whale data' };

  const data = consensus[coin];
  const total = data.longs.length + data.shorts.length;
  if (total < 2) return { score: 0, reason: 'Insufficient data' };

  const longPct = data.longs.length / total;
  const consistentLongs = data.longs.filter(p => p.isConsistent).length;
  const consistentShorts = data.shorts.filter(p => p.isConsistent).length;

  let score = 0;
  let reasons = [];

  if (longPct >= 0.8) {
    score = 8;
    reasons.push(`${Math.round(longPct * 100)}% long`);
  } else if (longPct >= 0.6) {
    score = 4;
    reasons.push(`${Math.round(longPct * 100)}% long`);
  } else if (longPct <= 0.2) {
    score = -8;
    reasons.push(`${Math.round((1 - longPct) * 100)}% short`);
  } else if (longPct <= 0.4) {
    score = -4;
    reasons.push(`${Math.round((1 - longPct) * 100)}% short`);
  } else {
    reasons.push('Mixed positioning');
  }

  // Weight consistent winners more
  if (consistentLongs > consistentShorts) {
    score += 2;
    reasons.push(`${consistentLongs} consistent winners long`);
  } else if (consistentShorts > consistentLongs) {
    score -= 2;
    reasons.push(`${consistentShorts} consistent winners short`);
  }

  return { score, reason: reasons.join(' • '), longPct, consistentLongs, consistentShorts, total };
};

// Master Composite Bias Score
const calculateCompositeBias = (coin, allData) => {
  // Use unified flow confluence instead of separate OI and CVD
  const flowConfluence = calculateFlowConfluence(
    coin,
    allData.oiData?.[coin],
    allData.cvdData?.[coin],
    allData.priceData?.[coin]
  );
  const fundingBias = calculateFundingBias(coin, allData.fundingData?.[coin]);
  const obBias = calculateOrderbookBias(coin, allData.orderbookData?.[coin]);
  const whaleBias = calculateWhaleBias(coin, allData.consensus);

  // Weighted scoring - flow confluence replaces OI + CVD
  const weights = {
    flow: 5,     // Flow confluence (was OI:3 + CVD:2) - most important
    whale: 3,    // What winners are doing
    ob: 1,       // Orderbook (noisy)
    funding: 1   // Funding (can be contrarian)
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedScore = (
    (flowConfluence.score * weights.flow) +
    (whaleBias.score * weights.whale) +
    (obBias.score * weights.ob) +
    (fundingBias.score * weights.funding)
  ) / totalWeight;

  const maxPossibleScore = 9; // Max flow confluence score
  const normalizedScore = weightedScore / maxPossibleScore;

  const indicator = getBiasIndicator(normalizedScore, 1);

  // Grade conversion
  let grade;
  if (normalizedScore >= 0.6) grade = 'A+';
  else if (normalizedScore >= 0.4) grade = 'A';
  else if (normalizedScore >= 0.2) grade = 'B';
  else if (normalizedScore >= -0.2) grade = 'C';
  else if (normalizedScore >= -0.4) grade = 'D';
  else grade = 'F';

  return {
    score: weightedScore,
    normalizedScore,
    grade,
    ...indicator,
    components: { flowConfluence, fundingBias, obBias, whaleBias }
  };
};

// ============== COMPONENTS ==============

// Exchange selector tabs component
const ExchangeSelector = ({ activeExchange, onExchangeChange }) => (
  <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
    {EXCHANGE_LIST.map(exchange => {
      const isActive = activeExchange === exchange.id;
      const colorClasses = {
        cyan: isActive ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-cyan-400',
        purple: isActive ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-purple-400',
        violet: isActive ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-slate-400 hover:text-violet-400',
        yellow: isActive ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20' : 'text-slate-400 hover:text-yellow-400',
        orange: isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-orange-400',
        amber: isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-amber-400',
      };

      return (
        <button
          key={exchange.id}
          onClick={() => onExchangeChange(exchange.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all ${colorClasses[exchange.color] || colorClasses.cyan}`}
          title={exchange.description}
        >
          <span className="text-lg">{exchange.icon}</span>
          <span className="hidden sm:inline">{exchange.name}</span>
          <span className="sm:hidden">{exchange.shortName}</span>
          {exchange.status !== 'active' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
              {exchange.status === 'api_required' ? 'API' : 'Soon'}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

// Coming soon / API required placeholder component
const ExchangeComingSoon = ({ exchange }) => {
  const colorClasses = {
    cyan: { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    purple: { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10' },
    violet: { border: 'border-violet-500/30', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  };
  const colors = colorClasses[exchange.color] || colorClasses.cyan;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className={`${colors.bg} ${colors.border} border-2 rounded-3xl p-12 text-center max-w-lg`}>
        <div className="text-6xl mb-4">{exchange.icon}</div>
        <h2 className={`text-3xl font-black mb-2 ${colors.text}`}>{exchange.name}</h2>
        <p className="text-slate-400 text-lg mb-6">{exchange.description}</p>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${colors.bg} border ${colors.border}`}>
          {exchange.status === 'api_required' ? (
            <>
              <span className="text-2xl">🔑</span>
              <span className="font-bold text-white">API Key Required</span>
            </>
          ) : (
            <>
              <span className="text-2xl">🚧</span>
              <span className="font-bold text-white">Coming Soon</span>
            </>
          )}
        </div>

        <p className="text-slate-500 text-sm mt-6">
          {exchange.statusMessage}
        </p>

        {exchange.status === 'api_required' && (
          <div className="mt-6 space-y-3">
            <p className="text-slate-400 text-sm">Features available with API key:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {exchange.features.map(feature => (
                <span key={feature} className="px-3 py-1 rounded-lg bg-slate-800/50 text-slate-300 text-xs capitalize">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {exchange.status === 'coming_soon' && (
          <a
            href="https://variational.typeform.com/api-request"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 px-6 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-400 transition-colors"
          >
            Join API Waitlist →
          </a>
        )}
      </div>

      <p className="text-slate-600 text-sm">
        Switch exchanges using the tabs above
      </p>
    </div>
  );
};

// ============== MEGA WHALE FEED COMPONENT ==============
const MegaWhaleFeed = ({ trades, isConnected, connectionStatus }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate stats
  const last5min = trades.filter(t => Date.now() - t.timestamp < 300000);
  const buyVolume = last5min.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.notional, 0);
  const sellVolume = last5min.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.notional, 0);
  const netFlow = buyVolume - sellVolume;

  const connectedCount = Object.values(connectionStatus).filter(s => s === 'connected').length;
  const totalConnections = Object.keys(connectionStatus).length;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 rounded-xl border border-amber-500/30 mb-6 overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="px-3 py-2 cursor-pointer bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐋</span>
            <div>
              <h2 className="text-sm font-bold text-amber-400">$4M+ TRADES</h2>
              <p className="text-[10px] text-slate-500">
                {connectedCount}/{totalConnections} exchanges •
                {isConnected ? <span className="text-green-400 ml-1">● LIVE</span> : <span className="text-yellow-400 ml-1">● ...</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 5-min Flow Summary */}
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                <span className="text-green-400 font-bold font-mono">{formatUSD(buyVolume)}</span>
                <span className="text-slate-500 ml-1">buy</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                <span className="text-red-400 font-bold font-mono">{formatUSD(sellVolume)}</span>
                <span className="text-slate-500 ml-1">sell</span>
              </div>
              <div className="text-center px-2 py-0.5 rounded bg-slate-800/50">
                <span className={`font-bold font-mono ${netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netFlow >= 0 ? '+' : ''}{formatUSD(netFlow)}
                </span>
                <span className="text-slate-500 ml-1">net</span>
              </div>
            </div>

            <span className="text-slate-500 text-sm">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {/* Trade List - compact height for ~5 trades */}
          <div className="max-h-[180px] overflow-y-auto">
            {trades.length === 0 ? (
              <div className="p-4 text-center">
                <div className="text-slate-500 text-sm">Watching for $4M+ trades...</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/30">
                {trades.slice(0, 50).map((trade, i) => (
                  <MegaWhaleTradeRow key={`${trade.exchange}-${trade.tradeId}-${i}`} trade={trade} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Individual whale trade row - compact version
const MegaWhaleTradeRow = ({ trade }) => {
  const isBuy = trade.side === 'BUY';
  const age = Date.now() - trade.timestamp;
  const isNew = age < 10000;

  const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const config = WHALE_WS_CONFIG[trade.exchange];

  return (
    <div className={`px-3 py-1.5 flex items-center gap-3 hover:bg-slate-800/30 transition-colors ${isNew ? 'bg-slate-800/40' : ''
      }`}>
      {/* Side */}
      <div className={`w-10 py-0.5 rounded text-center font-bold text-xs ${isBuy
        ? 'bg-green-500/20 text-green-400'
        : 'bg-red-500/20 text-red-400'
        }`}>
        {isBuy ? 'BUY' : 'SELL'}
      </div>

      {/* Coin + Type */}
      <div className="w-14">
        <span className="text-sm font-bold text-white">{trade.symbol}</span>
        <span className="text-[9px] text-slate-500 ml-1">{config?.type === 'PERP' ? 'P' : 'S'}</span>
      </div>

      {/* Notional */}
      <div className={`flex-1 text-sm font-bold font-mono ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
        {formatUSD(trade.notional)}
      </div>

      {/* Size @ Price */}
      <div className="hidden sm:block text-[10px] text-slate-500 w-32 text-right">
        {trade.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} @ ${formatPrice(trade.price)}
      </div>

      {/* Exchange */}
      <div className="w-16 text-right">
        <span className="text-[10px] text-slate-400">{config?.icon} {config?.name?.slice(0, 3)}</span>
      </div>

      {/* Time */}
      <div className="w-14 text-right">
        <span className="text-[10px] font-mono text-slate-500">{time}</span>
      </div>
    </div>
  );
};

// Custom hook for managing whale trade WebSocket connections
const useWhaleWebSockets = () => {
  const [trades, setTrades] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({});
  const wsRefs = useRef({});
  const reconnectTimeouts = useRef({});

  const addTrade = (trade) => {
    setTrades(prev => {
      // Dedupe by exchange + tradeId
      const exists = prev.some(t => t.exchange === trade.exchange && t.tradeId === trade.tradeId);
      if (exists) return prev;

      // Keep only last 100 trades, sorted by time
      const updated = [trade, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      return updated;
    });
  };

  const connectExchange = (configId) => {
    const config = WHALE_WS_CONFIG[configId];
    if (!config) return;

    // Clean up existing connection
    if (wsRefs.current[configId]) {
      wsRefs.current[configId].close();
    }

    setConnectionStatus(prev => ({ ...prev, [configId]: 'connecting' }));

    try {
      const ws = new WebSocket(config.url);
      wsRefs.current[configId] = ws;

      ws.onopen = () => {
        console.log(`[WhaleWS] Connected to ${config.name} ${config.type}`);
        setConnectionStatus(prev => ({ ...prev, [configId]: 'connected' }));

        // Send subscription message(s)
        const subMsg = config.subscribe(config.streams);
        if (Array.isArray(subMsg)) {
          // Hyperliquid sends multiple subscription messages
          subMsg.forEach(msg => ws.send(JSON.stringify(msg)));
        } else {
          ws.send(JSON.stringify(subMsg));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const parsed = config.parse(msg);

          if (!parsed) return;

          // Handle single trade or array of trades
          const tradeList = Array.isArray(parsed) ? parsed : [parsed];

          tradeList.forEach(trade => {
            if (trade && trade.notional >= WHALE_THRESHOLD) {
              addTrade({
                ...trade,
                exchange: configId,
                receivedAt: Date.now()
              });

              // Console log for debugging whale trades
              console.log(`🐋 WHALE: ${config.name} ${config.type} | ${trade.side} ${trade.symbol} | ${formatUSD(trade.notional)}`);
            }
          });
        } catch (err) {
          // Ignore parse errors for ping/pong messages
        }
      };

      ws.onerror = (err) => {
        console.error(`[WhaleWS] Error on ${config.name}:`, err);
        setConnectionStatus(prev => ({ ...prev, [configId]: 'error' }));
      };

      ws.onclose = () => {
        console.log(`[WhaleWS] Disconnected from ${config.name} ${config.type}`);
        setConnectionStatus(prev => ({ ...prev, [configId]: 'disconnected' }));

        // Reconnect after delay
        reconnectTimeouts.current[configId] = setTimeout(() => {
          connectExchange(configId);
        }, 5000);
      };

      // Heartbeat for exchanges that need it (Bybit, OKX)
      if (configId.startsWith('bybit')) {
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
        ws.pingInterval = pingInterval;
      }

    } catch (err) {
      console.error(`[WhaleWS] Failed to connect to ${config.name}:`, err);
      setConnectionStatus(prev => ({ ...prev, [configId]: 'error' }));
    }
  };

  useEffect(() => {
    // Connect to all exchanges on mount
    Object.keys(WHALE_WS_CONFIG).forEach(configId => {
      connectExchange(configId);
    });

    // Cleanup on unmount
    // Copy refs to local variables for cleanup function
    const wsRefsCleanup = wsRefs.current;
    const reconnectTimeoutsCleanup = reconnectTimeouts.current;

    return () => {
      Object.keys(wsRefsCleanup).forEach(id => {
        if (wsRefsCleanup[id]) {
          if (wsRefsCleanup[id].pingInterval) {
            clearInterval(wsRefsCleanup[id].pingInterval);
          }
          wsRefsCleanup[id].close();
        }
      });
      Object.values(reconnectTimeoutsCleanup).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isConnected = Object.values(connectionStatus).some(s => s === 'connected');

  return { trades, connectionStatus, isConnected };
};

const BiasCard = ({ coin, biasData, priceData, oiData, orderbookData, cvdData, fundingData, onExpand }) => {
  if (!biasData) return null;

  // Generate trader-focused insight labels
  const getBookLabel = () => {
    const imb = orderbookData?.imbalance || 0;
    const avg = orderbookData?.avgImbalance || 0;
    if (imb > 20) return { text: '📗 Heavy Bids', color: 'text-green-400' };
    if (imb > 10) return { text: '📗 Bids Lean', color: 'text-green-400' };
    if (imb < -20) return { text: '📕 Heavy Asks', color: 'text-red-400' };
    if (imb < -10) return { text: '📕 Asks Lean', color: 'text-red-400' };
    if (imb > avg + 10) return { text: '↗️ Bids Strengthening', color: 'text-lime-400' };
    if (imb < avg - 10) return { text: '↘️ Asks Strengthening', color: 'text-orange-400' };
    return { text: '⚖️ Balanced Book', color: 'text-slate-400' };
  };

  const getFundingLabel = () => {
    const rate = fundingData?.rate || 0;
    const apr = Math.abs(rate * 3 * 365 * 100);
    if (rate > 0.0005) return { text: `⚠️ CROWDED LONGS (${apr.toFixed(0)}% APR)`, color: 'text-red-400' };
    if (rate > 0.0002) return { text: `Bullish Bias`, color: 'text-green-400' };
    if (rate < -0.0005) return { text: `⚠️ CROWDED SHORTS (${apr.toFixed(0)}% APR)`, color: 'text-green-400' };
    if (rate < -0.0002) return { text: `Bearish Bias`, color: 'text-red-400' };
    return { text: 'Neutral Funding', color: 'text-slate-400' };
  };

  const book = getBookLabel();
  const funding = getFundingLabel();
  const confluence = calculateFlowConfluence(coin, oiData, cvdData, priceData);

  return (
    <div
      className={`${biasData.bg} border border-slate-700/50 rounded-2xl p-5 cursor-pointer hover:border-slate-600 transition-all`}
      onClick={() => onExpand(coin)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white">{coin}</span>
          {priceData && <span className="text-slate-400 font-mono text-lg">${formatPrice(priceData.markPx)}</span>}
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold ${biasData.bg}`}>
          <span className="text-lg">{biasData.icon}</span>
          <span className={biasData.color}>{biasData.label}</span>
        </div>
      </div>

      {/* Market Data - OI, Volume, Changes */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500">Open Interest</div>
          <div className="text-white font-mono font-bold">{formatUSD(oiData?.current || 0)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500">OI Change</div>
          <div className={`font-mono font-bold ${(oiData?.sessionChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(oiData?.sessionChange || 0) >= 0 ? '+' : ''}{(oiData?.sessionChange || 0).toFixed(2)}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-slate-500">24h Volume</div>
          <div className="text-white font-mono font-bold">{formatUSD(oiData?.volume || 0)}</div>
        </div>
      </div>

      {/* Signal Insights - Unified Flow Confluence */}
      <div className="mt-3 space-y-1.5 text-sm">
        {/* Flow Confluence - Combined OI + CVD + Price */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Flow Confluence</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              P{confluence.priceDir} OI{confluence.oiDir} CVD{confluence.cvdDir}
            </span>
            <span className={`font-bold ${confluence.signal === 'bullish' ? 'text-green-400' :
              confluence.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'
              }`}>
              {{
                'STRONG_BULL': '🟢', 'BULLISH': '🟢', 'WEAK_BULL': '🟡',
                'STRONG_BEAR': '🔴', 'BEARISH': '🔴', 'WEAK_BEAR': '🟡',
                'DIVERGENCE': '⚠️', 'NEUTRAL': '⚪'
              }[confluence.confluenceType] || '⚪'} {confluence.confluenceType.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Book</span>
          <span className={`font-bold ${book.color}`}>{book.text}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Funding</span>
          <span className={`font-bold ${funding.color}`}>{funding.text}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
        <span className="text-xs text-slate-500">Consensus: {biasData.components?.whaleBias?.reason || 'Loading...'}</span>
        <span className="text-xs text-cyan-400">Details →</span>
      </div>
    </div>
  );
};

const SectionBiasHeader = ({ title, icon, bias, updateInterval }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
      {icon} {title}
      <span className="text-[10px] font-normal text-slate-600">Updates: {updateInterval}</span>
    </h3>
    {bias && (
      <div className={`px-2 py-1 rounded text-xs font-bold ${bias.bg} ${bias.color}`}>
        {bias.icon} {bias.label}
      </div>
    )}
  </div>
);

// eslint-disable-next-line no-unused-vars
const OpenInterestSection = ({ oiData, fundingData, priceData }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  return (
    <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
      <SectionBiasHeader
        title="OPEN INTEREST & FLOW"
        icon="📊"
        updateInterval="1min"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coins.map(coin => {
          const oi = oiData?.[coin];
          const fr = fundingData?.[coin];
          const price = priceData?.[coin];
          const bias = calculateOIBias(coin, oi, fr, price);
          const indicator = getBiasIndicator(bias.score, 8);

          return (
            <div key={coin} className={`${indicator.bg} rounded-lg p-3 border border-slate-700/50`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-lg">{coin}</span>
                <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <div className="text-slate-500 text-xs">Open Interest</div>
                  <div className="text-white font-mono">{formatUSD(oi?.current || 0)}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Session Δ</div>
                  <div className={`font-mono font-bold ${(oi?.sessionChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(oi?.sessionChange || 0) >= 0 ? '+' : ''}{(oi?.sessionChange || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Price Δ</div>
                  <div className={`font-mono ${(price?.sessionChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(price?.sessionChange || 0) >= 0 ? '+' : ''}{(price?.sessionChange || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">24h Volume</div>
                  <div className="text-white font-mono">{formatUSD(oi?.volume || 0)}</div>
                </div>
              </div>

              <div className="text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                {bias.reason}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Flow Confluence Section: Combined OI + CVD with Pro Confluence Table
// Updates: 30s data refresh, 5min rolling CVD window
const FlowConfluenceSection = ({ oiData, cvdData, priceData, timeframe = '1h', hasEnoughData = true }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  // Get confluence indicator styling
  const getConfluenceStyle = (confluenceType) => {
    const styles = {
      'STRONG_BULL': { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: '🟢', label: 'STRONG BULL', color: 'text-green-400' },
      'BULLISH': { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: '🟢', label: 'BULLISH', color: 'text-green-300' },
      'WEAK_BULL': { bg: 'bg-lime-500/10', border: 'border-lime-500/30', icon: '🟡', label: 'WEAK BULL', color: 'text-lime-400' },
      'NEUTRAL': { bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: '⚪', label: 'NEUTRAL', color: 'text-slate-400' },
      'DIVERGENCE': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '⚠️', label: 'DIVERGENCE', color: 'text-yellow-400' },
      'WEAK_BEAR': { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: '🟡', label: 'WEAK BEAR', color: 'text-orange-400' },
      'BEARISH': { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🔴', label: 'BEARISH', color: 'text-red-300' },
      'STRONG_BEAR': { bg: 'bg-red-500/20', border: 'border-red-500/50', icon: '🔴', label: 'STRONG BEAR', color: 'text-red-400' },
    };
    return styles[confluenceType] || styles.NEUTRAL;
  };

  // Collect any divergences for footer alert
  const divergences = coins.map(coin => {
    const confluence = calculateFlowConfluence(coin, oiData?.[coin], cvdData?.[coin], priceData?.[coin]);
    return confluence.divergence ? { coin, ...confluence.divergence } : null;
  }).filter(Boolean);

  return (
    <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
      <SectionBiasHeader
        title={`FLOW CONFLUENCE (${timeframe.toUpperCase()})`}
        icon="📊"
        updateInterval={hasEnoughData ? `${timeframe.toUpperCase()} rolling` : `⚠️ Collecting data...`}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coins.map(coin => {
          const oi = oiData?.[coin];
          const cvd = cvdData?.[coin];
          const price = priceData?.[coin];
          const confluence = calculateFlowConfluence(coin, oi, cvd, price);
          const style = getConfluenceStyle(confluence.confluenceType);

          return (
            <div key={coin} className={`${style.bg} ${style.border} border rounded-lg p-3`}>
              {/* Header: Coin + Confluence Type */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white text-lg">{coin}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${style.bg} ${style.color}`}>
                  {style.icon} {style.label}
                </span>
              </div>

              {/* Confluence Table: Price, OI, CVD directions */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3 bg-slate-800/50 rounded-lg p-2">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase">Price</div>
                  <div className={`text-xl font-bold ${confluence.priceDir === '↑' ? 'text-green-400' : confluence.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                    {confluence.priceDir}
                  </div>
                  <div className={`text-[10px] font-mono ${(confluence.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(confluence.priceChange || 0) >= 0 ? '+' : ''}{(confluence.priceChange || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase">OI</div>
                  <div className={`text-xl font-bold ${confluence.oiDir === '↑' ? 'text-green-400' : confluence.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                    {confluence.oiDir}
                  </div>
                  <div className={`text-[10px] font-mono ${(confluence.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(confluence.oiChange || 0) >= 0 ? '+' : ''}{(confluence.oiChange || 0).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase">CVD 5m</div>
                  <div className={`text-xl font-bold ${confluence.cvdDir === '↑' ? 'text-green-400' : confluence.cvdDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                    {confluence.cvdDir}
                  </div>
                  <div className={`text-[10px] font-mono ${(confluence.cvdDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatUSD(confluence.cvdDelta || 0)}
                  </div>
                </div>
              </div>

              {/* Interpretation */}
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                {confluence.reason}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divergence Alerts */}
      {divergences.length > 0 && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          {divergences.map((d, i) => (
            <div key={i} className="text-xs text-yellow-400">
              ⚠️ <span className="font-bold">{d.coin}:</span> {d.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-[10px] text-slate-500">
        Pro confluence: Price + OI + CVD = unified bias. Divergence = price/flow mismatch (reversal signal).
      </div>
    </div>
  );
};

const OrderbookSection = ({ orderbookData, timeframe = '1h', hasEnoughData = true }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  return (
    <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
      <SectionBiasHeader
        title={`ORDERBOOK IMBALANCE (${timeframe.toUpperCase()})`}
        icon="📈"
        updateInterval={hasEnoughData ? `${timeframe.toUpperCase()} avg` : `⚠️ Collecting data...`}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coins.map(coin => {
          const ob = orderbookData?.[coin];
          const bias = calculateOrderbookBias(coin, ob);
          const indicator = getBiasIndicator(bias.score, 6);
          const bidPct = ob ? (ob.bidVolume / (ob.bidVolume + ob.askVolume)) * 100 : 50;

          return (
            <div key={coin} className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-lg">{coin}</span>
                <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
              </div>

              <div className="mb-2">
                <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-green-500 transition-all duration-500 flex items-center justify-end pr-1" style={{ width: `${bidPct}%` }}>
                    <span className="text-[10px] text-white font-bold">{bidPct.toFixed(0)}%</span>
                  </div>
                  <div className="bg-red-500 transition-all duration-500 flex items-center pl-1" style={{ width: `${100 - bidPct}%` }}>
                    <span className="text-[10px] text-white font-bold">{(100 - bidPct).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Bid Depth</div>
                  <div className="text-green-400 font-mono">{formatUSD(ob?.bidVolume || 0)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Ask Depth</div>
                  <div className="text-red-400 font-mono">{formatUSD(ob?.askVolume || 0)}</div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-xs text-slate-500">Current</span>
                <span className={`text-xs font-mono ${(ob?.imbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(ob?.imbalance || 0) >= 0 ? '+' : ''}{(ob?.imbalance || 0).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">Avg</span>
                <span className={`text-xs font-mono ${(ob?.avgImbalance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(ob?.avgImbalance || 0) >= 0 ? '+' : ''}{(ob?.avgImbalance || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] text-slate-500">
        Shows L2 depth imbalance. Avg = rolling 5-minute average for sustained pressure detection.
      </div>
    </div>
  );
};

// eslint-disable-next-line no-unused-vars
const CVDSection = ({ cvdData, priceData }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  return (
    <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
      <SectionBiasHeader
        title="CUMULATIVE VOLUME DELTA"
        icon="📊"
        updateInterval="Rolling 5m Window"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coins.map(coin => {
          const cvd = cvdData?.[coin];
          const price = priceData?.[coin];
          const bias = calculateCVDBias(coin, cvd, price);
          const indicator = getBiasIndicator(bias.score, 6);

          const buyPct = cvd ? (cvd.totalBuyVolume / (cvd.totalBuyVolume + cvd.totalSellVolume)) * 100 : 50;

          return (
            <div key={coin} className={`${indicator.bg} rounded-lg p-3 border border-slate-700/50`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-lg">{coin}</span>
                <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
              </div>

              <div className="mb-2">
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-700">
                  <div className="bg-green-500 transition-all duration-500" style={{ width: `${buyPct}%` }} />
                  <div className="bg-red-500 transition-all duration-500" style={{ width: `${100 - buyPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mt-1">
                  <span className="text-green-400">Buy {buyPct.toFixed(0)}%</span>
                  <span className="text-red-400">Sell {(100 - buyPct).toFixed(0)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Session CVD</div>
                  <div className={`font-mono font-bold ${(cvd?.sessionDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(cvd?.sessionDelta || 0) >= 0 ? '+' : ''}{formatUSD(cvd?.sessionDelta || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">5min CVD</div>
                  <div className={`font-mono ${(cvd?.rolling5mDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(cvd?.rolling5mDelta || 0) >= 0 ? '+' : ''}{formatUSD(cvd?.rolling5mDelta || 0)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 pt-2 mt-2 border-t border-slate-700/50">
                {bias.reason}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] text-slate-500">
        Cumulative since session start. Divergence between price and CVD = potential reversal signal.
      </div>
    </div>
  );
};

const WhaleActivityFeed = ({ consensus, positionChanges, whaleTrades }) => {
  // Only show BTC, ETH, SOL
  const targetCoins = ['BTC', 'ETH', 'SOL'];

  // Calculate whale signals from consensus data - only for target coins
  const whaleSignals = targetCoins.map(coin => {
    const data = consensus?.[coin];
    if (!data) return null;

    const longs = data.longs || [];
    const shorts = data.shorts || [];
    const longNotional = longs.reduce((s, p) => s + p.notional, 0);
    const shortNotional = shorts.reduce((s, p) => s + p.notional, 0);
    const totalNotional = data.totalNotional || 0;
    const bias = longNotional > shortNotional ? 'LONG' : shortNotional > longNotional ? 'SHORT' : 'NEUTRAL';

    return {
      coin,
      bias,
      longCount: longs.length,
      shortCount: shorts.length,
      longNotional,
      shortNotional,
      totalNotional,
      topTraders: [...longs.slice(0, 4), ...shorts.slice(0, 4)].sort((a, b) => b.notional - a.notional)
    };
  }).filter(Boolean);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
      <SectionBiasHeader
        title="WHALE POSITIONS (BTC/ETH/SOL)"
        icon="🐋"
        updateInterval="30s"
      />

      {whaleSignals.length === 0 ? (
        <div className="text-center py-4 text-slate-500">Loading whale data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {whaleSignals.map((signal, i) => (
            <div key={i} className={`rounded-lg p-3 border ${signal.bias === 'LONG' ? 'bg-green-500/10 border-green-500/30' : signal.bias === 'SHORT' ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-black text-white">{signal.coin}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${signal.bias === 'LONG' ? 'bg-green-500/20 text-green-400' : signal.bias === 'SHORT' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                  {signal.bias === 'LONG' ? '🟢 LONG' : signal.bias === 'SHORT' ? '🔴 SHORT' : '⚪ MIXED'}
                </span>
              </div>

              <div className="text-white font-bold text-lg mb-2">{formatUSD(signal.totalNotional)}</div>

              <div className="flex gap-2 text-xs">
                <span className="text-green-400">{signal.longCount}L ({formatUSD(signal.longNotional)})</span>
                <span className="text-red-400">{signal.shortCount}S ({formatUSD(signal.shortNotional)})</span>
              </div>

              {signal.topTraders.length > 0 && (
                <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-1">
                  {signal.topTraders.slice(0, 6).map((t, j) => (
                    <a key={j} href={getProfileUrl(t.trader)} target="_blank" rel="noopener noreferrer"
                      className={`hover:underline ${t.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                      #{t.rank} {t.direction === 'long' ? 'L' : 'S'}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 🔔 LIVE WHALE ACTIVITY - Position Changes Feed */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <h3 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-2">
          🔔 LIVE WHALE ACTIVITY
          <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
        </h3>

        {(!positionChanges || positionChanges.length === 0) ? (
          <div className="text-center py-3 text-slate-500 text-xs">
            Monitoring top 10 trader positions for changes...
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {positionChanges.filter(c => targetCoins.includes(c.coin)).slice(0, 12).map((change, i) => {
              const configs = {
                entry: { icon: '📥', color: 'text-green-400', bg: 'bg-green-500/10', label: 'ENTRY' },
                exit: { icon: '📤', color: 'text-red-400', bg: 'bg-red-500/10', label: 'EXIT' },
                flip: { icon: '🔄', color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'FLIP' },
                increase: { icon: '📈', color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: '+SIZE' },
                decrease: { icon: '📉', color: 'text-orange-400', bg: 'bg-orange-500/10', label: '-SIZE' },
              };
              const cfg = configs[change.type] || configs.entry;

              return (
                <div key={i} className={`${cfg.bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
                  <span className="text-lg">{cfg.icon}</span>
                  <span className={`text-xs font-bold ${cfg.color} min-w-[50px]`}>{cfg.label}</span>
                  <span className="text-white font-bold">{change.coin}</span>
                  {change.direction && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${change.direction === 'LONG' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
                      {change.direction}
                    </span>
                  )}
                  <a href={getProfileUrl(change.trader)} target="_blank" rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline text-xs font-mono">
                    #{change.rank} {formatAddress(change.trader)}
                  </a>
                  <span className="text-slate-500 text-xs ml-auto">{formatUSD(change.notional)}</span>
                  <span className="text-slate-600 text-xs">{change.time?.toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ConsensusSection = ({ consensus }) => {
  // Get coins that have actual data, prioritize BTC/ETH/SOL
  const preferredCoins = ['BTC', 'ETH', 'SOL'];
  const availableCoins = Object.keys(consensus || {});
  const coins = preferredCoins.filter(c => availableCoins.includes(c));

  // If no preferred coins, show whatever we have
  if (coins.length === 0 && availableCoins.length > 0) {
    coins.push(...availableCoins.slice(0, 3));
  }

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
      <SectionBiasHeader
        title="TOP 10 WHALE CONSENSUS"
        icon="🎯"
        updateInterval="30s"
      />
      {coins.length === 0 ? (
        <div className="text-center py-8 text-slate-500">Loading whale consensus data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {coins.map(coin => {
            const data = consensus?.[coin];
            if (!data) return null;

            const bias = calculateWhaleBias(coin, consensus);
            const indicator = getBiasIndicator(bias.score, 10);
            const total = data.longs.length + data.shorts.length;
            const longPct = total > 0 ? (data.longs.length / total) * 100 : 50;

            return (
              <div key={coin} className={`${indicator.bg} rounded-lg p-3 border border-slate-700/50`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-lg">{coin}</span>
                  <span className={`text-xs font-bold ${indicator.color}`}>{indicator.icon} {indicator.label}</span>
                </div>

                <div className="mb-2">
                  <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
                    <div className="bg-green-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${longPct}%` }}>
                      {data.longs.length > 0 && <span className="text-[10px] text-white font-bold">{data.longs.length}L</span>}
                    </div>
                    <div className="bg-red-500 transition-all duration-500 flex items-center justify-center" style={{ width: `${100 - longPct}%` }}>
                      {data.shorts.length > 0 && <span className="text-[10px] text-white font-bold">{data.shorts.length}S</span>}
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  {data.longs.slice(0, 2).map((p, i) => (
                    <div key={`long-${i}`} className="flex justify-between">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                        #{p.rank} {p.isConsistent && '⭐'}
                      </a>
                      <span className="text-slate-400">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                  {data.shorts.slice(0, 2).map((p, i) => (
                    <div key={`short-${i}`} className="flex justify-between">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">
                        #{p.rank} {p.isConsistent && '⭐'}
                      </a>
                      <span className="text-slate-400">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-slate-500 pt-2 mt-2 border-t border-slate-700/50">
                  {formatUSD(data.totalNotional)} total • ⭐ = consistent winner
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FundingRatesSection = ({ fundingData }) => {
  const coins = ['BTC', 'ETH', 'SOL'];

  return (
    <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
      <SectionBiasHeader
        title="FUNDING RATES"
        icon="💰"
        updateInterval="5min (8h rate, settles hourly)"
      />
      <div className="grid grid-cols-3 gap-3">
        {coins.map(coin => {
          const fr = fundingData?.[coin];
          const bias = calculateFundingBias(coin, fr);
          const indicator = getBiasIndicator(bias.score, 6);
          const rate = fr?.rate || 0;
          const annualized = rate * 3 * 365 * 100;

          return (
            <div key={coin} className="bg-slate-800/50 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white text-sm">{coin}</span>
                <span className={`text-[10px] font-bold ${indicator.color}`}>{indicator.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-bold ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {rate >= 0 ? '+' : ''}{(rate * 100).toFixed(4)}%
                </span>
                <span className={`font-mono text-[10px] ${annualized >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                  {annualized >= 0 ? '+' : ''}{annualized.toFixed(0)}% APR
                </span>
              </div>
              {fr?.trend !== undefined && (
                <div className="text-[10px] text-slate-500 mt-1">
                  Trend: {fr.trend > 0 ? '↑ Rising' : fr.trend < 0 ? '↓ Falling' : '→ Stable'}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-slate-500">
        Extreme funding = crowded trade = contrarian signal. 8h rate paid hourly (1/8 each hour).
      </div>
    </div>
  );
};

const LiquidationMap = ({ positions, priceData }) => {
  const liqLevels = {};

  positions.forEach(pos => {
    const coin = pos.coin;
    const isLong = pos.size > 0;
    const liqPrice = estimateLiquidationPrice(pos.entryPx, pos.leverage, isLong);
    const currentPrice = priceData?.[coin]?.markPx || pos.entryPx;
    const distance = liquidationDistance(currentPrice, liqPrice, isLong);

    if (!liqLevels[coin]) {
      liqLevels[coin] = { longs: [], shorts: [], currentPrice, longLiqNotional: 0, shortLiqNotional: 0 };
    }

    if (isLong) {
      liqLevels[coin].longs.push({ price: liqPrice, notional: pos.notional, distance });
      liqLevels[coin].longLiqNotional += pos.notional;
    } else {
      liqLevels[coin].shorts.push({ price: liqPrice, notional: pos.notional, distance });
      liqLevels[coin].shortLiqNotional += pos.notional;
    }
  });

  Object.keys(liqLevels).forEach(coin => {
    liqLevels[coin].longs.sort((a, b) => b.price - a.price);
    liqLevels[coin].shorts.sort((a, b) => a.price - b.price);
  });

  // Prioritize BTC/ETH/SOL but show others if they exist
  const preferredCoins = ['BTC', 'ETH', 'SOL'];
  const otherCoins = Object.keys(liqLevels).filter(c => !preferredCoins.includes(c));
  const mainCoins = [...preferredCoins.filter(c => liqLevels[c]), ...otherCoins].slice(0, 6);

  if (mainCoins.length === 0) {
    return (
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
        <SectionBiasHeader
          title="LIQUIDATION MAP"
          icon="💀"
          updateInterval="5min"
        />
        <div className="text-center py-8 text-slate-500">
          {positions.length === 0 ? 'Loading whale positions...' : 'No positions found'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
      <SectionBiasHeader
        title="LIQUIDATION MAP"
        icon="💀"
        updateInterval="5min"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mainCoins.map(coin => {
          const data = liqLevels[coin];
          const closestLong = data.longs[0];
          const closestShort = data.shorts[0];

          return (
            <div key={coin} className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white text-lg">{coin}</span>
                <span className="text-slate-400 font-mono text-sm">${formatPrice(data.currentPrice)}</span>
              </div>

              <div className="relative h-8 bg-slate-700/50 rounded-lg mb-3 overflow-hidden">
                <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: '50%' }} />
                <div className="absolute top-1 text-[10px] text-white font-bold z-10" style={{ left: '50%', transform: 'translateX(-50%)' }}>NOW</div>

                {closestLong && (
                  <div className="absolute top-0 bottom-0 bg-green-500/30 border-r-2 border-green-400"
                    style={{ left: 0, width: `${Math.max(5, 50 - closestLong.distance)}%` }}>
                    <span className="absolute bottom-1 left-1 text-[9px] text-green-400 font-bold">LONG</span>
                  </div>
                )}

                {closestShort && (
                  <div className="absolute top-0 bottom-0 bg-red-500/30 border-l-2 border-red-400"
                    style={{ right: 0, width: `${Math.max(5, 50 - closestShort.distance)}%` }}>
                    <span className="absolute bottom-1 right-1 text-[9px] text-red-400 font-bold">SHORT</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-green-500/10 rounded p-2">
                  <div className="text-green-400 font-bold">Long Liqs ↓</div>
                  {closestLong ? (
                    <>
                      <div className="text-white font-mono">${formatPrice(closestLong.price)}</div>
                      <div className="text-slate-400">{closestLong.distance.toFixed(1)}% away</div>
                    </>
                  ) : <div className="text-slate-500">None</div>}
                </div>
                <div className="bg-red-500/10 rounded p-2">
                  <div className="text-red-400 font-bold">Short Liqs ↑</div>
                  {closestShort ? (
                    <>
                      <div className="text-white font-mono">${formatPrice(closestShort.price)}</div>
                      <div className="text-slate-400">{closestShort.distance.toFixed(1)}% away</div>
                    </>
                  ) : <div className="text-slate-500">None</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] text-slate-500">
        Price hunts liquidations. Closer cluster = higher probability of sweep.
      </div>
    </div>
  );
};

const PositionCard = ({ position, marketData }) => {
  const isLong = position.size > 0;
  const pnlPositive = position.unrealizedPnl >= 0;
  const currentPrice = marketData?.[position.coin]?.markPx || position.entryPx;
  const liqPrice = estimateLiquidationPrice(position.entryPx, position.leverage, isLong);
  const liqDist = liquidationDistance(currentPrice, liqPrice, isLong);

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span className="font-bold text-white">{position.coin}</span>
          <span className="text-cyan-400 text-sm">{position.leverage}x</span>
        </div>
        <span className="text-slate-400 text-xs">#{position.rank}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Notional</div>
          <div className="text-white font-mono">{formatUSD(position.notional)}</div>
        </div>
        <div>
          <div className="text-slate-500">Entry</div>
          <div className="text-white font-mono">${formatPrice(position.entryPx)}</div>
        </div>
        <div>
          <div className="text-slate-500">uPNL</div>
          <div className={`font-mono font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
            {formatUSD(position.unrealizedPnl)}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Liq Dist</div>
          <div className={`font-mono ${liqDist > 20 ? 'text-green-400' : liqDist > 10 ? 'text-yellow-400' : 'text-red-400'}`}>
            {liqDist.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

const TraderRow = ({ trader, rank, isSelected, onClick }) => {
  const isConsistent = trader.weekRoi > 0 && trader.monthRoi > 0 && trader.allTimeRoi > 0;

  return (
    <tr className={`border-b border-slate-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`} onClick={onClick}>
      <td className="py-3 px-3 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
          rank === 2 ? 'bg-slate-400/20 text-slate-300' :
            rank === 3 ? 'bg-amber-600/20 text-amber-500' :
              'bg-slate-700/50 text-slate-400'
          }`}>{rank}</span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <a href={getProfileUrl(trader.address)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="text-cyan-400 hover:text-cyan-300 font-mono text-sm hover:underline">
            {formatAddress(trader.address)}
          </a>
          {isConsistent && <span className="text-purple-400" title="Consistent Winner">⭐</span>}
        </div>
      </td>
      <td className="py-3 px-3 text-right font-mono text-white text-sm">{formatUSD(trader.accountValue)}</td>
      <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${trader.weekPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatUSD(trader.weekPnl)}</td>
      <td className={`py-3 px-3 text-right font-mono text-sm ${trader.weekRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.weekRoi)}</td>
      <td className={`py-3 px-3 text-right font-mono text-sm ${trader.monthRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.monthRoi)}</td>
      <td className={`py-3 px-3 text-right font-mono text-sm ${trader.allTimeRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(trader.allTimeRoi)}</td>
      <td className="py-3 px-3 text-center text-slate-400 text-sm">{trader.positionCount || '-'}</td>
    </tr>
  );
};

const DetailModal = ({ coin, biasData, priceData, oiData, orderbookData, cvdData, fundingData, consensus, onClose }) => {
  if (!coin || !biasData) return null;

  const cons = consensus?.[coin];

  // Calculate actual data labels
  const oiChange = oiData?.sessionChange || 0;
  const priceChange = priceData?.sessionChange || 0;
  const imbalance = orderbookData?.imbalance || 0;
  // eslint-disable-next-line no-unused-vars
  const delta = cvdData?.sessionDelta || 0;
  const rate = fundingData?.rate || 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-4xl font-black text-white">{coin}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xl mb-6 ${biasData.bg}`}>
            <span className="text-2xl">{biasData.icon}</span>
            <span className={biasData.color}>{biasData.label}</span>
          </div>

          {/* MARKET DATA SECTION */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-400 mb-3">📊 MARKET DATA</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Mark Price</div>
                <div className="text-lg font-mono text-white">${formatPrice(priceData?.markPx || 0)}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Session Change</div>
                <div className={`text-lg font-mono font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Open Interest</div>
                <div className="text-lg font-mono text-white">{formatUSD(oiData?.current || 0)}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">OI Change</div>
                <div className={`text-lg font-mono font-bold ${oiChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {oiChange >= 0 ? '+' : ''}{oiChange.toFixed(2)}%
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">24h Volume</div>
                <div className="text-lg font-mono text-white">{formatUSD(oiData?.volume || 0)}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Funding Rate</div>
                <div className={`text-lg font-mono font-bold ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(rate * 100).toFixed(4)}%
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Funding APR</div>
                <div className={`text-lg font-mono font-bold ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(rate * 3 * 365 * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Book Imbalance</div>
                <div className={`text-lg font-mono font-bold ${imbalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* SIGNAL ANALYSIS */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-slate-400 mb-3">🎯 SIGNAL ANALYSIS</h4>
            <div className="space-y-2">
              {/* Flow Confluence - Combined OI + CVD + Price */}
              {(() => {
                const conf = calculateFlowConfluence(coin, oiData, cvdData, priceData);
                const bgColor = conf.signal === 'bullish' ? 'bg-green-500/10' :
                  conf.signal === 'bearish' ? 'bg-red-500/10' : 'bg-slate-800/50';
                return (
                  <div className={`rounded-lg p-3 border border-slate-700/50 ${bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white">Flow Confluence</span>
                      <span className={`font-bold ${conf.signal === 'bullish' ? 'text-green-400' :
                        conf.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'
                        }`}>
                        {{
                          'STRONG_BULL': '🟢', 'BULLISH': '🟢', 'WEAK_BULL': '🟡',
                          'STRONG_BEAR': '🔴', 'BEARISH': '🔴', 'WEAK_BEAR': '🟡',
                          'DIVERGENCE': '⚠️', 'NEUTRAL': '⚪'
                        }[conf.confluenceType] || '⚪'} {conf.confluenceType.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Direction Arrows */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-2 bg-slate-900/50 rounded-lg p-2">
                      <div>
                        <div className="text-slate-500 text-[10px]">PRICE</div>
                        <div className={`text-lg font-bold ${conf.priceDir === '↑' ? 'text-green-400' : conf.priceDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                          {conf.priceDir}
                        </div>
                        <div className={`text-[10px] font-mono ${(conf.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(conf.priceChange || 0) >= 0 ? '+' : ''}{(conf.priceChange || 0).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">OI</div>
                        <div className={`text-lg font-bold ${conf.oiDir === '↑' ? 'text-green-400' : conf.oiDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                          {conf.oiDir}
                        </div>
                        <div className={`text-[10px] font-mono ${(conf.oiChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(conf.oiChange || 0) >= 0 ? '+' : ''}{(conf.oiChange || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">CVD 5m</div>
                        <div className={`text-lg font-bold ${conf.cvdDir === '↑' ? 'text-green-400' : conf.cvdDir === '↓' ? 'text-red-400' : 'text-slate-400'}`}>
                          {conf.cvdDir}
                        </div>
                        <div className={`text-[10px] font-mono ${(conf.cvdDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatUSD(conf.cvdDelta || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">{conf.reason}</div>
                    {conf.divergence && (
                      <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                        ⚠️ {conf.divergence.message}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Orderbook Analysis */}
              <div className={`rounded-lg p-3 border border-slate-700/50 ${imbalance > 15 ? 'bg-green-500/10' : imbalance < -15 ? 'bg-red-500/10' : 'bg-slate-800/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">Orderbook</span>
                  <span className={`font-bold ${imbalance > 10 ? 'text-green-400' : imbalance < -10 ? 'text-red-400' : 'text-slate-400'}`}>
                    {imbalance > 20 ? '📗 HEAVY BIDS' :
                      imbalance > 10 ? '📗 Bids Lean' :
                        imbalance < -20 ? '📕 HEAVY ASKS' :
                          imbalance < -10 ? '📕 Asks Lean' : '⚖️ Balanced'}
                  </span>
                </div>
                <div className="text-sm text-slate-400">
                  Bid/Ask imbalance: {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}% | Bid Vol: {formatUSD(orderbookData?.bidVolume || 0)} | Ask Vol: {formatUSD(orderbookData?.askVolume || 0)}
                </div>
              </div>

              {/* Funding Analysis */}
              <div className={`rounded-lg p-3 border border-slate-700/50 ${Math.abs(rate) > 0.0005 ? (rate > 0 ? 'bg-red-500/10' : 'bg-green-500/10') : 'bg-slate-800/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white">Funding</span>
                  <span className={`font-bold ${rate > 0.0005 ? 'text-red-400' : rate < -0.0005 ? 'text-green-400' : rate > 0 ? 'text-green-400' : rate < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {rate > 0.0005 ? '⚠️ CROWDED LONGS' :
                      rate < -0.0005 ? '⚠️ CROWDED SHORTS' :
                        rate > 0.0002 ? 'Bullish Bias' :
                          rate < -0.0002 ? 'Bearish Bias' : 'Neutral'}
                  </span>
                </div>
                <div className="text-sm text-slate-400">
                  Rate: {(rate * 100).toFixed(4)}% per 8h | APR: {(rate * 3 * 365 * 100).toFixed(1)}% | {rate > 0 ? 'Longs pay shorts' : rate < 0 ? 'Shorts pay longs' : 'Neutral'}
                </div>
              </div>
            </div>
          </div>

          {/* WHALE POSITIONS */}
          {cons && (cons.longs.length > 0 || cons.shorts.length > 0) && (
            <div>
              <h4 className="text-sm font-bold text-slate-400 mb-3">🐋 TOP 10 TRADER POSITIONS</h4>
              <div className="bg-slate-800/30 rounded-lg p-3 mb-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{cons.longs.length}</div>
                    <div className="text-xs text-slate-500">Longs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{formatUSD(cons.totalNotional || 0)}</div>
                    <div className="text-xs text-slate-500">Total Notional</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-400">{cons.shorts.length}</div>
                    <div className="text-xs text-slate-500">Shorts</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-green-400 text-sm font-bold mb-2">LONGS ({cons.longs.length})</div>
                  {cons.longs.slice(0, 5).map((p, i) => (
                    <div key={i} className="text-xs flex justify-between py-1 border-b border-slate-800">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                        #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '⭐'}
                      </a>
                      <span className="text-slate-400">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-red-400 text-sm font-bold mb-2">SHORTS ({cons.shorts.length})</div>
                  {cons.shorts.slice(0, 5).map((p, i) => (
                    <div key={i} className="text-xs flex justify-between py-1 border-b border-slate-800">
                      <a href={getProfileUrl(p.trader)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                        #{p.rank} {formatAddress(p.trader)} {p.isConsistent && '⭐'}
                      </a>
                      <span className="text-slate-400">{formatUSD(p.notional)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============== MAIN APP ==============
export default function TraderBiasDashboard() {
  // Core state
  const [traders, setTraders] = useState([]);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [traderPositions, setTraderPositions] = useState([]);
  const [consensus, setConsensus] = useState({});
  const [allPositions, setAllPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardTimeframe, setDashboardTimeframe] = useState('1h'); // '1h', '4h', '8h'
  const [expandedCoin, setExpandedCoin] = useState(null);
  const [activeExchange, setActiveExchange] = useState(DEFAULT_EXCHANGE);

  // Market data state (updated by fetches)
  const [oiData, setOiData] = useState({});
  const [priceData, setPriceData] = useState({});
  const [fundingData, setFundingData] = useState({});
  const [orderbookData, setOrderbookData] = useState({});
  const [cvdData, setCvdData] = useState({});
  const [positionChanges, setPositionChanges] = useState([]);
  const [whaleTrades, setWhaleTrades] = useState([]);

  // Refs for cumulative tracking (don't trigger re-renders)
  const sessionStartRef = useRef({
    oi: {},
    price: {},
    time: new Date()
  });
  const cvdAccumulatorRef = useRef({ BTC: { sessionDelta: 0, totalBuy: 0, totalSell: 0, lastDelta: 0, history: [] }, ETH: { sessionDelta: 0, totalBuy: 0, totalSell: 0, lastDelta: 0, history: [] }, SOL: { sessionDelta: 0, totalBuy: 0, totalSell: 0, lastDelta: 0, history: [] } });
  const orderbookHistoryRef = useRef({ BTC: [], ETH: [], SOL: [] });
  const prevPositionsRef = useRef({});
  const prevFundingRef = useRef({});
  const isFirstLoadRef = useRef(true);

  // Historical data refs for timeframe calculations (1h, 4h, 8h)
  // Data is persisted to localStorage and kept for up to 7 days
  const HISTORICAL_STORAGE_KEY = 'hyperliquid_historical_data';
  const MAX_HISTORY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Initialize historical data from localStorage
  const loadHistoricalData = () => {
    try {
      const stored = localStorage.getItem(HISTORICAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Clean up old data on load
        const now = Date.now();
        ['oi', 'price', 'orderbook'].forEach(type => {
          ['BTC', 'ETH', 'SOL'].forEach(coin => {
            if (parsed[type]?.[coin]) {
              parsed[type][coin] = parsed[type][coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
            }
          });
        });
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load historical data from localStorage:', e);
    }
    return {
      oi: { BTC: [], ETH: [], SOL: [] },
      price: { BTC: [], ETH: [], SOL: [] },
      orderbook: { BTC: [], ETH: [], SOL: [] }
    };
  };

  // Save historical data to localStorage (debounced to avoid excessive writes)
  const saveHistoricalData = useCallback((data) => {
    try {
      localStorage.setItem(HISTORICAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save historical data to localStorage:', e);
    }
  }, []);

  const historicalDataRef = useRef(loadHistoricalData());

  // Helper: Get value from N hours ago (returns null if insufficient data)
  const getHistoricalValue = (history, hoursAgo) => {
    if (!history || history.length === 0) return null;

    const targetTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
    const oldestEntry = history[0];

    // Check if we have data going back far enough
    // Allow 10% tolerance (e.g., for 1h, oldest data must be at least 54 min ago)
    const minRequiredAge = hoursAgo * 60 * 60 * 1000 * 0.9;
    const actualAge = Date.now() - oldestEntry.timestamp;

    if (actualAge < minRequiredAge) {
      return null; // Not enough historical data yet
    }

    // Find closest value to target time
    let closest = history[0];
    for (const entry of history) {
      if (entry.timestamp <= targetTime) {
        closest = entry;
      } else {
        break;
      }
    }
    return closest?.value ?? null;
  };

  // Helper: Calculate change for timeframe (returns null if insufficient data)
  const calculateTimeframeChange = (currentValue, history, timeframeHours) => {
    const pastValue = getHistoricalValue(history, timeframeHours);
    if (pastValue === null || pastValue === 0) return null;
    return ((currentValue - pastValue) / pastValue) * 100;
  };

  // Helper: Get average orderbook imbalance over timeframe
  const getAverageImbalance = (history, timeframeHours) => {
    const cutoffTime = Date.now() - (timeframeHours * 60 * 60 * 1000);
    const relevantEntries = history.filter(e => e.timestamp >= cutoffTime);
    if (relevantEntries.length === 0) return 0;
    const sum = relevantEntries.reduce((acc, e) => acc + e.imbalance, 0);
    return sum / relevantEntries.length;
  };

  // Convert timeframe string to hours
  const timeframeToHours = (tf) => {
    const map = { '1h': 1, '4h': 4, '8h': 8 };
    return map[tf] || 1;
  };

  // Whale WebSocket connections for $4M+ trades across all exchanges
  const { trades: megaWhaleTrades, connectionStatus: whaleConnectionStatus, isConnected: whaleWsConnected } = useWhaleWebSockets();



  // Fetch market data (OI, prices, funding) - 1 min interval
  const fetchMarketData = async () => {
    try {
      const res = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
      });
      const data = await res.json();

      const [meta, assetCtxs] = data;
      const universe = meta?.universe || [];

      const newOiData = {};
      const newPriceData = {};
      const newFundingData = {};

      universe.forEach((asset, i) => {
        const ctx = assetCtxs[i];
        if (ctx && asset && ['BTC', 'ETH', 'SOL'].includes(asset.name)) {
          const coin = asset.name;
          const funding = parseFloat(ctx.funding || 0);
          const openInterest = parseFloat(ctx.openInterest || 0);
          const markPx = parseFloat(ctx.markPx || 0);
          const dayNtlVlm = parseFloat(ctx.dayNtlVlm || 0);

          // Initialize session baseline if first time
          if (!sessionStartRef.current.oi[coin]) {
            sessionStartRef.current.oi[coin] = openInterest;
          }
          if (!sessionStartRef.current.price[coin]) {
            sessionStartRef.current.price[coin] = markPx;
          }

          // Calculate session changes (cumulative from session start)
          const oiSessionChange = sessionStartRef.current.oi[coin] > 0
            ? ((openInterest - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
            : 0;
          const priceSessionChange = sessionStartRef.current.price[coin] > 0
            ? ((markPx - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;

          // Funding trend
          const prevFunding = prevFundingRef.current[coin] || funding;
          const fundingTrend = funding - prevFunding;
          prevFundingRef.current[coin] = funding;

          newOiData[coin] = {
            current: openInterest,
            sessionStart: sessionStartRef.current.oi[coin],
            sessionChange: oiSessionChange,
            volume: dayNtlVlm
          };

          newPriceData[coin] = {
            markPx,
            sessionStart: sessionStartRef.current.price[coin],
            sessionChange: priceSessionChange
          };

          newFundingData[coin] = {
            rate: funding,
            trend: fundingTrend,
            annualized: funding * 24 * 365 * 100
          };
        }
      });

      setOiData(newOiData);
      setPriceData(newPriceData);
      setFundingData(newFundingData);

      // Store historical data for timeframe calculations
      const now = Date.now();

      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);
    } catch (err) {
      console.error('Error fetching market data:', err);
    }
  };

  // Fetch orderbooks - 30s interval with rolling average
  const fetchOrderbooks = async () => {
    try {
      const coins = ['BTC', 'ETH', 'SOL'];
      const newOrderbookData = {};

      for (const coin of coins) {
        const res = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'l2Book', coin })
        });
        const data = await res.json();

        let bidVolume = 0, askVolume = 0;

        if (data.levels) {
          (data.levels[0] || []).forEach(level => { bidVolume += parseFloat(level.sz) * parseFloat(level.px); });
          (data.levels[1] || []).forEach(level => { askVolume += parseFloat(level.sz) * parseFloat(level.px); });
        }

        const totalVolume = bidVolume + askVolume;
        const imbalance = totalVolume > 0 ? ((bidVolume - askVolume) / totalVolume) * 100 : 0;

        // Keep last 10 readings for rolling average (5 min at 30s intervals)
        orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
        const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

        newOrderbookData[coin] = { bidVolume, askVolume, imbalance, avgImbalance };
      }

      setOrderbookData(newOrderbookData);

      // Store orderbook historical data for timeframe calculations
      const now = Date.now();

      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOrderbookData[coin]) {
          historicalDataRef.current.orderbook[coin].push({
            timestamp: now,
            imbalance: newOrderbookData[coin].imbalance,
            bidVol: newOrderbookData[coin].bidVolume,
            askVol: newOrderbookData[coin].askVolume
          });
          historicalDataRef.current.orderbook[coin] = historicalDataRef.current.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);
    } catch (err) {
      console.error('Error fetching orderbooks:', err);
    }
  };

  // Fetch CVD (volume delta) - 30s interval with cumulative tracking via refs
  const fetchCVD = async () => {
    try {
      const coins = ['BTC', 'ETH', 'SOL'];
      const newCvdData = {};

      for (const coin of coins) {
        const res = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'recentTrades', coin })
        });
        const trades = await res.json();

        let recentBuyVol = 0, recentSellVol = 0;

        (trades || []).forEach(trade => {
          const vol = parseFloat(trade.sz) * parseFloat(trade.px);
          if (trade.side === 'B') recentBuyVol += vol;
          else if (trade.side === 'A') recentSellVol += vol;
        });

        const recentDelta = recentBuyVol - recentSellVol;

        // Use ref for cumulative tracking (doesn't cause re-render loops)
        const acc = cvdAccumulatorRef.current[coin];

        // Ensure history exists
        if (!acc.history) acc.history = [];

        acc.sessionDelta += recentDelta;
        acc.totalBuy += recentBuyVol;
        acc.totalSell += recentSellVol;

        // Add to history
        const now = Date.now();
        acc.history.push({ delta: recentDelta, time: now });

        // Prune history > 5 min (300,000 ms)
        acc.history = acc.history.filter(item => now - item.time < 300000);

        // Calculate rolling 5m delta
        const rolling5mDelta = acc.history.reduce((sum, item) => sum + item.delta, 0);

        const trend = recentDelta - acc.lastDelta;
        acc.lastDelta = recentDelta;

        newCvdData[coin] = {
          recentDelta,
          sessionDelta: acc.sessionDelta,
          rolling5mDelta,
          trend,
          totalBuyVolume: acc.totalBuy,
          totalSellVolume: acc.totalSell
        };
      }

      setCvdData(newCvdData);
    } catch (err) {
      console.error('Error fetching CVD:', err);
    }
  };

  // Fetch whale trades - detect individual trades over $10M
  const fetchWhaleTrades = async () => {
    try {
      const targetCoins = ['BTC', 'ETH', 'SOL'];
      const newWhaleTrades = [];

      for (const coin of targetCoins) {
        const res = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'recentTrades', coin })
        });
        const trades = await res.json();

        // Find trades over $10M notional
        (trades || []).forEach(trade => {
          const notional = parseFloat(trade.sz) * parseFloat(trade.px);
          if (notional >= 10000000) { // $10M+
            newWhaleTrades.push({
              coin,
              side: trade.side === 'B' ? 'BUY' : 'SELL',
              size: parseFloat(trade.sz),
              price: parseFloat(trade.px),
              notional,
              time: new Date(trade.time),
              hash: trade.hash
            });
          }
        });
      }

      setWhaleTrades(prev => {
        // Merge and deduplicate
        const unique = [...newWhaleTrades, ...prev].filter((v, i, a) => a.findIndex(t => t.hash === v.hash) === i);
        return unique.slice(0, 50); // Keep last 50
      });
    } catch (err) {
      console.error('Error fetching whale trades:', err);
    }
  };

  // ================= BINANCE INTEGRATION (FUTURES API) =================
  const fetchBinanceData = async () => {
    if (activeExchange !== 'binance') return;

    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };
    const coins = ['BTC', 'ETH', 'SOL'];
    const newPriceData = {};
    const newFundingData = {};
    const newOrderbookData = {};
    const newOiData = {};

    try {
      for (const coin of coins) {
        const symbol = symbolMap[coin];

        // 1. Ticker & Price (24hr ticker)
        const tickerRes = await fetch(`/api/binance/fapi/v1/ticker/24hr?symbol=${symbol}`);
        const ticker = await tickerRes.json();

        // 2. Funding Rate (Premium Index)
        const fundingRes = await fetch(`/api/binance/fapi/v1/premiumIndex?symbol=${symbol}`);
        const fundingInfo = await fundingRes.json();

        // 3. Orderbook (Depth)
        const depthRes = await fetch(`/api/binance/fapi/v1/depth?symbol=${symbol}&limit=10`);
        const depth = await depthRes.json();

        // Process Price
        const price = parseFloat(ticker.lastPrice);
        if (!sessionStartRef.current.price[coin]) sessionStartRef.current.price[coin] = price;
        const priceSessionChange = sessionStartRef.current.price[coin] > 0
          ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
          : 0;

        newPriceData[coin] = {
          markPx: price,
          sessionStart: sessionStartRef.current.price[coin],
          sessionChange: priceSessionChange
        };

        // Process Funding
        const rate = parseFloat(fundingInfo.lastFundingRate);
        newFundingData[coin] = {
          rate: rate,
          trend: 0,
          annualized: rate * 3 * 365 * 100 // Binance is 8h funding (x3)
        };

        // Process Orderbook
        let bidVol = 0;
        let askVol = 0;
        if (depth.bids) {
          depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
          depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));
        }
        const totalVol = bidVol + askVol;
        const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

        // Rolling average for OB
        if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
        orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
        const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

        newOrderbookData[coin] = {
          bidVolume: bidVol,
          askVolume: askVol,
          imbalance: imbalance,
          avgImbalance
        };

        // 4. Open Interest (Real OI endpoint)
        const oiRes = await fetch(`/api/binance/fapi/v1/openInterest?symbol=${symbol}`);
        const oiInfo = await oiRes.json();
        const oiValue = parseFloat(oiInfo.openInterest) * price; // Convert contracts to notional USD

        // Track OI session start
        if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
        if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
        const oiSessionChange = sessionStartRef.current.oi[coin] > 0
          ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
          : 0;

        newOiData[coin] = {
          current: oiValue,
          sessionChange: oiSessionChange,
          volume: parseFloat(ticker.quoteVolume)
        };
      }

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      // Store historical data for timeframe calculations
      const now = Date.now();
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newOrderbookData[coin]) {
          historicalDataRef.current.orderbook[coin].push({ timestamp: now, imbalance: newOrderbookData[coin].imbalance });
          historicalDataRef.current.orderbook[coin] = historicalDataRef.current.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);

    } catch (error) {
      console.error("Binance Fetch Error (CORS likely):", error);
    }
  };

  // ================= BYBIT INTEGRATION =================
  const fetchBybitData = async () => {
    if (activeExchange !== 'bybit') return;

    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };
    const coins = ['BTC', 'ETH', 'SOL'];
    const newPriceData = {};
    const newFundingData = {};
    const newOrderbookData = {};
    const newOiData = {};
    try {
      for (const coin of coins) {
        const symbol = symbolMap[coin];

        // 1. Ticker (Price, Volume, Funding, 24h Change)
        const tickerRes = await fetch(`/api/bybit/v5/market/tickers?category=linear&symbol=${symbol}`);

        // DEBUG: Log Bybit response
        if (!tickerRes.ok) {
          console.error(`Bybit Error ${tickerRes.status}:`, await tickerRes.text());
          continue;
        }

        const tickerData = await tickerRes.json();

        if (tickerData.retCode !== 0) {
          console.warn("Bybit API Error:", tickerData.retMsg);
          // retCode 10003 often means IP region ban
        }

        const ticker = tickerData.result?.list?.[0];

        if (ticker) {
          // Price
          const price = parseFloat(ticker.lastPrice);
          if (!sessionStartRef.current.price[coin]) sessionStartRef.current.price[coin] = price;
          const priceSessionChange = sessionStartRef.current.price[coin] > 0
            ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;

          newPriceData[coin] = {
            markPx: price,
            sessionStart: sessionStartRef.current.price[coin],
            sessionChange: priceSessionChange
          };

          // Funding
          const rate = parseFloat(ticker.fundingRate);
          newFundingData[coin] = {
            rate: rate,
            trend: 0,
            annualized: rate * 3 * 365 * 100 // Bybit is 8h funding (x3)
          };

          // OI (Convert to USD notional + track session change)
          const oiValue = parseFloat(ticker.openInterest) * price; // Convert contracts to USD

          // Track OI session start
          if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
          if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
          const oiSessionChange = sessionStartRef.current.oi[coin] > 0
            ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
            : 0;

          newOiData[coin] = {
            current: oiValue,
            sessionChange: oiSessionChange,
            volume: parseFloat(ticker.turnover24h)
          };
        }

        // 2. Orderbook
        const depthRes = await fetch(`/api/bybit/v5/market/orderbook?category=linear&symbol=${symbol}&limit=10`);
        const depthData = await depthRes.json();
        const depth = depthData.result;

        if (depth) {
          let bidVol = 0; let askVol = 0;
          depth.b.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
          depth.a.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

          const totalVol = bidVol + askVol;
          const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

          if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
          orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
          const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

          newOrderbookData[coin] = {
            bidVolume: bidVol,
            askVolume: askVol,
            imbalance: imbalance,
            avgImbalance
          };
        }
      } // End for loop

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      // Store historical data for timeframe calculations
      const now = Date.now();
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newOrderbookData[coin]) {
          historicalDataRef.current.orderbook[coin].push({ timestamp: now, imbalance: newOrderbookData[coin].imbalance });
          historicalDataRef.current.orderbook[coin] = historicalDataRef.current.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);

    } catch (error) {
      console.error("Bybit Fetch Error (CORS likely):", error);
    }
  };

  // ================= NADO INTEGRATION =================
  const fetchNadoData = async () => {
    if (activeExchange !== 'nado') return;

    const NADO_ARCHIVE = 'https://archive.prod.nado.xyz/v1';
    const productMap = { 'BTC': 2, 'ETH': 4, 'SOL': 8 };
    const coins = ['BTC', 'ETH', 'SOL'];

    const newPriceData = {};
    const newFundingData = {};
    const newOiData = {};

    try {
      // 1. Fetch Perp Prices (has mark & index price)
      const priceRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
        body: JSON.stringify({
          perp_prices: { product_ids: Object.values(productMap) }
        })
      });
      const priceData = await priceRes.json();

      // 2. Fetch Funding Rates (24h funding)
      const fundingRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
        body: JSON.stringify({
          funding_rates: { product_ids: Object.values(productMap) }
        })
      });
      const fundingRatesData = await fundingRes.json();

      // 3. Fetch Market Snapshots for volume data
      const snapshotRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
        body: JSON.stringify({
          market_snapshots: {
            interval: { count: 1, granularity: 3600 },
            product_ids: Object.values(productMap)
          }
        })
      });
      const snapshotData = await snapshotRes.json();

      // Process each coin
      for (const coin of coins) {
        const productId = productMap[coin];

        // Price Data - divide by 1e18
        const coinPrice = priceData?.[productId];
        if (coinPrice) {
          const markPx = parseFloat(coinPrice.mark_price_x18) / 1e18;
          const indexPx = parseFloat(coinPrice.index_price_x18) / 1e18;

          if (!sessionStartRef.current.price[coin]) {
            sessionStartRef.current.price[coin] = markPx;
          }
          const sessionChange = sessionStartRef.current.price[coin] > 0
            ? ((markPx - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;

          newPriceData[coin] = {
            markPx,
            indexPx,
            sessionStart: sessionStartRef.current.price[coin],
            sessionChange
          };

          // Placeholder OI value
          if (!newOiData[coin]) {
            if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
            newOiData[coin] = {
              current: 0,
              sessionChange: 0,
              volume: 0
            };
          }
        }

        // Funding Data - divide by 1e18 to get rate (already 24h rate)
        const coinFunding = fundingRatesData?.[productId];
        if (coinFunding) {
          const rate = parseFloat(coinFunding.funding_rate_x18) / 1e18;
          newFundingData[coin] = {
            rate: rate / 24, // Convert 24h rate to hourly for consistency
            trend: 0,
            annualized: rate * 365 * 100  // 24h funding -> annual %
          };
        }
      }

      // Parse market snapshots if available
      if (snapshotData && Array.isArray(snapshotData.snapshots)) {
        for (const snapshot of snapshotData.snapshots) {
          const productId = snapshot.product_id;
          const coin = Object.entries(productMap).find(([_, id]) => id === productId)?.[0];
          if (coin && snapshot.open_interest_x18) {
            const oiValue = parseFloat(snapshot.open_interest_x18) / 1e18;
            if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
            if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;

            const oiSessionChange = sessionStartRef.current.oi[coin] > 0
              ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
              : 0;

            newOiData[coin] = {
              current: oiValue,
              sessionChange: oiSessionChange,
              volume: parseFloat(snapshot.volume_24h_x18 || '0') / 1e18
            };
          }
        }
      }

      if (Object.keys(newPriceData).length > 0) setPriceData(newPriceData);
      if (Object.keys(newFundingData).length > 0) setFundingData(newFundingData);
      if (Object.keys(newOiData).length > 0) setOiData(newOiData);

      // Store historical data for timeframe calculations
      const now = Date.now();
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);

    } catch (error) {
      console.error('Nado Fetch Error:', error);
    }
  };

  // ================= ASTERDEX INTEGRATION =================
  const fetchAsterDexData = async () => {
    if (activeExchange !== 'asterdex') return;

    const ASTER_API = 'https://fapi.asterdex.com';
    const symbolMap = { 'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT' };
    const coins = ['BTC', 'ETH', 'SOL'];

    const newPriceData = {};
    const newFundingData = {};
    const newOrderbookData = {};
    const newOiData = {};

    try {
      for (const coin of coins) {
        const symbol = symbolMap[coin];

        // 1. Ticker (Price, Volume, 24h Change) - Binance style
        const tickerRes = await fetch(`${ASTER_API}/fapi/v1/ticker/24hr?symbol=${symbol}`);
        const ticker = await tickerRes.json();

        // 2. Premium Index (Funding Rate, Mark Price)
        const fundingRes = await fetch(`${ASTER_API}/fapi/v1/premiumIndex?symbol=${symbol}`);
        const fundingInfo = await fundingRes.json();

        // 3. Open Interest
        const oiRes = await fetch(`${ASTER_API}/fapi/v1/openInterest?symbol=${symbol}`);
        const oiInfo = await oiRes.json();

        // 4. Orderbook Depth
        const depthRes = await fetch(`${ASTER_API}/fapi/v1/depth?symbol=${symbol}&limit=10`);
        const depth = await depthRes.json();

        // Process Price Data
        const price = parseFloat(ticker.lastPrice);
        if (!sessionStartRef.current.price[coin]) {
          sessionStartRef.current.price[coin] = price;
        }
        const priceSessionChange = sessionStartRef.current.price[coin] > 0
          ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
          : 0;

        newPriceData[coin] = {
          markPx: parseFloat(fundingInfo.markPrice),
          indexPx: parseFloat(fundingInfo.indexPrice),
          sessionStart: sessionStartRef.current.price[coin],
          sessionChange: priceSessionChange
        };

        // Process Funding Rate
        const rate = parseFloat(fundingInfo.lastFundingRate);
        newFundingData[coin] = {
          rate: rate,
          trend: 0,
          annualized: rate * 3 * 365 * 100 // 8h funding (x3 per day)
        };

        // Process Open Interest
        const oiValue = parseFloat(oiInfo.openInterest) * price; // Convert to notional USD
        if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
        if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
        const oiSessionChange = sessionStartRef.current.oi[coin] > 0
          ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
          : 0;

        newOiData[coin] = {
          current: oiValue,
          sessionChange: oiSessionChange,
          volume: parseFloat(ticker.quoteVolume)
        };

        // Process Orderbook
        if (depth.bids && depth.asks) {
          let bidVol = 0;
          let askVol = 0;
          depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
          depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

          const totalVol = bidVol + askVol;
          const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

          if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
          orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
          const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

          newOrderbookData[coin] = {
            bidVolume: bidVol,
            askVolume: askVol,
            imbalance: imbalance,
            avgImbalance
          };
        }
      }

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      // Store historical data for timeframe calculations
      const now = Date.now();
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newOrderbookData[coin]) {
          historicalDataRef.current.orderbook[coin].push({ timestamp: now, imbalance: newOrderbookData[coin].imbalance });
          historicalDataRef.current.orderbook[coin] = historicalDataRef.current.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData(historicalDataRef.current);

    } catch (error) {
      console.error('AsterDex Fetch Error:', error);
    }
  };

  // Fetch leaderboard and whale consensus together - 5 min interval
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(LEADERBOARD_API);
      const data = await res.json();

      const rows = data.leaderboardRows || [];
      const processed = rows.map(t => {
        const perfs = Object.fromEntries(t.windowPerformances || []);
        return {
          address: t.ethAddress,
          displayName: t.displayName,
          accountValue: parseFloat(t.accountValue || 0),
          weekPnl: parseFloat(perfs.week?.pnl || 0),
          weekRoi: parseFloat(perfs.week?.roi || 0),
          monthPnl: parseFloat(perfs.month?.pnl || 0),
          monthRoi: parseFloat(perfs.month?.roi || 0),
          allTimePnl: parseFloat(perfs.allTime?.pnl || 0),
          allTimeRoi: parseFloat(perfs.allTime?.roi || 0),
        };
      });

      processed.sort((a, b) => b.weekPnl - a.weekPnl);
      const topTraders = processed.slice(0, 200);

      // Fetch consensus for top 10 traders inline
      const coinData = {};
      const positions = [];
      const allChanges = [];
      const newPrevPositions = { ...prevPositionsRef.current };

      for (let i = 0; i < Math.min(10, topTraders.length); i++) {
        const trader = topTraders[i];
        try {
          const posRes = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: trader.address })
          });
          const posData = await posRes.json();

          const traderPositions = [];
          let posCount = 0;

          for (const ap of (posData.assetPositions || [])) {
            const pos = ap.position || {};
            const size = parseFloat(pos.szi || 0);
            if (size !== 0) {
              posCount++;
              const coin = pos.coin;
              const direction = size > 0 ? 'long' : 'short';
              const entryPx = parseFloat(pos.entryPx || 0);
              const notional = Math.abs(size) * entryPx;
              const unrealizedPnl = parseFloat(pos.unrealizedPnl || 0);
              const leverage = pos.leverage?.value || 1;

              const positionData = {
                trader: trader.address,
                rank: i + 1,
                coin,
                direction,
                size,
                notional,
                entryPx,
                unrealizedPnl,
                leverage,
                isConsistent: trader.weekRoi > 0 && trader.monthRoi > 0 && trader.allTimeRoi > 0,
              };

              traderPositions.push(positionData);
              positions.push({ ...positionData });

              if (!coinData[coin]) {
                coinData[coin] = { longs: [], shorts: [], totalNotional: 0 };
              }
              coinData[coin][direction === 'long' ? 'longs' : 'shorts'].push(positionData);
              coinData[coin].totalNotional += notional;
            }
          }

          // Detect position changes (only after first load)
          if (!isFirstLoadRef.current) {
            const prevTraderPos = prevPositionsRef.current[trader.address] || {};
            const currentCoins = new Set();

            traderPositions.forEach(pos => {
              currentCoins.add(pos.coin);
              const prevPos = prevTraderPos[pos.coin];

              if (!prevPos) {
                allChanges.push({ type: 'entry', trader: trader.address, rank: i + 1, coin: pos.coin, direction: pos.size > 0 ? 'LONG' : 'SHORT', notional: pos.notional, time: new Date() });
              } else if (Math.sign(pos.size) !== Math.sign(prevPos.size)) {
                allChanges.push({ type: 'flip', trader: trader.address, rank: i + 1, coin: pos.coin, direction: pos.size > 0 ? 'LONG' : 'SHORT', notional: pos.notional, time: new Date() });
              } else if (Math.abs(pos.size) > Math.abs(prevPos.size) * 1.1) {
                allChanges.push({ type: 'increase', trader: trader.address, rank: i + 1, coin: pos.coin, direction: pos.size > 0 ? 'LONG' : 'SHORT', notional: pos.notional, time: new Date() });
              } else if (Math.abs(pos.size) < Math.abs(prevPos.size) * 0.9) {
                allChanges.push({ type: 'decrease', trader: trader.address, rank: i + 1, coin: pos.coin, direction: pos.size > 0 ? 'LONG' : 'SHORT', notional: pos.notional, time: new Date() });
              }
            });

            Object.keys(prevTraderPos).forEach(coin => {
              if (!currentCoins.has(coin)) {
                allChanges.push({ type: 'exit', trader: trader.address, rank: i + 1, coin, direction: prevTraderPos[coin].size > 0 ? 'LONG' : 'SHORT', notional: prevTraderPos[coin].notional, time: new Date() });
              }
            });
          }

          newPrevPositions[trader.address] = {};
          traderPositions.forEach(p => {
            newPrevPositions[trader.address][p.coin] = { size: p.size, notional: p.notional };
          });

          trader.positionCount = posCount;
        } catch (err) {
          console.error(`Error fetching ${trader.address}:`, err);
        }
      }

      prevPositionsRef.current = newPrevPositions;
      setConsensus(coinData);
      setAllPositions(positions);

      if (allChanges.length > 0) {
        setPositionChanges(prev => [...allChanges, ...prev].slice(0, 50));
      }

      setTraders(topTraders);
      setLastUpdate(new Date());
      setLoading(false);

      if (isFirstLoadRef.current) isFirstLoadRef.current = false;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Fetch individual trader positions
  const fetchTraderPositions = async (address) => {
    try {
      const res = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: address })
      });
      const data = await res.json();

      const positions = (data.assetPositions || [])
        .filter(ap => parseFloat(ap.position?.szi || 0) !== 0)
        .map(ap => {
          const pos = ap.position;
          const size = parseFloat(pos.szi || 0);
          return {
            coin: pos.coin,
            size,
            direction: size > 0 ? 'LONG' : 'SHORT',
            entryPx: parseFloat(pos.entryPx || 0),
            notional: Math.abs(size) * parseFloat(pos.entryPx || 0),
            unrealizedPnl: parseFloat(pos.unrealizedPnl || 0),
            leverage: pos.leverage?.value || 1,
          };
        });

      setTraderPositions(positions);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // Effect for Alternate Exchanges (Binance/Bybit)
  useEffect(() => {
    // Clear intervals if not active
    if (activeExchange === 'hyperliquid') return;

    let intervalId;

    const runFetch = () => {
      if (activeExchange === 'binance') fetchBinanceData();
      if (activeExchange === 'bybit') fetchBybitData();
      if (activeExchange === 'nado') fetchNadoData();
      if (activeExchange === 'asterdex') fetchAsterDexData();
    };

    runFetch(); // Initial run
    intervalId = setInterval(runFetch, 5000); // 5s updates for other exchanges

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExchange]);

  // Setup intervals - run depending on active exchange
  useEffect(() => {
    // Clear data when switching exchanges to avoid stale data
    if (activeExchange !== 'hyperliquid') {
      setOiData({});
      setPriceData({});
      setFundingData({});
      setOrderbookData({});
      setCvdData({});
      setConsensus({});
      setWhaleTrades([]);
      setPositionChanges([]);
      setTraderPositions([]);
    }

    if (activeExchange === 'hyperliquid') {
      // Initial fetches
      fetchLeaderboard();
      fetchMarketData();
      fetchOrderbooks();
      fetchCVD();
      fetchWhaleTrades();

      // TRADER-FOCUSED INTERVALS:
      const leaderboardInterval = setInterval(fetchLeaderboard, 30000);   // 30s - High frequency whale tracking
      const marketDataInterval = setInterval(fetchMarketData, 60000);     // 1 min
      const orderbookInterval = setInterval(fetchOrderbooks, 30000);      // 30s
      const cvdInterval = setInterval(fetchCVD, 30000);                   // 30s
      const whaleTradesInterval = setInterval(fetchWhaleTrades, 15000);   // 15s

      return () => {
        clearInterval(leaderboardInterval);
        clearInterval(marketDataInterval);
        clearInterval(orderbookInterval);
        clearInterval(cvdInterval);
        clearInterval(whaleTradesInterval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExchange]); // Re-run when exchange changes

  useEffect(() => {
    if (selectedTrader) fetchTraderPositions(selectedTrader.address);
  }, [selectedTrader]);

  // Calculate composite bias scores
  const allData = { oiData, priceData, fundingData, orderbookData, cvdData, consensus };
  const biasScores = {
    BTC: calculateCompositeBias('BTC', allData),
    ETH: calculateCompositeBias('ETH', allData),
    SOL: calculateCompositeBias('SOL', allData)
  };

  // eslint-disable-next-line no-unused-vars
  const bullishCount = Object.values(biasScores).filter(b => b.score > 2).length;
  // eslint-disable-next-line no-unused-vars
  const bearishCount = Object.values(biasScores).filter(b => b.score < -2).length;

  // Session duration
  const sessionDuration = Math.floor((new Date() - sessionStartRef.current.time) / 60000);

  // Compute timeframe-adjusted data for Flow Confluence and Orderbook
  const timeframeHours = timeframeToHours(dashboardTimeframe);

  const timeframeOiData = {};
  const timeframePriceData = {};
  const timeframeOrderbookData = {};

  // Track if we have enough historical data for the selected timeframe
  let hasEnoughHistoricalData = true;

  ['BTC', 'ETH', 'SOL'].forEach(coin => {
    // OI data with timeframe-based session change
    const currentOi = oiData[coin]?.current || 0;
    const oiHistory = historicalDataRef.current.oi[coin] || [];
    const tfOiChange = calculateTimeframeChange(currentOi, oiHistory, timeframeHours);

    // If null (insufficient data), fallback to session change
    const oiHasData = tfOiChange !== null;
    if (!oiHasData) hasEnoughHistoricalData = false;

    timeframeOiData[coin] = {
      ...oiData[coin],
      sessionChange: oiHasData ? tfOiChange : (oiData[coin]?.sessionChange || 0),
      hasTimeframeData: oiHasData,
      timeframeLabel: `${dashboardTimeframe.toUpperCase()} Change`
    };

    // Price data with timeframe-based session change  
    const currentPrice = parseFloat(priceData[coin]?.markPx) || 0;
    const priceHistory = historicalDataRef.current.price[coin] || [];
    const tfPriceChange = calculateTimeframeChange(currentPrice, priceHistory, timeframeHours);

    const priceHasData = tfPriceChange !== null;
    if (!priceHasData) hasEnoughHistoricalData = false;

    timeframePriceData[coin] = {
      ...priceData[coin],
      sessionChange: priceHasData ? tfPriceChange : (priceData[coin]?.sessionChange || 0),
      hasTimeframeData: priceHasData
    };

    // Orderbook data with timeframe-averaged imbalance
    const obHistory = historicalDataRef.current.orderbook[coin] || [];
    const avgImbalance = obHistory.length > 0
      ? getAverageImbalance(obHistory, timeframeHours)
      : (orderbookData[coin]?.avgImbalance || 0);

    timeframeOrderbookData[coin] = {
      ...orderbookData[coin],
      avgImbalance: avgImbalance,
      timeframeAvgImbalance: avgImbalance
    };
  });
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Loading trader data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4 text-lg">Error: {error}</p>
          <button onClick={fetchLeaderboard} className="px-6 py-3 bg-cyan-500 rounded-xl text-white font-bold">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {expandedCoin && (
        <DetailModal
          coin={expandedCoin}
          biasData={biasScores[expandedCoin]}
          priceData={priceData[expandedCoin]}
          oiData={oiData[expandedCoin]}
          orderbookData={orderbookData[expandedCoin]}
          cvdData={cvdData[expandedCoin]}
          fundingData={fundingData[expandedCoin]}
          consensus={consensus}
          onClose={() => setExpandedCoin(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header with Exchange Selector */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black mb-1">
              {EXCHANGES[activeExchange]?.icon} {EXCHANGES[activeExchange]?.name || 'TRADER BIAS'}
            </h1>
            <p className="text-slate-500 text-sm">
              {EXCHANGES[activeExchange]?.status === 'active' ? (
                <>
                  Session: {sessionDuration}min
                  {lastUpdate && <span className="ml-2">• Updated {lastUpdate.toLocaleTimeString()}</span>}
                </>
              ) : (
                EXCHANGES[activeExchange]?.description
              )}
            </p>
          </div>
          <ExchangeSelector
            activeExchange={activeExchange}
            onExchangeChange={setActiveExchange}
          />
        </div>

        {/* MEGA WHALE FEED - $4M+ Trades Across All Exchanges */}
        <MegaWhaleFeed
          trades={megaWhaleTrades}
          isConnected={whaleWsConnected}
          connectionStatus={whaleConnectionStatus}
        />

        {/* Show Coming Soon for non-active exchanges */}
        {EXCHANGES[activeExchange]?.status !== 'active' ? (
          <ExchangeComingSoon exchange={EXCHANGES[activeExchange]} />
        ) : (
          <>
            {/* COMPOSITE BIAS CARDS - Always Visible for active exchanges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {['BTC', 'ETH', 'SOL'].map(coin => (
                <BiasCard
                  key={coin}
                  coin={coin}
                  biasData={biasScores[coin]}
                  priceData={priceData[coin]}
                  oiData={oiData[coin]}
                  orderbookData={orderbookData[coin]}
                  cvdData={cvdData[coin]}
                  fundingData={fundingData[coin]}
                  onExpand={setExpandedCoin}
                />
              ))}
            </div>

            {/* Navigation Tabs with Timeframe Toggle */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'dashboard', label: '📊 Dashboard', feature: 'market' },
                  { id: 'liquidations', label: '💀 Liquidations', feature: 'liquidations' },
                  { id: 'whales', label: '🐋 Leaderboard', feature: 'leaderboard' },
                ].filter(tab => EXCHANGES[activeExchange]?.features.includes(tab.feature)).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === tab.id
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Timeframe Toggle - Only show on Dashboard tab */}
              {activeTab === 'dashboard' && (
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                  <span className="text-xs text-slate-500 px-2">Timeframe:</span>
                  {['1h', '4h', '8h'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setDashboardTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${dashboardTimeframe === tf
                        ? 'bg-cyan-500 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <FlowConfluenceSection oiData={timeframeOiData} cvdData={cvdData} priceData={timeframePriceData} timeframe={dashboardTimeframe} hasEnoughData={hasEnoughHistoricalData} />
                <OrderbookSection orderbookData={timeframeOrderbookData} timeframe={dashboardTimeframe} hasEnoughData={hasEnoughHistoricalData} />
                {EXCHANGES[activeExchange]?.features.includes('whales') && (
                  <>
                    <WhaleActivityFeed consensus={consensus} positionChanges={positionChanges} whaleTrades={whaleTrades} />
                    <ConsensusSection consensus={consensus} />
                  </>
                )}
                <FundingRatesSection fundingData={fundingData} />
              </div>
            )}

            {/* LIQUIDATIONS TAB */}
            {activeTab === 'liquidations' && (
              <div className="space-y-6">
                <LiquidationMap positions={allPositions} priceData={priceData} />

                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-bold text-slate-400 mb-4">📋 ALL WHALE POSITIONS</h3>
                  {allPositions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">Loading whale positions...</div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                      {allPositions.sort((a, b) => b.notional - a.notional).slice(0, 15).map((pos, i) => (
                        <PositionCard key={i} position={pos} marketData={priceData} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WHALES TAB */}
            {activeTab === 'whales' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-yellow-500/10 to-transparent">
                      <h2 className="font-bold flex items-center gap-2">
                        🏆 Top Weekly Performers
                        <span className="text-xs font-normal text-slate-500">Updates every 5 min</span>
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="py-2 px-3 text-left text-slate-400">#</th>
                            <th className="py-2 px-3 text-left text-slate-400">Trader</th>
                            <th className="py-2 px-3 text-right text-slate-400">Account</th>
                            <th className="py-2 px-3 text-right text-slate-400">Week PNL</th>
                            <th className="py-2 px-3 text-right text-slate-400">Week %</th>
                            <th className="py-2 px-3 text-right text-slate-400">Month %</th>
                            <th className="py-2 px-3 text-right text-slate-400">All-Time %</th>
                            <th className="py-2 px-3 text-center text-slate-400">Pos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {traders.slice(0, 20).map((trader, i) => (
                            <TraderRow
                              key={trader.address}
                              trader={trader}
                              rank={i + 1}
                              isSelected={selectedTrader?.address === trader.address}
                              onClick={() => setSelectedTrader(trader)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 sticky top-4">
                    <h3 className="font-bold mb-4">📊 Trader Positions</h3>
                    {!selectedTrader ? (
                      <div className="text-center py-8 text-slate-500">Click a trader to view positions</div>
                    ) : (
                      <div>
                        <div className="mb-4 pb-4 border-b border-slate-800">
                          <a href={getProfileUrl(selectedTrader.address)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-mono text-sm">
                            {formatAddress(selectedTrader.address)} ↗
                          </a>
                          <div className="text-slate-400 text-sm mt-1">Account: {formatUSD(selectedTrader.accountValue)}</div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded ${selectedTrader.weekRoi >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              Week: {formatPercent(selectedTrader.weekRoi)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${selectedTrader.monthRoi >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              Month: {formatPercent(selectedTrader.monthRoi)}
                            </span>
                          </div>
                        </div>
                        {traderPositions.length === 0 ? (
                          <div className="text-center py-6 text-slate-500">No open positions</div>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto">
                            {traderPositions.map((pos, i) => (
                              <PositionCard key={i} position={pos} marketData={priceData} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 text-center text-slate-600 text-sm">
              <p>Data from Hyperliquid API • Session resets on page reload • Not financial advice</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
