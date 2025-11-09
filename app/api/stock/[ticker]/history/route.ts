import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// In-memory cache for historical data
interface CachedHistoricalData {
  data: HistoricalData;
  timestamp: number;
}

interface HistoricalData {
  ticker: string;
  yearStartPrice?: number; // Price at year start (for YTD performance)
  previousClose?: number; // Yesterday's close (for daily change)
  dividends: DividendPayment[];
  currentYearDividends: number; // Sum of dividends paid this year
  nextYearEstimatedDividends?: number; // Estimated dividends for next year
}

interface DividendPayment {
  date: Date;
  amount: number;
}

const cache = new Map<string, CachedHistoricalData>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache for historical data

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase();
    const now = Date.now();

    // Check cache
    const cached = cache.get(tickerUpper);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log(`[${tickerUpper}] Returning cached data (age: ${Math.floor((now - cached.timestamp) / 1000)}s)`);
      console.log(`[${tickerUpper}] Cached yearStartPrice: ${cached.data.yearStartPrice}`);
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((now - cached.timestamp) / 1000),
      });
    }

    console.log(`[${tickerUpper}] Cache miss or expired, fetching fresh data...`);

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch historical prices
    let yearStartPrice: number | undefined;
    let previousClose: number | undefined;

    try {
      // Get historical quotes from year start to today
      console.log(`[${tickerUpper}] Fetching historical quotes from ${yearStart.toISOString()} to ${today.toISOString()}`);

      const historicalQuotes = await yahooFinance.historical(tickerUpper, {
        period1: yearStart,
        period2: today,
        interval: '1d',
      });

      console.log(`[${tickerUpper}] Historical quotes received:`, {
        count: historicalQuotes?.length || 0,
        hasData: !!historicalQuotes,
        isArray: Array.isArray(historicalQuotes),
        firstItem: historicalQuotes?.[0],
        lastItem: historicalQuotes?.[historicalQuotes.length - 1],
      });

      if (historicalQuotes && historicalQuotes.length > 0) {
        // Year start price (first available data point)
        yearStartPrice = historicalQuotes[0].close;
        console.log(`[${tickerUpper}] Year start price: ${yearStartPrice} (date: ${historicalQuotes[0].date})`);

        // Previous close (second to last, as last might be today's ongoing)
        if (historicalQuotes.length >= 2) {
          previousClose = historicalQuotes[historicalQuotes.length - 2].close;
          console.log(`[${tickerUpper}] Previous close: ${previousClose} (date: ${historicalQuotes[historicalQuotes.length - 2].date})`);
        } else if (historicalQuotes.length === 1) {
          previousClose = historicalQuotes[0].close;
          console.log(`[${tickerUpper}] Previous close (only 1 data point): ${previousClose}`);
        }
      } else {
        console.warn(`[${tickerUpper}] No historical quotes available - trying alternative method`);

        // Alternative: Get quote and use regularMarketPreviousClose
        try {
          const quote = await yahooFinance.quote(tickerUpper);
          if (quote) {
            previousClose = quote.regularMarketPreviousClose;
            console.log(`[${tickerUpper}] Got previousClose from quote: ${previousClose}`);

            // For yearStartPrice, we might need to fetch specifically from Jan 1
            const jan1 = new Date(currentYear, 0, 1);
            const jan5 = new Date(currentYear, 0, 5); // First week to ensure we get data

            console.log(`[${tickerUpper}] Trying to fetch Jan 1 price from ${jan1.toISOString()} to ${jan5.toISOString()}`);
            const earlyYearQuotes = await yahooFinance.historical(tickerUpper, {
              period1: jan1,
              period2: jan5,
              interval: '1d',
            });

            if (earlyYearQuotes && earlyYearQuotes.length > 0) {
              yearStartPrice = earlyYearQuotes[0].close;
              console.log(`[${tickerUpper}] Got yearStartPrice from early year fetch: ${yearStartPrice}`);
            } else {
              console.warn(`[${tickerUpper}] Could not fetch yearStartPrice even with alternative method`);
            }
          }
        } catch (altError) {
          console.error(`[${tickerUpper}] Alternative method also failed:`, altError);
        }
      }
    } catch (error) {
      console.error(`[${tickerUpper}] Failed to fetch historical prices:`, {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Fetch dividend history
    const dividends: DividendPayment[] = [];
    let currentYearDividends = 0;

    try {
      // Get dividends from start of current year to 2 years in future
      const futureDate = new Date(currentYear + 2, 11, 31);
      console.log(`[${tickerUpper}] Fetching dividends from ${yearStart.toISOString()} to ${futureDate.toISOString()}`);

      const dividendHistory = await yahooFinance.historical(tickerUpper, {
        period1: yearStart,
        period2: futureDate,
        events: 'dividends',
      });

      console.log(`[${tickerUpper}] Dividend history received: ${dividendHistory?.length || 0} entries`);

      if (dividendHistory && Array.isArray(dividendHistory)) {
        dividendHistory.forEach((item: any) => {
          if (item.dividends) {
            const divDate = new Date(item.date);
            dividends.push({
              date: divDate,
              amount: item.dividends,
            });

            // Sum dividends for current year
            if (divDate.getFullYear() === currentYear) {
              currentYearDividends += item.dividends;
            }
            console.log(`[${tickerUpper}] Dividend: ${item.dividends} on ${divDate.toISOString().split('T')[0]} (year: ${divDate.getFullYear()})`);
          }
        });
        console.log(`[${tickerUpper}] Total dividends for ${currentYear}: ${currentYearDividends}`);
      } else {
        console.warn(`[${tickerUpper}] No dividend history available`);
      }
    } catch (error) {
      console.error(`[${tickerUpper}] Failed to fetch dividends:`, error);
    }

    // Get forward dividend estimate from quote
    let nextYearEstimatedDividends: number | undefined;
    try {
      console.log(`[${tickerUpper}] Fetching quote for forward dividend estimate`);
      const quote = await yahooFinance.quote(tickerUpper);
      if (quote && quote.dividendRate) {
        nextYearEstimatedDividends = quote.dividendRate;
        console.log(`[${tickerUpper}] Next year estimated dividends (forward): ${nextYearEstimatedDividends}`);
      } else {
        console.log(`[${tickerUpper}] No forward dividend rate available in quote`);
      }
    } catch (error) {
      console.error(`[${tickerUpper}] Failed to fetch forward dividend:`, error);
    }

    const historicalData: HistoricalData = {
      ticker: tickerUpper,
      yearStartPrice,
      previousClose,
      dividends,
      currentYearDividends,
      nextYearEstimatedDividends,
    };

    console.log(`[${tickerUpper}] ===== FINAL HISTORICAL DATA =====`);
    console.log(`[${tickerUpper}] yearStartPrice: ${yearStartPrice} (${yearStartPrice ? 'SET' : 'MISSING!'})`);
    console.log(`[${tickerUpper}] previousClose: ${previousClose} (${previousClose ? 'SET' : 'MISSING!'})`);
    console.log(`[${tickerUpper}] dividends: ${dividends.length} entries`);
    console.log(`[${tickerUpper}] currentYearDividends: ${currentYearDividends}`);
    console.log(`[${tickerUpper}] nextYearEstimatedDividends: ${nextYearEstimatedDividends}`);
    console.log(`[${tickerUpper}] ================================`);

    // Store in cache
    cache.set(tickerUpper, {
      data: historicalData,
      timestamp: now,
    });

    return NextResponse.json({
      ...historicalData,
      cached: false,
      cacheAge: 0,
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}
