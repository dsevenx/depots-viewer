import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Extract WKN from German ISIN (e.g., DE0001135085 -> 113508)
function extractWKN(isin: string): string | null {
  if (isin.startsWith('DE') && isin.length === 12) {
    // German ISIN format: DE + 9 digits + 1 check digit
    // WKN is typically characters 3-8 (6 digits)
    return isin.substring(2, 8);
  }
  return null;
}

// Generate search variants for better results
function generateSearchVariants(query: string): string[] {
  const variants: string[] = [query];

  // If it looks like an ISIN
  if (query.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)) {
    // Try WKN for German ISINs
    if (query.startsWith('DE')) {
      const wkn = extractWKN(query);
      if (wkn) {
        variants.push(wkn);
        variants.push(`${wkn}.DE`);
        variants.push(`${wkn}.F`);
        variants.push(`${wkn}.BE`);
      }
    }

    // Try with common suffixes
    variants.push(`${query}.DE`);
    variants.push(`${query}.F`);
  }

  return variants;
}

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

    const searchVariants = generateSearchVariants(query);
    console.log(`[SEARCH] Generated search variants:`, searchVariants);

    const allResults = new Map<string, any>();

    // Try each search variant
    for (const variant of searchVariants) {
      try {
        console.log(`[SEARCH] Trying variant: ${variant}`);
        const searchResults = await yahooFinance.search(variant);

        console.log(`[SEARCH] Variant "${variant}" found ${searchResults.quotes?.length || 0} results`);

        if (searchResults.quotes && searchResults.quotes.length > 0) {
          // Add unique results (deduplicate by symbol)
          searchResults.quotes.forEach((quote: any) => {
            if (quote.symbol && !allResults.has(quote.symbol)) {
              allResults.set(quote.symbol, quote);
            }
          });
        }
      } catch (error) {
        console.warn(`[SEARCH] Variant "${variant}" failed:`, error);
        // Continue with next variant
      }
    }

    // Format results
    const results = Array.from(allResults.values()).map((quote: any) => ({
      symbol: quote.symbol,
      shortname: quote.shortname || quote.longname || '',
      longname: quote.longname || '',
      exchDisp: quote.exchDisp || '',
      typeDisp: quote.typeDisp || '',
      quoteType: quote.quoteType || '',
    }));

    console.log(`[SEARCH] Total unique results: ${results.length}`);

    return NextResponse.json({
      query,
      searchVariants,
      results,
      count: results.length,
    });
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
