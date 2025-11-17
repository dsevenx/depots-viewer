'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db, Position } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSharedStockData, StockPrice, HistoricalData } from '@/lib/hooks/useSharedStockData';

interface AggregatedAsset {
  ticker: string;
  name?: string;
  totalQuantity: number;
  totalPurchaseValue: number;
  totalCurrentValue: number;
  averagePurchasePrice: number;
  currentPrice?: number;
  currency: string;
  dailyGain?: number;
  dailyGainPercent?: number;
  yearlyGain?: number;
  yearlyGainPercent?: number;
  currentYearDividends: number;
  expectedDividends?: number;
  positions: Position[];
}

type SortColumn = 'name' | 'value' | 'dailyGain' | 'yearlyGain' | 'currentDividends' | 'expectedDividends';
type SortDirection = 'asc' | 'desc';

export default function DashboardPage() {
  const { stockPrices, historicalData, isLoadingData, fetchStockData, hasData } = useSharedStockData();
  const [sortColumn, setSortColumn] = useState<SortColumn>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load all positions from all banks
  const positions = useLiveQuery(() => db.positions.toArray());
  const banks = useLiveQuery(() => db.banks.toArray());

  // Calculate yearly performance for a specific asset
  const calculateYearlyPerformance = (
    ticker: string,
    currentPrice: number,
    totalQuantity: number
  ): { yearlyGain?: number; yearlyGainPercent?: number } => {
    const historical = historicalData[ticker];
    if (!historical?.yearStartPrice) {
      return {};
    }

    const yearlyGain = totalQuantity * (currentPrice - historical.yearStartPrice);
    const yearlyGainPercent =
      ((currentPrice - historical.yearStartPrice) / historical.yearStartPrice) * 100;

    console.log(`[Dashboard] ${ticker} yearly performance:`, {
      yearStartPrice: historical.yearStartPrice,
      currentPrice,
      yearlyGain,
      yearlyGainPercent,
    });

    return { yearlyGain, yearlyGainPercent };
  };

  // Aggregate positions by ticker
  const aggregatedAssets: AggregatedAsset[] = positions
    ? Object.values(
        positions.reduce((acc, position) => {
          const ticker = position.ticker;
          if (!acc[ticker]) {
            acc[ticker] = {
              ticker,
              name: undefined,
              totalQuantity: 0,
              totalPurchaseValue: 0,
              totalCurrentValue: 0,
              averagePurchasePrice: 0,
              currency: position.currency,
              currentYearDividends: 0,
              positions: [],
            };
          }

          acc[ticker].totalQuantity += position.quantity;
          acc[ticker].totalPurchaseValue += position.quantity * position.purchasePrice;
          acc[ticker].positions.push(position);

          return acc;
        }, {} as Record<string, AggregatedAsset>)
      ).map((asset) => {
        const ticker = asset.ticker;
        asset.averagePurchasePrice = asset.totalPurchaseValue / asset.totalQuantity;

        // Check if any position is a bond
        const isBond = asset.positions.some(p => p.assetType === 'bond');

        if (isBond) {
          // For bonds: use nominal value and coupon instead of Yahoo Finance
          const bondPosition = asset.positions.find(p => p.assetType === 'bond' && p.nominalValue && p.couponRate);

          if (bondPosition && bondPosition.nominalValue && bondPosition.couponRate !== undefined) {
            asset.name = bondPosition.ticker;
            asset.currentPrice = bondPosition.nominalValue;
            asset.totalCurrentValue = bondPosition.nominalValue;

            // For bonds, coupon is the "dividend"
            const annualCoupon = (bondPosition.nominalValue * bondPosition.couponRate) / 100;
            asset.currentYearDividends = annualCoupon;
            asset.expectedDividends = annualCoupon;

            console.log(`[Dashboard] ${ticker} bond coupon:`, {
              nominalValue: bondPosition.nominalValue,
              couponRate: bondPosition.couponRate,
              annualCoupon,
            });
          } else {
            asset.totalCurrentValue = asset.totalPurchaseValue;
          }
        } else {
          // For stocks/ETFs: use Yahoo Finance data
          const stockPrice = stockPrices[ticker];
          const historical = historicalData[ticker];

          if (stockPrice) {
            asset.name = stockPrice.name;
            asset.currentPrice = stockPrice.currentPrice;
            asset.totalCurrentValue = asset.totalQuantity * stockPrice.currentPrice;

            // Daily gain/loss
            if (historical?.previousClose) {
              asset.dailyGain =
                asset.totalQuantity * (stockPrice.currentPrice - historical.previousClose);
              asset.dailyGainPercent =
                ((stockPrice.currentPrice - historical.previousClose) / historical.previousClose) * 100;
            }

            // Yearly gain/loss - using separate method
            const yearlyPerf = calculateYearlyPerformance(
              ticker,
              stockPrice.currentPrice,
              asset.totalQuantity
            );
            asset.yearlyGain = yearlyPerf.yearlyGain;
            asset.yearlyGainPercent = yearlyPerf.yearlyGainPercent;

            // Dividends - simplified using stockPrices directly
            if (stockPrice.trailingDividendRate) {
              asset.currentYearDividends = stockPrice.trailingDividendRate * asset.totalQuantity;
              console.log(`[Dashboard] ${ticker} current dividends (trailing):`, {
                trailingDividendRate: stockPrice.trailingDividendRate,
                totalQuantity: asset.totalQuantity,
                totalCurrentYearDiv: asset.currentYearDividends,
              });
            }

            if (stockPrice.dividendRate) {
              asset.expectedDividends = stockPrice.dividendRate * asset.totalQuantity;
              console.log(`[Dashboard] ${ticker} expected dividends (forward):`, {
                dividendRate: stockPrice.dividendRate,
                totalQuantity: asset.totalQuantity,
                totalExpectedDiv: asset.expectedDividends,
              });
            }
          } else {
            asset.totalCurrentValue = asset.totalPurchaseValue;
            console.log(`[Dashboard] ${ticker}: No stock price data available`);
          }
        }

        return asset;
      })
    : [];

  // Calculate portfolio totals
  const portfolioTotal = aggregatedAssets.reduce((sum, asset) => sum + asset.totalCurrentValue, 0);
  const purchaseTotal = aggregatedAssets.reduce((sum, asset) => sum + asset.totalPurchaseValue, 0);

  // 1. Akkumulierte Performance (absolut)
  const totalGain = portfolioTotal - purchaseTotal;
  const totalGainPercent = purchaseTotal > 0 ? (totalGain / purchaseTotal) * 100 : 0;

  // 2. Akkumulierte Performance (% p.a.) - annualisiert vom ersten Kaufdatum
  const calculateAnnualizedReturn = () => {
    if (!positions || positions.length === 0 || purchaseTotal === 0) return 0;

    // Finde das früheste Kaufdatum
    const firstPurchaseDate = positions.reduce((earliest, position) => {
      const purchaseDate = new Date(position.purchaseDate);
      return purchaseDate < earliest ? purchaseDate : earliest;
    }, new Date(positions[0].purchaseDate));

    // Berechne die Anzahl der Jahre seit dem ersten Kauf
    const today = new Date();
    const yearsHeld = (today.getTime() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsHeld < 0.01) return 0; // Zu kurze Zeitspanne

    // Annualisierte Rendite: ((EndValue / StartValue) ^ (1 / Jahre) - 1) * 100
    const annualizedReturn = (Math.pow(portfolioTotal / purchaseTotal, 1 / yearsHeld) - 1) * 100;

    console.log('[Dashboard] Annualized return:', {
      firstPurchaseDate: firstPurchaseDate.toISOString(),
      yearsHeld,
      purchaseTotal,
      portfolioTotal,
      annualizedReturn,
    });

    return annualizedReturn;
  };

  const annualizedReturnPercent = calculateAnnualizedReturn();

  // 3 & 4. Jahresperformance 2025
  const calculateYearToDatePerformance = () => {
    if (!positions || positions.length === 0) {
      return { ytdGain: 0, ytdGainPercent: 0, yearStartValue: 0 };
    }

    const currentYear = new Date().getFullYear();
    const yearStartDate = new Date(currentYear, 0, 1);

    // Berechne den Depotwert am 1. Januar 2025
    let yearStartValue = 0;

    positions.forEach((position) => {
      const purchaseDate = new Date(position.purchaseDate);

      // Position muss vor dem 1.1. gekauft worden sein
      if (purchaseDate < yearStartDate) {
        const historical = historicalData[position.ticker];

        if (historical?.yearStartPrice) {
          // Wert dieser Position am 1.1.
          yearStartValue += position.quantity * historical.yearStartPrice;
        }
      }
    });

    // Nur Positionen berücksichtigen, die am 1.1. bereits im Depot waren
    // Für den aktuellen Wert zählen wir nur die Positionen, die am 1.1. schon da waren
    let currentValueOfYearStartPositions = 0;

    positions.forEach((position) => {
      const purchaseDate = new Date(position.purchaseDate);

      if (purchaseDate < yearStartDate) {
        const stockPrice = stockPrices[position.ticker];

        if (stockPrice) {
          currentValueOfYearStartPositions += position.quantity * stockPrice.currentPrice;
        }
      }
    });

    const ytdGain = currentValueOfYearStartPositions - yearStartValue;
    const ytdGainPercent = yearStartValue > 0 ? (ytdGain / yearStartValue) * 100 : 0;

    console.log('[Dashboard] YTD Performance:', {
      yearStartValue,
      currentValueOfYearStartPositions,
      ytdGain,
      ytdGainPercent,
    });

    return { ytdGain, ytdGainPercent, yearStartValue };
  };

  const { ytdGain, ytdGainPercent, yearStartValue } = calculateYearToDatePerformance();

  // Dividends totals
  const totalCurrentYearDividends = aggregatedAssets.reduce(
    (sum, asset) => sum + asset.currentYearDividends,
    0
  );
  const totalExpectedDividends = aggregatedAssets.reduce(
    (sum, asset) => sum + (asset.expectedDividends || 0),
    0
  );

  // Fetch all stock data
  const handleFetchAllData = async () => {
    if (!positions || positions.length === 0) {
      alert('Keine Positionen vorhanden');
      return;
    }

    const tickers = [...new Set(positions.map((p) => p.ticker))];

    try {
      await fetchStockData(tickers);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      alert('Fehler beim Laden der Kursdaten');
    }
  };

  // Auto-fetch on mount if no data
  useEffect(() => {
    if (positions && positions.length > 0 && !hasData) {
      handleFetchAllData();
    }
  }, [positions, hasData]);

  // Sorting logic
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedAssets = [...aggregatedAssets].sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;

    switch (sortColumn) {
      case 'name':
        aValue = a.name || a.ticker;
        bValue = b.name || b.ticker;
        break;
      case 'value':
        aValue = a.totalCurrentValue;
        bValue = b.totalCurrentValue;
        break;
      case 'dailyGain':
        aValue = a.dailyGain || 0;
        bValue = b.dailyGain || 0;
        break;
      case 'yearlyGain':
        aValue = a.yearlyGain || 0;
        bValue = b.yearlyGain || 0;
        break;
      case 'currentDividends':
        aValue = a.currentYearDividends;
        bValue = b.currentYearDividends;
        break;
      case 'expectedDividends':
        aValue = a.expectedDividends || 0;
        bValue = b.expectedDividends || 0;
        break;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  // Chart data (step-wise based on actual purchases)
  const chartData = (() => {
    if (!positions || positions.length === 0 || !banks) return [];

    // Create a map for quick bank lookup
    const bankMap = new Map(banks.map(bank => [bank.id, bank.name]));

    // Group positions by date
    const positionsByDate = new Map<string, Position[]>();
    positions.forEach((position) => {
      const dateKey = new Date(position.purchaseDate).toISOString().split('T')[0];
      if (!positionsByDate.has(dateKey)) {
        positionsByDate.set(dateKey, []);
      }
      positionsByDate.get(dateKey)!.push(position);
    });

    // Sort dates
    const sortedDates = Array.from(positionsByDate.keys()).sort();

    const dataPoints = [];
    let cumulativePurchaseValue = 0;
    let cumulativeCurrentValue = 0;

    // Add data point for each date (potentially multiple positions)
    sortedDates.forEach((dateKey) => {
      const positionsOnDate = positionsByDate.get(dateKey)!;

      // Calculate values for all positions on this date
      let datePurchaseValue = 0;
      let dateCurrentValue = 0;

      const positionDetails = positionsOnDate.map((position) => {
        const purchaseValue = position.quantity * position.purchasePrice;
        datePurchaseValue += purchaseValue;

        const stockPrice = stockPrices[position.ticker];
        const currentValue = stockPrice
          ? position.quantity * stockPrice.currentPrice
          : purchaseValue;
        dateCurrentValue += currentValue;

        return {
          ticker: position.ticker,
          quantity: position.quantity,
          bankName: bankMap.get(position.bankId) || 'Unbekanntes Depot',
          purchaseValue,
          currentValue,
        };
      });

      cumulativePurchaseValue += datePurchaseValue;
      cumulativeCurrentValue += dateCurrentValue;

      dataPoints.push({
        date: new Date(dateKey).toLocaleDateString('de-DE', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
        fullDate: new Date(dateKey).toLocaleDateString('de-DE'),
        portfolioValue: cumulativeCurrentValue,
        purchaseValue: cumulativePurchaseValue,
        positions: positionDetails,
      });
    });

    return dataPoints;
  })();

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <span className="text-zinc-400">⇅</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-zinc-800 dark:bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-xl">
        <p className="text-zinc-100 font-semibold mb-3 text-sm border-b border-zinc-700 pb-2">
          {data.fullDate}
        </p>

        {/* Portfolio Values */}
        <div className="mb-3 space-y-1">
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-400 text-xs">Aktueller Wert:</span>
            <span className="text-zinc-100 font-semibold text-sm">
              {formatCurrency(data.portfolioValue)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-400 text-xs">Kaufwert:</span>
            <span className="text-zinc-400 text-sm">
              {formatCurrency(data.purchaseValue)}
            </span>
          </div>
        </div>

        {/* Positions bought on this date */}
        {data.positions && data.positions.length > 0 && (
          <div className="border-t border-zinc-700 pt-3 mt-3">
            <p className="text-zinc-400 text-xs mb-2">
              {data.positions.length === 1 ? 'Position gekauft:' : `${data.positions.length} Positionen gekauft:`}
            </p>
            <div className="space-y-2">
              {data.positions.map((pos: any, idx: number) => (
                <div key={idx} className="bg-zinc-700 dark:bg-zinc-950 rounded px-2 py-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-zinc-100 font-medium text-sm">
                      {pos.ticker}
                    </span>
                    <span className="text-zinc-300 text-xs">
                      {pos.quantity} Stk.
                    </span>
                  </div>
                  <div className="text-zinc-400 text-xs">
                    Depot: {pos.bankName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Portfolio Dashboard
            </h1>
            <div className="flex gap-3">
              <button
                onClick={handleFetchAllData}
                disabled={isLoadingData}
                className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLoadingData ? '⏳' : '🔄'}</span>
                <span>{isLoadingData ? 'Lädt...' : 'Daten aktualisieren'}</span>
              </button>
              <Link
                href="/depots"
                className="px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors inline-flex items-center gap-2"
              >
                Zu Depots
              </Link>
            </div>
          </div>

          {/* Portfolio Summary Cards */}
          {/* Erste Reihe: Performance-Metriken */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Gesamtwert</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(portfolioTotal)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Einkauf: {formatCurrency(purchaseTotal)}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Akk. Performance</p>
              <p
                className={`text-2xl font-bold ${
                  totalGain >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {totalGain >= 0 ? '+' : ''}
                {formatCurrency(totalGain)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {totalGainPercent >= 0 ? '+' : ''}
                {totalGainPercent.toFixed(2)}%
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Akk. Perf. p.a.</p>
              <p
                className={`text-2xl font-bold ${
                  annualizedReturnPercent >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {annualizedReturnPercent >= 0 ? '+' : ''}
                {annualizedReturnPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                annualisiert
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                Perf. {new Date().getFullYear()}
              </p>
              <p
                className={`text-2xl font-bold ${
                  ytdGain >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {ytdGain >= 0 ? '+' : ''}
                {formatCurrency(ytdGain)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                1.1.: {formatCurrency(yearStartValue)}
              </p>
            </div>
          </div>

          {/* Zweite Reihe: Jahresperformance % + Dividenden */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                Perf. {new Date().getFullYear()} %
              </p>
              <p
                className={`text-2xl font-bold ${
                  ytdGainPercent >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {ytdGainPercent >= 0 ? '+' : ''}
                {ytdGainPercent.toFixed(2)}%
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                seit 1.1.{new Date().getFullYear()}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                Dividenden {new Date().getFullYear()}
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(totalCurrentYearDividends)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                aktuell/trailing
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                Div. Erw. {new Date().getFullYear() + 1}
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(totalExpectedDividends)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                forward/geschätzt
              </p>
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Portfolio-Entwicklung
            </h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="stepAfter"
                    dataKey="portfolioValue"
                    stroke="#000000"
                    strokeWidth={2}
                    name="Aktueller Wert"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="purchaseValue"
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    name="Kaufwert"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                Keine Positionen vorhanden. Füge Positionen hinzu, um die Portfolio-Entwicklung zu sehen.
              </p>
            )}
          </div>

          {/* Assets Table */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Alle Assets ({aggregatedAssets.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('name')}
                    >
                      Name / Ticker <SortIcon column="name" />
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('value')}
                    >
                      Depotwert <SortIcon column="value" />
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('dailyGain')}
                    >
                      Tages +/- <SortIcon column="dailyGain" />
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('yearlyGain')}
                    >
                      Jahres +/- <SortIcon column="yearlyGain" />
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('currentDividends')}
                    >
                      Div. {new Date().getFullYear()} <SortIcon column="currentDividends" />
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleSort('expectedDividends')}
                    >
                      Erw. Div. {new Date().getFullYear() + 1} <SortIcon column="expectedDividends" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {sortedAssets.map((asset) => (
                    <tr
                      key={asset.ticker}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {asset.name || asset.ticker}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {asset.ticker} • {asset.totalQuantity} Stk.
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(asset.totalCurrentValue, asset.currency)}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {asset.currentPrice && formatCurrency(asset.currentPrice, asset.currency)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.dailyGain !== undefined ? (
                          <>
                            <p
                              className={`font-medium ${
                                asset.dailyGain >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {asset.dailyGain >= 0 ? '+' : ''}
                              {formatCurrency(asset.dailyGain, asset.currency)}
                            </p>
                            <p
                              className={`text-sm ${
                                asset.dailyGainPercent && asset.dailyGainPercent >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {asset.dailyGainPercent && asset.dailyGainPercent >= 0 ? '+' : ''}
                              {asset.dailyGainPercent?.toFixed(2)}%
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-zinc-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.yearlyGain !== undefined ? (
                          <>
                            <p
                              className={`font-medium ${
                                asset.yearlyGain >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {asset.yearlyGain >= 0 ? '+' : ''}
                              {formatCurrency(asset.yearlyGain, asset.currency)}
                            </p>
                            <p
                              className={`text-sm ${
                                asset.yearlyGainPercent && asset.yearlyGainPercent >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {asset.yearlyGainPercent && asset.yearlyGainPercent >= 0 ? '+' : ''}
                              {asset.yearlyGainPercent?.toFixed(2)}%
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-zinc-400">-</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {asset.currentYearDividends > 0
                            ? formatCurrency(asset.currentYearDividends, asset.currency)
                            : '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {asset.expectedDividends
                            ? formatCurrency(asset.expectedDividends, asset.currency)
                            : '-'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dividend Calendar */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Dividendenkalender
            </h2>
            <div className="space-y-2">
              {Object.entries(historicalData).flatMap(([ticker, data]) =>
                data.dividends
                  .filter((div) => {
                    const divDate = new Date(div.date);
                    const today = new Date();
                    const futureLimit = new Date();
                    futureLimit.setMonth(futureLimit.getMonth() + 12);
                    return divDate >= today && divDate <= futureLimit;
                  })
                  .map((div) => ({
                    ticker,
                    date: new Date(div.date),
                    amount: div.amount,
                    asset: aggregatedAssets.find((a) => a.ticker === ticker),
                  }))
              )
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((div, index) => (
                  <div
                    key={`${div.ticker}-${index}`}
                    className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {div.asset?.name || div.ticker}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {div.date.toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(div.amount * (div.asset?.totalQuantity || 0))}
                    </p>
                  </div>
                ))}
              {Object.keys(historicalData).length === 0 && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  Lade Dividendendaten...
                </p>
              )}
              {Object.keys(historicalData).length > 0 &&
                Object.values(historicalData).every((d) => d.dividends.length === 0) && (
                  <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    Keine anstehenden Dividendenzahlungen
                  </p>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
