import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// In-memory cache for stock data
interface CachedStockData {
  data: StockData;
  timestamp: number;
}

interface StockData {
  ticker: string;
  currentPrice: number;
  currency: string;
  dividendRate?: number; // Forward dividend (estimated for next year)
  dividendYield?: number; // Forward yield
  trailingDividendRate?: number; // Trailing dividend (current year)
  trailingDividendYield?: number; // Trailing yield
  name?: string;
}

const cache = new Map<string, CachedStockData>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
        cacheAge: Math.floor((now - cached.timestamp) / 1000), // seconds
      });
    }

    // Fetch from Yahoo Finance
    const quote = await yahooFinance.quote(tickerUpper);

    if (!quote) {
      return NextResponse.json(
        { error: 'Stock data not found' },
        { status: 404 }
      );
    }

    const stockData: StockData = {
      ticker: tickerUpper,
      currentPrice: quote.regularMarketPrice || 0,
      currency: quote.currency || 'USD',
      name: quote.shortName || quote.longName,
      dividendRate: quote.dividendRate,
      dividendYield: quote.dividendYield,
      trailingDividendRate: quote.trailingAnnualDividendRate,
      trailingDividendYield: quote.trailingAnnualDividendYield,
    };

    // Store in cache
    cache.set(tickerUpper, {
      data: stockData,
      timestamp: now,
    });

    return NextResponse.json({
      ...stockData,
      cached: false,
      cacheAge: 0,
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);

    // Handle specific Yahoo Finance errors
    if (error instanceof Error) {
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return NextResponse.json(
          { error: 'Ticker not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}

// Optional: Add a POST endpoint to force cache refresh
export async function POST(
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

    // Clear cache for this ticker
    cache.delete(tickerUpper);

    // Fetch fresh data (reuse GET logic)
    const response = await GET(request, { params });
    return response;
  } catch (error) {
    console.error('Error refreshing stock data:', error);
    return NextResponse.json(
      { error: 'Failed to refresh stock data' },
      { status: 500 }
    );
  }
}
