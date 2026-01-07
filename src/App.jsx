import React, { useState, useEffect, useRef, useCallback } from 'react';

// Config imports
import { EXCHANGES, LEADERBOARD_API, HYPERLIQUID_API } from './config/exchanges';

// Component imports
import BiasCard from './components/BiasCard';
import ConsensusSection from './components/ConsensusSection';
import DetailModal from './components/DetailModal';
import ExchangeComingSoon from './components/ExchangeComingSoon';
import ExchangeSelector from './components/ExchangeSelector';
import FlowConfluenceSection from './components/FlowConfluenceSection';
import FundingRatesSection from './components/FundingRatesSection';
import LiquidationMap from './components/LiquidationMap';
import MegaWhaleFeed from './components/MegaWhaleFeed';
import OrderbookSection from './components/OrderbookSection';
import PositionCard from './components/PositionCard';
import PlatformImprovementsPanel from './components/PlatformImprovementsPanel';
import TraderRow from './components/TraderRow';
import WhaleActivityFeed from './components/WhaleActivityFeed';

// Hook imports
import { useWhaleWebSockets } from './hooks/useWhaleWebSockets';
import { useWhaleNotifications } from './hooks/useWhaleNotifications';
import { useSparklineHistory } from './hooks/useSparklineHistory';
import { useSignalHistory } from './hooks/useSignalHistory';

// Agent imports
import { platformAgent } from './agents/PlatformImprovementAgent';

// Utility imports
import { calculateCompositeBias } from './utils/biasCalculations';
import { formatUSD, formatPercent, formatAddress, getProfileUrl } from './utils/formatters';

// Backend API imports
import { isBackendEnabled, getExchangeData, getAllExchangesData } from './services/backendApi';

// ============== LOCAL STORAGE HELPERS ==============
const HISTORICAL_DATA_KEY = 'traderBias_historicalData';
const BIAS_HISTORY_KEY = 'traderBias_biasHistory';
const MAX_HISTORY_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours - ensures robust historical data for all timeframes
const MAX_BIAS_HISTORY_AGE_MS = 15 * 60 * 1000; // 15 minutes

const getEmptyExchangeData = () => ({
  oi: { BTC: [], ETH: [], SOL: [] },
  price: { BTC: [], ETH: [], SOL: [] },
  orderbook: { BTC: [], ETH: [], SOL: [] },
  cvd: { BTC: [], ETH: [], SOL: [] }
});

const loadHistoricalData = (exchange = 'hyperliquid') => {
  try {
    const saved = localStorage.getItem(HISTORICAL_DATA_KEY);
    if (saved) {
      const allData = JSON.parse(saved);

      // If old format (no exchange keys), migrate to new format
      if (allData.oi && !allData.hyperliquid) {
        const migratedData = {
          hyperliquid: { ...allData },
          binance: getEmptyExchangeData(),
          bybit: getEmptyExchangeData(),
          nado: getEmptyExchangeData(),
          asterdex: getEmptyExchangeData()
        };
        localStorage.setItem(HISTORICAL_DATA_KEY, JSON.stringify(migratedData));
        return migratedData[exchange] || getEmptyExchangeData();
      }

      // New format - per exchange
      const exchangeData = allData[exchange] || getEmptyExchangeData();
      const now = Date.now();

      // Clean up old entries on load
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (exchangeData.oi?.[coin]) {
          exchangeData.oi[coin] = exchangeData.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (exchangeData.price?.[coin]) {
          exchangeData.price[coin] = exchangeData.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (exchangeData.orderbook?.[coin]) {
          exchangeData.orderbook[coin] = exchangeData.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (exchangeData.cvd?.[coin]) {
          exchangeData.cvd[coin] = exchangeData.cvd[coin].filter(e => now - e.time < MAX_HISTORY_AGE_MS);
        }
      });

      // Ensure cvd structure exists
      if (!exchangeData.cvd) {
        exchangeData.cvd = { BTC: [], ETH: [], SOL: [] };
      }

      return exchangeData;
    }
  } catch (e) {
    console.warn('Failed to load historical data:', e);
  }
  return getEmptyExchangeData();
};

const saveHistoricalData = (exchange, exchangeData) => {
  try {
    const saved = localStorage.getItem(HISTORICAL_DATA_KEY);
    let allData = {};

    if (saved) {
      try {
        allData = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse existing data, creating new:', e);
      }
    }

    // Ensure all exchanges exist
    if (!allData.hyperliquid) allData.hyperliquid = getEmptyExchangeData();
    if (!allData.binance) allData.binance = getEmptyExchangeData();
    if (!allData.bybit) allData.bybit = getEmptyExchangeData();
    if (!allData.nado) allData.nado = getEmptyExchangeData();
    if (!allData.asterdex) allData.asterdex = getEmptyExchangeData();

    // Update specific exchange data
    allData[exchange] = exchangeData;

    localStorage.setItem(HISTORICAL_DATA_KEY, JSON.stringify(allData));
  } catch (e) {
    console.warn('Failed to save historical data:', e);
  }
};

// Bias history localStorage helpers
const loadBiasHistory = () => {
  try {
    const saved = localStorage.getItem(BIAS_HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      // Clean up entries older than 15 minutes
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (parsed[coin]) {
          parsed[coin] = parsed[coin].filter(e => now - e.timestamp < MAX_BIAS_HISTORY_AGE_MS);
        } else {
          parsed[coin] = [];
        }
      });
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load bias history:', e);
  }
  return { BTC: [], ETH: [], SOL: [] };
};

const saveBiasHistory = (data) => {
  try {
    localStorage.setItem(BIAS_HISTORY_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save bias history:', e);
  }
};

// ============== TIMEFRAME HELPERS ==============
const timeframeToMinutes = (tf) => {
  const map = { '5m': 5, '15m': 15, '30m': 30, '1h': 60 };
  return map[tf] || 5;
};

const calculateTimeframeChange = (currentValue, history, minutes) => {
  if (!currentValue || !history || history.length === 0) return null;
  const targetTime = Date.now() - (minutes * 60 * 1000);
  // Filter out null entries and entries with invalid timestamps
  const relevantEntries = history.filter(e => e && e.timestamp >= targetTime && e.value != null);
  if (relevantEntries.length === 0) return null;
  const oldestEntry = relevantEntries.reduce((oldest, e) =>
    e.timestamp < oldest.timestamp ? e : oldest, relevantEntries[0]);
  if (!oldestEntry?.value || oldestEntry.value === 0) return null;
  return ((currentValue - oldestEntry.value) / oldestEntry.value) * 100;
};

const getAverageImbalance = (history, minutes) => {
  if (!history || history.length === 0) return 0;
  const targetTime = Date.now() - (minutes * 60 * 1000);
  const relevantEntries = history.filter(e => e && e.timestamp >= targetTime);
  if (relevantEntries.length === 0) return 0;
  const sum = relevantEntries.reduce((acc, e) => acc + (e.imbalance || 0), 0);
  return sum / relevantEntries.length;
};

// ============== MAIN APP COMPONENT ==============
export default function App() {
  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeExchange, setActiveExchange] = useState('hyperliquid');
  const [dashboardTimeframe, setDashboardTimeframe] = useState('5m');
  const [expandedCoin, setExpandedCoin] = useState(null);

  // Market data state
  const [priceData, setPriceData] = useState({});
  const [oiData, setOiData] = useState({});
  const [fundingData, setFundingData] = useState({});
  const [orderbookData, setOrderbookData] = useState({});
  const [cvdData, setCvdData] = useState({});

  // Trader/Whale state
  const [traders, setTraders] = useState([]);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [traderPositions, setTraderPositions] = useState([]);
  const [consensus, setConsensus] = useState({});
  const [allPositions, setAllPositions] = useState([]);
  const [positionChanges, setPositionChanges] = useState([]);
  const [whaleTrades, setWhaleTrades] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Threshold state for whale alerts
  const [whaleThreshold, setWhaleThreshold] = useState(10_000_000);

  // Research agent state
  const [agentReport, setAgentReport] = useState(null);

  // Refs
  const sessionStartRef = useRef({ time: new Date(), price: {}, oi: {} });
  const orderbookHistoryRef = useRef({});
  const prevPositionsRef = useRef({});
  const isFirstLoadRef = useRef(true);
  const historicalDataRef = useRef(loadHistoricalData());
  const prevTradeCountRef = useRef(0);
  const allExchangeDataRef = useRef({}); // Cache for all exchange data (preloaded)

  // Initialize CVD accumulator with history from localStorage
  const cvdAccumulatorRef = useRef({
    BTC: { sessionDelta: 0, lastDelta: 0, totalBuy: 0, totalSell: 0, history: historicalDataRef.current.cvd?.BTC || [] },
    ETH: { sessionDelta: 0, lastDelta: 0, totalBuy: 0, totalSell: 0, history: historicalDataRef.current.cvd?.ETH || [] },
    SOL: { sessionDelta: 0, lastDelta: 0, totalBuy: 0, totalSell: 0, history: historicalDataRef.current.cvd?.SOL || [] }
  });

  // Bias history state (15 entries, one per minute) - load from localStorage
  const [biasHistory, setBiasHistory] = useState(() => loadBiasHistory());

  // Custom hooks
  const { trades: megaWhaleTrades, connectionStatus: whaleConnectionStatus, isConnected: whaleWsConnected } = useWhaleWebSockets();
  const { notificationEnabled, notificationPermission, notificationSupported, toggleNotifications, notifyWhaleTrade } = useWhaleNotifications(whaleThreshold);
  const { updateFromMarketData, getSparklineData } = useSparklineHistory();
  const { signalHistory, logSignal, evaluateSignals, getWinRates } = useSignalHistory();

  // Threshold change handler
  const handleThresholdChange = useCallback((newThreshold) => {
    setWhaleThreshold(newThreshold);
  }, []);

  // ============== DATA FETCHING ==============

  // Process and transform backend data to frontend format
  const processBackendData = (data) => {
    if (!data) {
      console.log('[Backend] No data to process');
      setLoading(false);
      return;
    }

    // Set historical data (use empty arrays for missing data)
    historicalDataRef.current = {
      oi: data.oi || { BTC: [], ETH: [], SOL: [] },
      price: data.price || { BTC: [], ETH: [], SOL: [] },
      orderbook: data.orderbook || { BTC: [], ETH: [], SOL: [] },
      cvd: data.cvd || { BTC: [], ETH: [], SOL: [] }
    };

    // Update CVD accumulator
    ['BTC', 'ETH', 'SOL'].forEach(coin => {
      if (cvdAccumulatorRef.current[coin]) {
        cvdAccumulatorRef.current[coin].history = data.cvd?.[coin] || [];
      }
    });

    // Check if we have any current data to process
    if (!data.current) {
      console.log('[Backend] Exchange has no current data yet (still collecting)');
      setLoading(false);
      return;
    }

    // Set current state from backend data - transform to match frontend expected format
    if (data.current) {
      const coins = ['BTC', 'ETH', 'SOL'];

      // Transform price data
      const transformedPrice = {};
      coins.forEach(coin => {
        const price = data.current.price?.[coin];
        if (price) {
          if (!sessionStartRef.current.price[coin]) {
            sessionStartRef.current.price[coin] = price;
          }
          const sessionChange = sessionStartRef.current.price[coin] > 0
            ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;
          transformedPrice[coin] = {
            markPx: price,
            sessionStart: sessionStartRef.current.price[coin],
            sessionChange
          };
        }
      });
      setPriceData(transformedPrice);

      // Transform OI data
      const transformedOi = {};
      coins.forEach(coin => {
        const oiValue = data.current.oi?.[coin];
        if (oiValue) {
          if (!sessionStartRef.current.oi[coin]) {
            sessionStartRef.current.oi[coin] = oiValue;
          }
          const sessionChange = sessionStartRef.current.oi[coin] > 0
            ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
            : 0;
          transformedOi[coin] = {
            current: oiValue,
            sessionChange,
            volume: 0
          };
        }
      });
      setOiData(transformedOi);

      // Transform funding data
      const transformedFunding = {};
      coins.forEach(coin => {
        const rate = data.current.funding?.[coin];
        if (rate !== undefined) {
          transformedFunding[coin] = {
            rate,
            trend: 0,
            annualized: rate * 3 * 365 * 100
          };
        }
      });
      setFundingData(transformedFunding);

      // Transform orderbook data
      const transformedOrderbook = {};
      coins.forEach(coin => {
        const obData = data.current.orderbook?.[coin];
        // Handle both old format (number) and new format (object)
        if (obData !== undefined && obData !== null) {
          const imbalance = typeof obData === 'object' ? obData.imbalance : obData;
          const bidVolume = typeof obData === 'object' ? obData.bidDepth : 0;
          const askVolume = typeof obData === 'object' ? obData.askDepth : 0;
          transformedOrderbook[coin] = {
            bidVolume,
            askVolume,
            imbalance,
            avgImbalance: imbalance
          };
        }
      });
      setOrderbookData(transformedOrderbook);

      // Transform CVD data
      const transformedCvd = {};
      coins.forEach(coin => {
        const delta = data.current.cvd?.[coin];
        if (delta !== undefined) {
          transformedCvd[coin] = {
            recentDelta: delta,
            sessionDelta: delta,
            rolling5mDelta: delta,
            trend: 0,
            totalBuyVolume: 0,
            totalSellVolume: 0
          };
        }
      });
      setCvdData(transformedCvd);
    }

    setLoading(false);
  };

  // Load data from backend (if enabled)
  const loadDataFromBackend = async (exchange) => {
    try {
      console.log(`[Backend] Loading data for ${exchange}...`);
      const data = await getExchangeData(exchange);
      console.log('[Backend] Data received:', data);
      processBackendData(data);
      console.log('[Backend] Data loaded successfully');
    } catch (error) {
      console.error('[Backend] Failed to load data:', error);
      console.log('[Backend] Falling back to direct API calls');
      setLoading(false);
    }
  };

  const fetchMarketData = async () => {
    try {
      const res = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' })
      });
      const mids = await res.json();

      const newPriceData = {};
      const coins = ['BTC', 'ETH', 'SOL'];

      for (const coin of coins) {
        const mid = parseFloat(mids[coin] || 0);
        if (!sessionStartRef.current.price[coin]) {
          sessionStartRef.current.price[coin] = mid;
        }
        const sessionChange = sessionStartRef.current.price[coin] > 0
          ? ((mid - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
          : 0;

        newPriceData[coin] = {
          markPx: mid,
          sessionStart: sessionStartRef.current.price[coin],
          sessionChange
        };
      }

      setPriceData(newPriceData);

      // Fetch meta for OI and funding
      const metaRes = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
      });
      const [meta, assetCtxs] = await metaRes.json();

      const newOiData = {};
      const newFundingData = {};

      for (const coin of coins) {
        const idx = meta.universe.findIndex(u => u.name === coin);
        if (idx !== -1 && assetCtxs[idx]) {
          const ctx = assetCtxs[idx];
          const oiValue = parseFloat(ctx.openInterest || 0) * parseFloat(mids[coin] || 0);

          if (!sessionStartRef.current.oi[coin]) {
            sessionStartRef.current.oi[coin] = oiValue;
          }
          const oiSessionChange = sessionStartRef.current.oi[coin] > 0
            ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
            : 0;

          newOiData[coin] = {
            current: oiValue,
            sessionChange: oiSessionChange,
            volume: parseFloat(ctx.dayNtlVlm || 0)
          };

          const rate = parseFloat(ctx.funding || 0);
          newFundingData[coin] = {
            rate,
            trend: 0,
            annualized: rate * 3 * 365 * 100
          };
        }
      }

      setOiData(newOiData);
      setFundingData(newFundingData);

      // Store historical data
      const now = Date.now();
      coins.forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      // Ensure cvd key exists before saving (preserve CVD data from fetchCVD)
      if (!historicalDataRef.current.cvd) {
        historicalDataRef.current.cvd = { BTC: [], ETH: [], SOL: [] };
      }
      saveHistoricalData('hyperliquid', historicalDataRef.current);

    } catch (err) {
      console.error('Error fetching market data:', err);
    }
  };

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
        const book = await res.json();

        let bidVol = 0, askVol = 0;
        (book.levels?.[0] || []).forEach(level => bidVol += parseFloat(level.px) * parseFloat(level.sz));
        (book.levels?.[1] || []).forEach(level => askVol += parseFloat(level.px) * parseFloat(level.sz));

        const totalVol = bidVol + askVol;
        const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

        if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
        orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
        const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

        newOrderbookData[coin] = { bidVolume: bidVol, askVolume: askVol, imbalance, avgImbalance };

        // Store for historical
        const now = Date.now();
        historicalDataRef.current.orderbook[coin].push({ timestamp: now, imbalance });
        historicalDataRef.current.orderbook[coin] = historicalDataRef.current.orderbook[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
      }

      setOrderbookData(newOrderbookData);
      saveHistoricalData('hyperliquid', historicalDataRef.current);
    } catch (err) {
      console.error('Error fetching orderbooks:', err);
    }
  };

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
        const acc = cvdAccumulatorRef.current[coin];

        if (!acc.history) acc.history = [];
        acc.sessionDelta += recentDelta;
        acc.totalBuy += recentBuyVol;
        acc.totalSell += recentSellVol;

        const now = Date.now();
        acc.history.push({ delta: recentDelta, time: now });
        acc.history = acc.history.filter(item => now - item.time < MAX_HISTORY_AGE_MS); // Keep 1 hour of history

        // Calculate rolling 5m delta (sum only last 5 minutes of history, not all history)
        const fiveMinAgo = now - (5 * 60 * 1000);
        const recent5mHistory = acc.history.filter(item => item.time >= fiveMinAgo);
        const rolling5mDelta = recent5mHistory.reduce((sum, item) => sum + item.delta, 0);
        const trend = recentDelta - acc.lastDelta;
        acc.lastDelta = recentDelta;

        newCvdData[coin] = { recentDelta, sessionDelta: acc.sessionDelta, rolling5mDelta, trend, totalBuyVolume: acc.totalBuy, totalSellVolume: acc.totalSell };
      }

      setCvdData(newCvdData);

      // Save CVD history to localStorage for persistence across page refreshes
      // Ensure cvd object exists in historicalDataRef (safety for hot reloads/edge cases)
      if (!historicalDataRef.current.cvd) {
        historicalDataRef.current.cvd = { BTC: [], ETH: [], SOL: [] };
      }
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (cvdAccumulatorRef.current[coin]?.history) {
          historicalDataRef.current.cvd[coin] = cvdAccumulatorRef.current[coin].history;
        }
      });
      saveHistoricalData('hyperliquid', historicalDataRef.current);
    } catch (err) {
      console.error('Error fetching CVD:', err);
    }
  };

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

        (trades || []).forEach(trade => {
          const notional = parseFloat(trade.sz) * parseFloat(trade.px);
          if (notional >= 10000000) {
            newWhaleTrades.push({
              coin, side: trade.side === 'B' ? 'BUY' : 'SELL',
              size: parseFloat(trade.sz), price: parseFloat(trade.px),
              notional, time: new Date(trade.time), hash: trade.hash
            });
          }
        });
      }

      setWhaleTrades(prev => {
        const unique = [...newWhaleTrades, ...prev].filter((v, i, a) => a.findIndex(t => t.hash === v.hash) === i);
        return unique.slice(0, 50);
      });
    } catch (err) {
      console.error('Error fetching whale trades:', err);
    }
  };

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
                trader: trader.address, rank: i + 1, coin, direction, size, notional, entryPx, unrealizedPnl, leverage,
                isConsistent: trader.weekRoi > 0 && trader.monthRoi > 0 && trader.allTimeRoi > 0,
              };

              traderPositions.push(positionData);
              positions.push({ ...positionData });

              if (!coinData[coin]) coinData[coin] = { longs: [], shorts: [], totalNotional: 0 };
              coinData[coin][direction === 'long' ? 'longs' : 'shorts'].push(positionData);
              coinData[coin].totalNotional += notional;
            }
          }

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
          traderPositions.forEach(p => { newPrevPositions[trader.address][p.coin] = { size: p.size, notional: p.notional }; });
          trader.positionCount = posCount;
        } catch (err) {
          console.error(`Error fetching ${trader.address}:`, err);
        }
      }

      prevPositionsRef.current = newPrevPositions;
      setConsensus(coinData);
      setAllPositions(positions);
      if (allChanges.length > 0) setPositionChanges(prev => [...allChanges, ...prev].slice(0, 50));
      setTraders(topTraders);
      setLastUpdate(new Date());
      setLoading(false);
      if (isFirstLoadRef.current) isFirstLoadRef.current = false;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

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
            coin: pos.coin, size, direction: size > 0 ? 'LONG' : 'SHORT',
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

  // ============== BINANCE DATA FETCHING ==============
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

        if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
        orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
        const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

        newOrderbookData[coin] = { bidVolume: bidVol, askVolume: askVol, imbalance, avgImbalance };

        // 4. Open Interest
        const oiRes = await fetch(`/api/binance/fapi/v1/openInterest?symbol=${symbol}`);
        const oiInfo = await oiRes.json();
        const oiValue = parseFloat(oiInfo.openInterest) * price;

        if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
        if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
        const oiSessionChange = sessionStartRef.current.oi[coin] > 0
          ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
          : 0;

        newOiData[coin] = { current: oiValue, sessionChange: oiSessionChange, volume: parseFloat(ticker.quoteVolume) };
      }

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      // Store historical data
      const now = Date.now();
      coins.forEach(coin => {
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
      saveHistoricalData('binance', historicalDataRef.current);
    } catch (error) {
      console.error("Binance Fetch Error:", error);
    }
  };

  // ============== BYBIT DATA FETCHING ==============
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

        // 1. Ticker (Price, Volume, Funding)
        const tickerRes = await fetch(`/api/bybit/v5/market/tickers?category=linear&symbol=${symbol}`);
        if (!tickerRes.ok) continue;

        const tickerData = await tickerRes.json();
        if (tickerData.retCode !== 0) continue;

        const ticker = tickerData.result?.list?.[0];
        if (ticker) {
          const price = parseFloat(ticker.lastPrice);
          if (!sessionStartRef.current.price[coin]) sessionStartRef.current.price[coin] = price;
          const priceSessionChange = sessionStartRef.current.price[coin] > 0
            ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;

          newPriceData[coin] = { markPx: price, sessionStart: sessionStartRef.current.price[coin], sessionChange: priceSessionChange };

          const rate = parseFloat(ticker.fundingRate);
          newFundingData[coin] = { rate, trend: 0, annualized: rate * 3 * 365 * 100 };

          const oiValue = parseFloat(ticker.openInterest) * price;
          if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
          if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
          const oiSessionChange = sessionStartRef.current.oi[coin] > 0
            ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
            : 0;

          newOiData[coin] = { current: oiValue, sessionChange: oiSessionChange, volume: parseFloat(ticker.turnover24h) };
        }

        // 2. Orderbook
        const depthRes = await fetch(`/api/bybit/v5/market/orderbook?category=linear&symbol=${symbol}&limit=10`);
        const depthData = await depthRes.json();
        const depth = depthData.result;

        if (depth) {
          let bidVol = 0, askVol = 0;
          depth.b.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
          depth.a.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

          const totalVol = bidVol + askVol;
          const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

          if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
          orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
          const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

          newOrderbookData[coin] = { bidVolume: bidVol, askVolume: askVol, imbalance, avgImbalance };
        }
      }

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      const now = Date.now();
      coins.forEach(coin => {
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
      saveHistoricalData('bybit', historicalDataRef.current);
    } catch (error) {
      console.error("Bybit Fetch Error:", error);
    }
  };

  // ============== NADO DATA FETCHING ==============
  const fetchNadoData = async () => {
    if (activeExchange !== 'nado') return;

    const NADO_ARCHIVE = 'https://archive.prod.nado.xyz/v1';
    const productMap = { 'BTC': 2, 'ETH': 4, 'SOL': 8 };
    const coins = ['BTC', 'ETH', 'SOL'];

    const newPriceData = {};
    const newFundingData = {};
    const newOiData = {};

    try {
      // 1. Fetch Perp Prices
      const priceRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perp_prices: { product_ids: Object.values(productMap) } })
      });
      const priceDataRaw = await priceRes.json();

      // 2. Fetch Funding Rates
      const fundingRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funding_rates: { product_ids: Object.values(productMap) } })
      });
      const fundingRatesData = await fundingRes.json();

      // 3. Fetch Market Snapshots
      const snapshotRes = await fetch(NADO_ARCHIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_snapshots: { interval: { count: 1, granularity: 3600 }, product_ids: Object.values(productMap) } })
      });
      const snapshotData = await snapshotRes.json();

      for (const coin of coins) {
        const productId = productMap[coin];

        const coinPrice = priceDataRaw?.[productId];
        if (coinPrice) {
          const markPx = parseFloat(coinPrice.mark_price_x18) / 1e18;
          if (!sessionStartRef.current.price[coin]) sessionStartRef.current.price[coin] = markPx;
          const sessionChange = sessionStartRef.current.price[coin] > 0
            ? ((markPx - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
            : 0;

          newPriceData[coin] = { markPx, sessionStart: sessionStartRef.current.price[coin], sessionChange };

          if (!newOiData[coin]) {
            if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
            newOiData[coin] = { current: 0, sessionChange: 0, volume: 0 };
          }
        }

        const coinFunding = fundingRatesData?.[productId];
        if (coinFunding) {
          const rate = parseFloat(coinFunding.funding_rate_x18) / 1e18;
          newFundingData[coin] = { rate: rate / 24, trend: 0, annualized: rate * 365 * 100 };
        }
      }

      if (snapshotData?.snapshots) {
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
            newOiData[coin] = { current: oiValue, sessionChange: oiSessionChange, volume: parseFloat(snapshot.volume_24h_x18 || '0') / 1e18 };
          }
        }
      }

      if (Object.keys(newPriceData).length > 0) setPriceData(newPriceData);
      if (Object.keys(newFundingData).length > 0) setFundingData(newFundingData);
      if (Object.keys(newOiData).length > 0) setOiData(newOiData);

      const now = Date.now();
      coins.forEach(coin => {
        if (newOiData[coin]?.current) {
          historicalDataRef.current.oi[coin].push({ timestamp: now, value: newOiData[coin].current });
          historicalDataRef.current.oi[coin] = historicalDataRef.current.oi[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
        if (newPriceData[coin]?.markPx) {
          historicalDataRef.current.price[coin].push({ timestamp: now, value: parseFloat(newPriceData[coin].markPx) });
          historicalDataRef.current.price[coin] = historicalDataRef.current.price[coin].filter(e => now - e.timestamp < MAX_HISTORY_AGE_MS);
        }
      });
      saveHistoricalData('nado', historicalDataRef.current);
    } catch (error) {
      console.error('Nado Fetch Error:', error);
    }
  };

  // ============== ASTERDEX DATA FETCHING ==============
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

        const tickerRes = await fetch(`${ASTER_API}/fapi/v1/ticker/24hr?symbol=${symbol}`);
        const ticker = await tickerRes.json();

        const fundingRes = await fetch(`${ASTER_API}/fapi/v1/premiumIndex?symbol=${symbol}`);
        const fundingInfo = await fundingRes.json();

        const oiRes = await fetch(`${ASTER_API}/fapi/v1/openInterest?symbol=${symbol}`);
        const oiInfo = await oiRes.json();

        const depthRes = await fetch(`${ASTER_API}/fapi/v1/depth?symbol=${symbol}&limit=10`);
        const depth = await depthRes.json();

        const price = parseFloat(ticker.lastPrice);
        if (!sessionStartRef.current.price[coin]) sessionStartRef.current.price[coin] = price;
        const priceSessionChange = sessionStartRef.current.price[coin] > 0
          ? ((price - sessionStartRef.current.price[coin]) / sessionStartRef.current.price[coin]) * 100
          : 0;

        newPriceData[coin] = { markPx: parseFloat(fundingInfo.markPrice), sessionStart: sessionStartRef.current.price[coin], sessionChange: priceSessionChange };

        const rate = parseFloat(fundingInfo.lastFundingRate);
        newFundingData[coin] = { rate, trend: 0, annualized: rate * 3 * 365 * 100 };

        const oiValue = parseFloat(oiInfo.openInterest) * price;
        if (!sessionStartRef.current.oi) sessionStartRef.current.oi = {};
        if (!sessionStartRef.current.oi[coin]) sessionStartRef.current.oi[coin] = oiValue;
        const oiSessionChange = sessionStartRef.current.oi[coin] > 0
          ? ((oiValue - sessionStartRef.current.oi[coin]) / sessionStartRef.current.oi[coin]) * 100
          : 0;

        newOiData[coin] = { current: oiValue, sessionChange: oiSessionChange, volume: parseFloat(ticker.quoteVolume) };

        if (depth.bids && depth.asks) {
          let bidVol = 0, askVol = 0;
          depth.bids.forEach(level => bidVol += parseFloat(level[0]) * parseFloat(level[1]));
          depth.asks.forEach(level => askVol += parseFloat(level[0]) * parseFloat(level[1]));

          const totalVol = bidVol + askVol;
          const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

          if (!orderbookHistoryRef.current[coin]) orderbookHistoryRef.current[coin] = [];
          orderbookHistoryRef.current[coin] = [...orderbookHistoryRef.current[coin].slice(-9), imbalance];
          const avgImbalance = orderbookHistoryRef.current[coin].reduce((a, b) => a + b, 0) / orderbookHistoryRef.current[coin].length;

          newOrderbookData[coin] = { bidVolume: bidVol, askVolume: askVol, imbalance, avgImbalance };
        }
      }

      setPriceData(newPriceData);
      setFundingData(newFundingData);
      setOrderbookData(newOrderbookData);
      setOiData(newOiData);

      const now = Date.now();
      coins.forEach(coin => {
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
      // Ensure cvd key exists before saving (preserve CVD data from fetchCVD)
      if (!historicalDataRef.current.cvd) {
        historicalDataRef.current.cvd = { BTC: [], ETH: [], SOL: [] };
      }
      saveHistoricalData('asterdex', historicalDataRef.current);
    } catch (error) {
      console.error('AsterDex Fetch Error:', error);
    }
  };

  // ============== EFFECTS ==============

  useEffect(() => {
    // Check if backend is enabled
    const backendEnabled = isBackendEnabled();

    if (backendEnabled) {
      console.log('[App] Backend mode enabled, loading data from backend...');

      // Check if we have cached data for this exchange (from preload)
      const cachedData = allExchangeDataRef.current[activeExchange];

      if (cachedData) {
        // Use cached data instantly
        console.log(`[Backend] Using cached data for ${activeExchange}`);
        processBackendData(cachedData);
      } else if (Object.keys(allExchangeDataRef.current).length === 0) {
        // First load - preload ALL exchange data for instant tab switching
        const preloadAllExchanges = async () => {
          try {
            console.log('[Backend] Preloading all exchange data...');
            const allData = await getAllExchangesData();
            allExchangeDataRef.current = allData;
            console.log('[Backend] All exchange data preloaded:', Object.keys(allData));

            // Load the active exchange data immediately
            if (allData[activeExchange]) {
              processBackendData(allData[activeExchange]);
            }
          } catch (error) {
            console.error('[Backend] Failed to preload all exchanges, falling back to single exchange:', error);
            loadDataFromBackend(activeExchange);
          }
        };

        preloadAllExchanges();
      } else {
        // Cache exists but no data for this exchange - fetch individually
        console.log(`[Backend] No cached data for ${activeExchange}, fetching...`);
        loadDataFromBackend(activeExchange);
      }

      // Set up interval to refresh current exchange from backend every 30 seconds
      const backendRefreshInterval = setInterval(() => {
        loadDataFromBackend(activeExchange);
      }, 30000);

      // Still fetch leaderboard data if Hyperliquid (backend doesn't provide this yet)
      if (activeExchange === 'hyperliquid') {
        fetchLeaderboard();
        const leaderboardInterval = setInterval(fetchLeaderboard, 30000);

        return () => {
          clearInterval(backendRefreshInterval);
          clearInterval(leaderboardInterval);
        };
      }

      return () => {
        clearInterval(backendRefreshInterval);
      };
    } else {
      // Original client-side data fetching
      console.log('[App] Client-side mode, loading from localStorage...');

      // Load persisted data for the active exchange
      const loadedData = loadHistoricalData(activeExchange);
      historicalDataRef.current = loadedData;

      // Update CVD accumulator with loaded data
      ['BTC', 'ETH', 'SOL'].forEach(coin => {
        if (cvdAccumulatorRef.current[coin]) {
          cvdAccumulatorRef.current[coin].history = loadedData.cvd?.[coin] || [];
        }
      });

      if (activeExchange === 'hyperliquid') {
        fetchLeaderboard();
        fetchMarketData();
        fetchOrderbooks();
        fetchCVD();
        fetchWhaleTrades();

        const leaderboardInterval = setInterval(fetchLeaderboard, 30000);
        const marketDataInterval = setInterval(fetchMarketData, 60000);
        const orderbookInterval = setInterval(fetchOrderbooks, 30000);
        const cvdInterval = setInterval(fetchCVD, 30000);
        const whaleTradesInterval = setInterval(fetchWhaleTrades, 15000);

        return () => {
          clearInterval(leaderboardInterval);
          clearInterval(marketDataInterval);
          clearInterval(orderbookInterval);
          clearInterval(cvdInterval);
          clearInterval(whaleTradesInterval);
        };
      } else {
        // For other exchanges, keep existing data while loading (don't clear)
        // This allows immediate display of persisted data
        setConsensus({});
        setWhaleTrades([]);
        setPositionChanges([]);
        setTraderPositions([]);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExchange]);

  // Effect for Alternate Exchanges (Binance/Bybit/Nado/AsterDex)
  // Only runs when backend is NOT enabled
  useEffect(() => {
    // Skip if backend is enabled (backend handles all exchanges)
    if (isBackendEnabled()) return;
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

  useEffect(() => {
    if (selectedTrader) fetchTraderPositions(selectedTrader.address);
  }, [selectedTrader]);

  // Update sparkline history when market data changes
  useEffect(() => {
    updateFromMarketData(priceData, oiData, cvdData, fundingData);
  }, [priceData, oiData, cvdData, fundingData, updateFromMarketData]);

  // Notify on new whale trades
  useEffect(() => {
    if (megaWhaleTrades.length > prevTradeCountRef.current) {
      const newTradeCount = megaWhaleTrades.length - prevTradeCountRef.current;
      const newTrades = megaWhaleTrades.slice(0, newTradeCount);
      newTrades.forEach(trade => {
        notifyWhaleTrade(trade);
      });
    }
    prevTradeCountRef.current = megaWhaleTrades.length;
  }, [megaWhaleTrades, notifyWhaleTrade]);

  // ============== COMPUTED VALUES ==============

  // Calculate SESSION-BASED bias scores for useEffect hooks (signal logging, bias history)
  // These use session data because we want to track overall bias changes, not timeframe-specific
  const sessionAllData = { oiData, priceData, fundingData, orderbookData, cvdData, consensus };
  const sessionBiasScores = {
    BTC: calculateCompositeBias('BTC', sessionAllData),
    ETH: calculateCompositeBias('ETH', sessionAllData),
    SOL: calculateCompositeBias('SOL', sessionAllData)
  };

  // Track bias history every 60 seconds (15 entries = 15 minutes) + save to localStorage
  useEffect(() => {
    // Add immediate entry if we have valid bias scores
    const addBiasEntry = () => {
      setBiasHistory(prev => {
        const now = Date.now();
        const newHistory = { ...prev };
        ['BTC', 'ETH', 'SOL'].forEach(coin => {
          const score = sessionBiasScores[coin]?.normalizedScore || 0;
          // Only add if we have a valid score and either no entries or last entry is older than 30s
          const lastEntry = prev[coin]?.[prev[coin].length - 1];
          if (score !== 0 && (!lastEntry || now - lastEntry.timestamp > 30000)) {
            newHistory[coin] = [
              ...prev[coin].slice(-14), // Keep last 14
              { score, timestamp: now }
            ];
          }
        });
        // Save to localStorage
        saveBiasHistory(newHistory);
        return newHistory;
      });
    };

    // Add first entry immediately if data is ready
    if (sessionBiasScores.BTC?.normalizedScore !== undefined) {
      addBiasEntry();
    }

    // Then update every 60 seconds
    const interval = setInterval(addBiasEntry, 60000);

    return () => clearInterval(interval);
  }, [sessionBiasScores.BTC?.normalizedScore, sessionBiasScores.ETH?.normalizedScore, sessionBiasScores.SOL?.normalizedScore]);

  // Log signals when flow confluence type changes
  const prevFlowRef = useRef({ BTC: null, ETH: null, SOL: null });
  useEffect(() => {
    ['BTC', 'ETH', 'SOL'].forEach(coin => {
      const currentPrice = parseFloat(priceData[coin]?.markPx) || 0;
      const flowType = sessionBiasScores[coin]?.components?.flowConfluence?.confluenceType;

      if (flowType && currentPrice > 0 && flowType !== prevFlowRef.current[coin]) {
        logSignal(coin, flowType, currentPrice);
        prevFlowRef.current[coin] = flowType;
      }
    });
  }, [sessionBiasScores, priceData, logSignal]);

  // Ref to track latest prices without resetting the evaluation interval
  const latestPriceRef = useRef(priceData);
  useEffect(() => {
    latestPriceRef.current = priceData;
  }, [priceData]);

  // Evaluate signal outcomes every minute (use ref to avoid resetting interval on price updates)
  useEffect(() => {
    const evaluateInterval = setInterval(() => {
      const currentPrices = {
        BTC: parseFloat(latestPriceRef.current.BTC?.markPx) || 0,
        ETH: parseFloat(latestPriceRef.current.ETH?.markPx) || 0,
        SOL: parseFloat(latestPriceRef.current.SOL?.markPx) || 0
      };
      if (currentPrices.BTC > 0 || currentPrices.ETH > 0 || currentPrices.SOL > 0) {
        evaluateSignals(currentPrices);
      }
    }, 60000);

    // Also run immediately on mount to evaluate any pending signals
    const currentPrices = {
      BTC: parseFloat(latestPriceRef.current.BTC?.markPx) || 0,
      ETH: parseFloat(latestPriceRef.current.ETH?.markPx) || 0,
      SOL: parseFloat(latestPriceRef.current.SOL?.markPx) || 0
    };
    if (currentPrices.BTC > 0 || currentPrices.ETH > 0 || currentPrices.SOL > 0) {
      evaluateSignals(currentPrices);
    }

    return () => clearInterval(evaluateInterval);
  }, [evaluateSignals]);

  // Expose data to Platform Improvement Agent
  useEffect(() => {
    window.__TRADERBIAS_DATA__ = {
      priceData,
      oiData,
      fundingData,
      cvdData,
      orderbookData,
      whaleTrades: megaWhaleTrades,
      whalePositions: allPositions,
      connectionStatus: whaleConnectionStatus,
      timestamp: Date.now()
    };
  }, [priceData, oiData, fundingData, cvdData, orderbookData, megaWhaleTrades, allPositions, whaleConnectionStatus]);

  // Initialize Platform Improvement Agent (DEVELOPMENT ONLY)
  useEffect(() => {
    // Only run in development mode
    if (!import.meta.env.DEV) return;

    // Start the agent (runs analysis every 5 minutes)
    platformAgent.start(5);

    // Run initial analysis
    platformAgent.runFullAnalysis().then(report => {
      setAgentReport(report);
    });

    // Update report every 5 minutes
    const reportInterval = setInterval(async () => {
      const report = await platformAgent.runFullAnalysis();
      setAgentReport(report);
    }, 5 * 60 * 1000);

    return () => {
      platformAgent.stop();
      clearInterval(reportInterval);
    };
  }, []);

  const sessionDuration = Math.floor((new Date() - sessionStartRef.current.time) / 60000);
  const timeframeMinutes = timeframeToMinutes(dashboardTimeframe);

  const timeframeOiData = {}, timeframePriceData = {}, timeframeOrderbookData = {}, timeframeCvdData = {};
  const timeframeMs = timeframeMinutes * 60 * 1000;
  let hasEnoughHistoricalData = true;

  ['BTC', 'ETH', 'SOL'].forEach(coin => {
    const currentOi = oiData[coin]?.current || 0;
    const oiHistory = historicalDataRef.current.oi[coin] || [];
    const tfOiChange = calculateTimeframeChange(currentOi, oiHistory, timeframeMinutes);
    const oiHasData = tfOiChange !== null;
    if (!oiHasData) hasEnoughHistoricalData = false;

    timeframeOiData[coin] = {
      ...oiData[coin],
      timeframeChange: oiHasData ? tfOiChange : (oiData[coin]?.sessionChange || 0),
      sessionChange: oiData[coin]?.sessionChange || 0,
      hasTimeframeData: oiHasData
    };

    const currentPrice = parseFloat(priceData[coin]?.markPx) || 0;
    const priceHistory = historicalDataRef.current.price[coin] || [];
    const tfPriceChange = calculateTimeframeChange(currentPrice, priceHistory, timeframeMinutes);
    const priceHasData = tfPriceChange !== null;
    if (!priceHasData) hasEnoughHistoricalData = false;

    timeframePriceData[coin] = {
      ...priceData[coin],
      timeframeChange: priceHasData ? tfPriceChange : (priceData[coin]?.sessionChange || 0),
      sessionChange: priceData[coin]?.sessionChange || 0,
      hasTimeframeData: priceHasData
    };

    const obHistory = historicalDataRef.current.orderbook[coin] || [];
    const avgImbalance = obHistory.length > 0 ? getAverageImbalance(obHistory, timeframeMinutes) : (orderbookData[coin]?.avgImbalance || 0);

    timeframeOrderbookData[coin] = { ...orderbookData[coin], avgImbalance, timeframeAvgImbalance: avgImbalance };

    // Calculate timeframe-specific CVD delta
    const cvdAcc = cvdAccumulatorRef.current[coin];
    const now = Date.now();
    if (cvdAcc?.history) {
      const relevantCvdHistory = cvdAcc.history.filter(item => now - item.time < timeframeMs);
      const timeframeCvdDelta = relevantCvdHistory.reduce((sum, item) => sum + item.delta, 0);

      timeframeCvdData[coin] = {
        ...cvdData[coin],
        rolling5mDelta: timeframeCvdDelta, // Use timeframe-specific delta
        timeframeDelta: timeframeCvdDelta,
        hasTimeframeData: relevantCvdHistory.length > 0
      };
    } else {
      timeframeCvdData[coin] = cvdData[coin];
    }
  });

  // Calculate bias scores using TIMEFRAME-AWARE data
  const timeframeAllData = {
    oiData: timeframeOiData,
    priceData: timeframePriceData,
    fundingData, // Funding doesn't need timeframe adjustment
    orderbookData: timeframeOrderbookData,
    cvdData: timeframeCvdData,
    consensus
  };

  const biasScores = {
    BTC: calculateCompositeBias('BTC', timeframeAllData),
    ETH: calculateCompositeBias('ETH', timeframeAllData),
    SOL: calculateCompositeBias('SOL', timeframeAllData)
  };

  // ============== RENDER ==============

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Loading trader data...</p>
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
          priceData={timeframePriceData[expandedCoin]}
          oiData={timeframeOiData[expandedCoin]}
          orderbookData={timeframeOrderbookData[expandedCoin]}
          cvdData={timeframeCvdData[expandedCoin]}
          fundingData={fundingData[expandedCoin]}
          consensus={consensus}
          winRates={getWinRates(expandedCoin)}
          onClose={() => setExpandedCoin(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black mb-1">
              {EXCHANGES[activeExchange]?.icon} {EXCHANGES[activeExchange]?.name || 'TRADER BIAS'}
            </h1>
            <p className="text-slate-400 text-sm">
              {EXCHANGES[activeExchange]?.status === 'active' ? (
                <>Session: {sessionDuration}min{lastUpdate && <span className="ml-2">• Updated {lastUpdate.toLocaleTimeString()}</span>}</>
              ) : EXCHANGES[activeExchange]?.description}
            </p>
          </div>
          <ExchangeSelector activeExchange={activeExchange} onExchangeChange={setActiveExchange} />
        </div>

        {/* Mega Whale Feed */}
        <MegaWhaleFeed
          trades={megaWhaleTrades}
          isConnected={whaleWsConnected}
          connectionStatus={whaleConnectionStatus}
          threshold={whaleThreshold}
          onThresholdChange={handleThresholdChange}
          notificationEnabled={notificationEnabled}
          notificationPermission={notificationPermission}
          notificationSupported={notificationSupported}
          onNotificationToggle={toggleNotifications}
        />

        {/* Main Content */}
        {EXCHANGES[activeExchange]?.status !== 'active' ? (
          <ExchangeComingSoon exchange={EXCHANGES[activeExchange]} />
        ) : (
          <>
            {/* Bias Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {['BTC', 'ETH', 'SOL'].map(coin => (
                <BiasCard key={coin} coin={coin} biasData={biasScores[coin]} priceData={timeframePriceData[coin]}
                  oiData={timeframeOiData[coin]} orderbookData={timeframeOrderbookData[coin]} cvdData={timeframeCvdData[coin]}
                  fundingData={fundingData[coin]} onExpand={setExpandedCoin}
                  priceHistory={getSparklineData(coin, 'price')}
                  oiHistory={getSparklineData(coin, 'oi')}
                  cvdHistory={getSparklineData(coin, 'cvd')}
                  biasHistory={biasHistory[coin] || []}
                  timeframe={dashboardTimeframe}
                  timeframeMinutes={timeframeMinutes} />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'dashboard', label: '📊 Dashboard', feature: 'market' },
                  { id: 'liquidations', label: '💀 Liquidations', feature: 'liquidations' },
                  { id: 'whales', label: '🐋 Leaderboard', feature: 'leaderboard' },
                  // Platform Insights tab - DEVELOPMENT ONLY
                  ...(import.meta.env.DEV ? [{ id: 'improvements', label: '🔬 Platform Insights [DEV]', feature: 'market' }] : []),
                ].filter(tab => EXCHANGES[activeExchange]?.features.includes(tab.feature)).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}>
                    {tab.label}
                    {tab.id === 'improvements' && agentReport?.summary.critical > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                        {agentReport.summary.critical}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'dashboard' && (
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                  <span className="text-xs text-slate-400 px-2">Timeframe:</span>
                  {['5m', '15m', '30m', '1h'].map(tf => (
                    <button key={tf} onClick={() => setDashboardTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${dashboardTimeframe === tf ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <FlowConfluenceSection oiData={timeframeOiData} cvdData={timeframeCvdData} priceData={timeframePriceData} timeframe={dashboardTimeframe} hasEnoughData={hasEnoughHistoricalData} />
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

            {/* Liquidations */}
            {activeTab === 'liquidations' && (
              <div className="space-y-6">
                <LiquidationMap positions={allPositions} priceData={priceData} />
                <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-sm font-bold text-white mb-4">📋 ALL WHALE POSITIONS</h3>
                  {allPositions.length === 0 ? (
                    <div className="text-center py-8 text-slate-300">Loading whale positions...</div>
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

            {/* Leaderboard */}
            {activeTab === 'whales' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-yellow-500/10 to-transparent">
                      <h2 className="font-bold flex items-center gap-2">
                        🏆 Top Weekly Performers
                        <span className="text-xs font-normal text-slate-400">Updates every 5 min</span>
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800/50">
                          <tr>
                            <th className="py-2 px-3 text-left text-slate-300">#</th>
                            <th className="py-2 px-3 text-left text-slate-300">Trader</th>
                            <th className="py-2 px-3 text-right text-slate-300">Account</th>
                            <th className="py-2 px-3 text-right text-slate-300">Week PNL</th>
                            <th className="py-2 px-3 text-right text-slate-300">Week %</th>
                            <th className="py-2 px-3 text-right text-slate-300">Month %</th>
                            <th className="py-2 px-3 text-right text-slate-300">All-Time %</th>
                            <th className="py-2 px-3 text-center text-slate-300">Pos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {traders.slice(0, 20).map((trader, i) => (
                            <TraderRow key={trader.address} trader={trader} rank={i + 1}
                              isSelected={selectedTrader?.address === trader.address}
                              onClick={() => setSelectedTrader(trader)} />
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
                      <div className="text-center py-8 text-slate-300">Click a trader to view positions</div>
                    ) : (
                      <div>
                        <div className="mb-4 pb-4 border-b border-slate-800">
                          <a href={getProfileUrl(selectedTrader.address)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-mono text-sm">
                            {formatAddress(selectedTrader.address)} ↗
                          </a>
                          <div className="text-slate-300 text-sm mt-1">Account: {formatUSD(selectedTrader.accountValue)}</div>
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
                          <div className="text-center py-6 text-slate-300">No open positions</div>
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

            {/* Platform Improvements */}
            {activeTab === 'improvements' && (
              <div className="space-y-6">
                <PlatformImprovementsPanel agentReport={agentReport} />
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="text-center text-slate-400 text-xs space-y-2">
                <p className="text-slate-500">
                  ⚠️ <strong>Not Financial Advice</strong> • For informational purposes only •
                  Trading crypto carries significant risk • Do your own research
                </p>
                <p>
                  Data from third-party APIs (Hyperliquid, Binance, etc.) • May be delayed or inaccurate •
                  No guarantees provided
                </p>
                <p className="text-slate-500">
                  © 2026 Trader Bias • Licensed under CC BY-NC 4.0
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
