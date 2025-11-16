import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[SEARCH] Searching for: ${query}`);

    try {
      const searchResults = await yahooFinance.search(query);

      console.log(`[SEARCH] Found ${searchResults.quotes?.length || 0} results`);

      // Filter and format results
      const results = (searchResults.quotes || []).map((quote: any) => ({
        symbol: quote.symbol,
        shortname: quote.shortname || quote.longname || '',
        longname: quote.longname || '',
        exchDisp: quote.exchDisp || '',
        typeDisp: quote.typeDisp || '',
        quoteType: quote.quoteType || '',
      }));

      console.log(`[SEARCH] Returning ${results.length} formatted results`);

      return NextResponse.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('[SEARCH] Yahoo Finance search failed:', error);

      // Return empty results instead of error
      return NextResponse.json({
        query,
        results: [],
        count: 0,
        warning: 'Search returned no results',
      });
    }
  } catch (error) {
    console.error('Error in search route:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
