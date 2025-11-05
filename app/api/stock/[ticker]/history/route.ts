import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

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
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor((now - cached.timestamp) / 1000),
      });
    }

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
      const historicalQuotes = await yahooFinance.historical(tickerUpper, {
        period1: yearStart,
        period2: today,
        interval: '1d',
      });

      if (historicalQuotes && historicalQuotes.length > 0) {
        // Year start price (first available data point)
        yearStartPrice = historicalQuotes[0].close;

        // Previous close (second to last, as last might be today's ongoing)
        if (historicalQuotes.length >= 2) {
          previousClose = historicalQuotes[historicalQuotes.length - 2].close;
        } else if (historicalQuotes.length === 1) {
          previousClose = historicalQuotes[0].close;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch historical prices for ${tickerUpper}:`, error);
    }

    // Fetch dividend history
    const dividends: DividendPayment[] = [];
    let currentYearDividends = 0;

    try {
      // Get dividends from start of current year to 2 years in future
      const futureDate = new Date(currentYear + 2, 11, 31);

      const dividendHistory = await yahooFinance.historical(tickerUpper, {
        period1: yearStart,
        period2: futureDate,
        events: 'dividends',
      });

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
          }
        });
      }
    } catch (error) {
      console.error(`Failed to fetch dividends for ${tickerUpper}:`, error);
    }

    // Get forward dividend estimate from quote
    let nextYearEstimatedDividends: number | undefined;
    try {
      const quote = await yahooFinance.quote(tickerUpper);
      if (quote && quote.dividendRate) {
        nextYearEstimatedDividends = quote.dividendRate;
      }
    } catch (error) {
      console.error(`Failed to fetch forward dividend for ${tickerUpper}:`, error);
    }

    const historicalData: HistoricalData = {
      ticker: tickerUpper,
      yearStartPrice,
      previousClose,
      dividends,
      currentYearDividends,
      nextYearEstimatedDividends,
    };

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
