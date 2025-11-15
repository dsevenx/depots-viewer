import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase();
    const purchaseDate = new Date(dateParam);

    console.log(`[${tickerUpper}] Fetching purchase data for date: ${purchaseDate.toISOString()}`);

    // Get quote info for ISIN and asset type detection
    let isin: string | undefined;
    let assetType: 'stock' | 'etf' | 'bond' = 'stock';

    try {
      const quote = await yahooFinance.quoteSummary(tickerUpper, {
        modules: ['summaryProfile', 'quoteType', 'price'],
      });

      console.log(`[${tickerUpper}] Quote summary received:`, {
        hasProfile: !!quote.summaryProfile,
        hasQuoteType: !!quote.quoteType,
        hasPrice: !!quote.price,
      });

      // Get ISIN if available
      if (quote.summaryProfile?.isin) {
        isin = quote.summaryProfile.isin;
        console.log(`[${tickerUpper}] ISIN found: ${isin}`);
      }

      // Detect asset type
      if (quote.quoteType?.quoteType) {
        const quoteType = quote.quoteType.quoteType.toLowerCase();
        console.log(`[${tickerUpper}] Quote type: ${quoteType}`);

        if (quoteType.includes('etf')) {
          assetType = 'etf';
        } else if (quoteType.includes('bond') || quoteType.includes('mutualfund')) {
          assetType = 'bond';
        } else {
          assetType = 'stock';
        }
        console.log(`[${tickerUpper}] Detected asset type: ${assetType}`);
      }
    } catch (error) {
      console.warn(`[${tickerUpper}] Failed to fetch quote summary:`, error);
      // Continue without ISIN/assetType - not critical
    }

    // Get historical price for the purchase date
    let purchasePrice: number | undefined;

    try {
      // Fetch a few days around the purchase date to ensure we get data
      // (markets might be closed on weekends/holidays)
      const startDate = new Date(purchaseDate);
      startDate.setDate(startDate.getDate() - 5); // 5 days before

      const endDate = new Date(purchaseDate);
      endDate.setDate(endDate.getDate() + 5); // 5 days after

      console.log(`[${tickerUpper}] Fetching historical data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const historicalQuotes = await yahooFinance.historical(tickerUpper, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      console.log(`[${tickerUpper}] Historical quotes received: ${historicalQuotes?.length || 0} entries`);

      if (historicalQuotes && historicalQuotes.length > 0) {
        // Find the closest date to the purchase date
        const targetTime = purchaseDate.getTime();
        let closestQuote = historicalQuotes[0];
        let minDiff = Math.abs(new Date(historicalQuotes[0].date).getTime() - targetTime);

        for (const quote of historicalQuotes) {
          const quoteTime = new Date(quote.date).getTime();
          const diff = Math.abs(quoteTime - targetTime);

          if (diff < minDiff) {
            minDiff = diff;
            closestQuote = quote;
          }
        }

        purchasePrice = closestQuote.close;
        const priceDate = new Date(closestQuote.date);
        console.log(`[${tickerUpper}] Purchase price: ${purchasePrice} (from ${priceDate.toISOString().split('T')[0]})`);

        // Warn if the date is more than 7 days away
        const daysDiff = Math.abs(minDiff / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          console.warn(`[${tickerUpper}] Warning: Closest price is ${daysDiff.toFixed(0)} days away from requested date`);
        }
      } else {
        console.warn(`[${tickerUpper}] No historical quotes available for the date range`);
      }
    } catch (error) {
      console.error(`[${tickerUpper}] Failed to fetch historical price:`, error);
    }

    const result = {
      ticker: tickerUpper,
      purchasePrice,
      isin,
      assetType,
      date: dateParam,
    };

    console.log(`[${tickerUpper}] ===== FINAL PURCHASE DATA =====`);
    console.log(`[${tickerUpper}] purchasePrice: ${purchasePrice} (${purchasePrice ? 'SET' : 'MISSING!'})`);
    console.log(`[${tickerUpper}] isin: ${isin} (${isin ? 'SET' : 'not available'})`);
    console.log(`[${tickerUpper}] assetType: ${assetType}`);
    console.log(`[${tickerUpper}] ================================`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching purchase data:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch purchase data' },
      { status: 500 }
    );
  }
}
