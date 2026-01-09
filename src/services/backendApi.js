/**
 * Backend API Service
 *
 * Optional service to fetch data from centralized backend instead of directly from exchanges
 * Enable by setting VITE_USE_BACKEND=true in .env
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

/**
 * Check if backend API is enabled
 */
export const isBackendEnabled = () => {
  return USE_BACKEND;
};

/**
 * Get exchange data from backend
 * Returns 4 hours of historical data + current snapshot
 */
export const getExchangeData = async (exchange) => {
  if (!USE_BACKEND) {
    throw new Error('Backend API is not enabled. Set VITE_USE_BACKEND=true in .env');
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/data/${exchange}`);
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[BackendAPI] Failed to fetch ${exchange} data:`, error);
    throw error;
  }
};

/**
 * Get current snapshot only (faster, no history)
 */
export const getExchangeSnapshot = async (exchange) => {
  if (!USE_BACKEND) {
    throw new Error('Backend API is not enabled. Set VITE_USE_BACKEND=true in .env');
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/snapshot/${exchange}`);
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[BackendAPI] Failed to fetch ${exchange} snapshot:`, error);
    throw error;
  }
};

/**
 * Get all exchanges data
 */
export const getAllExchangesData = async () => {
  if (!USE_BACKEND) {
    throw new Error('Backend API is not enabled. Set VITE_USE_BACKEND=true in .env');
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/data/all`);
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch all exchanges:', error);
    throw error;
  }
};

/**
 * Check backend health
 */
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!response.ok) {
      return { status: 'error', message: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { status: 'ok', data };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
};

/**
 * Get backend statistics
 */
export const getBackendStats = async () => {
  if (!USE_BACKEND) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/stats`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch stats:', error);
    return null;
  }
};

/**
 * Get BTC 8-12 hour bias projection
 * Returns predictive bias analysis
 */
export const getBTCProjection = async () => {
  if (!USE_BACKEND) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/btc/projection`);
    if (!response.ok) {
      console.error(`[BackendAPI] Projection error: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[BackendAPI] Failed to fetch BTC projection:', error);
    return null;
  }
};

export default {
  isBackendEnabled,
  getExchangeData,
  getExchangeSnapshot,
  getAllExchangesData,
  checkBackendHealth,
  getBackendStats,
  getBTCProjection
};
