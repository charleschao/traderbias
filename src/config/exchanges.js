// API endpoints
export const LEADERBOARD_API = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard';
export const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// ============== EXCHANGE CONFIGURATION ==============
export const EXCHANGES = {
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

export const EXCHANGE_LIST = Object.values(EXCHANGES);
export const DEFAULT_EXCHANGE = 'hyperliquid';
