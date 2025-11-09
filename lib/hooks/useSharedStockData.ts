import { useState, useEffect } from 'react';

export interface StockPrice {
  currentPrice: number;
  currency: string;
  dividendRate?: number;
  dividendYield?: number;
  trailingDividendRate?: number;
  trailingDividendYield?: number;
  name?: string;
}

export interface HistoricalData {
  yearStartPrice?: number;
  previousClose?: number;
  dividends: Array<{ date: Date; amount: number }>;
  currentYearDividends: number;
  nextYearEstimatedDividends?: number;
}

interface CachedData {
  stockPrices: Record<string, StockPrice>;
  historicalData: Record<string, HistoricalData>;
  timestamp: number;
}

const STORAGE_KEY = 'stock_data_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useSharedStockData() {
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalData>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - data.timestamp < CACHE_DURATION) {
          setStockPrices(data.stockPrices);
          setHistoricalData(data.historicalData);
        } else {
          // Clear expired cache
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load cached stock data:', error);
    }
  }, []);

  // Save to sessionStorage whenever data changes
  useEffect(() => {
    if (Object.keys(stockPrices).length > 0 || Object.keys(historicalData).length > 0) {
      try {
        const data: CachedData = {
          stockPrices,
          historicalData,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to cache stock data:', error);
      }
    }
  }, [stockPrices, historicalData]);

  const fetchStockData = async (tickers: string[]) => {
    if (tickers.length === 0) return;

    setIsLoadingData(true);

    try {
      const [pricesData, historicalDataArray] = await Promise.all([
        // Fetch current prices
        Promise.all(
          tickers.map(async (ticker) => {
            try {
              const response = await fetch(`/api/stock/${ticker}`);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const data = await response.json();
              return { ticker, data };
            } catch (error) {
              console.error(`Failed to fetch price for ${ticker}:`, error);
              return { ticker, data: null };
            }
          })
        ),
        // Fetch historical data
        Promise.all(
          tickers.map(async (ticker) => {
            try {
              const response = await fetch(`/api/stock/${ticker}/history`);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const data = await response.json();
              return { ticker, data };
            } catch (error) {
              console.error(`Failed to fetch historical data for ${ticker}:`, error);
              return { ticker, data: null };
            }
          })
        ),
      ]);

      // Update stock prices
      const newPrices: Record<string, StockPrice> = {};
      pricesData.forEach(({ ticker, data }) => {
        if (data) {
          newPrices[ticker] = data;
        }
      });
      setStockPrices(newPrices);

      // Update historical data
      const newHistoricalData: Record<string, HistoricalData> = {};
      historicalDataArray.forEach(({ ticker, data }) => {
        if (data) {
          newHistoricalData[ticker] = data;
        }
      });
      setHistoricalData(newHistoricalData);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      throw error;
    } finally {
      setIsLoadingData(false);
    }
  };

  const clearCache = () => {
    setStockPrices({});
    setHistoricalData({});
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const hasData = Object.keys(stockPrices).length > 0;

  return {
    stockPrices,
    historicalData,
    isLoadingData,
    fetchStockData,
    clearCache,
    hasData,
  };
}
