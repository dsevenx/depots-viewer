import { Position } from './db';
import { arrayToCSV, csvToArray, downloadFile, ParseResult } from './csv-utils';

const POSITION_CSV_HEADERS = [
  'isin',
  'ticker',
  'assetType',
  'purchaseDate',
  'quantity',
  'purchasePrice',
  'currency',
  'notes'
];

/**
 * Downloads example position CSV file
 */
export function downloadExamplePositionCSV() {
  const examplePositions = [
    {
      isin: 'US0378331005',
      ticker: 'AAPL',
      assetType: 'stock',
      purchaseDate: '2024-01-15',
      quantity: '10',
      purchasePrice: '185.50',
      currency: 'USD',
      notes: 'Tech-Aktie'
    },
    {
      isin: 'IE00B4L5Y983',
      ticker: 'IWDA',
      assetType: 'etf',
      purchaseDate: '2024-02-01',
      quantity: '50',
      purchasePrice: '78.25',
      currency: 'EUR',
      notes: 'MSCI World ETF'
    }
  ];

  const csv = arrayToCSV(examplePositions, POSITION_CSV_HEADERS);
  downloadFile(csv, 'positionen-beispiel.csv');
}

/**
 * Exports all positions of a bank to CSV and downloads it
 */
export function exportPositionsToCSV(positions: Position[], bankName: string) {
  if (positions.length === 0) {
    alert('Keine Positionen zum Exportieren vorhanden');
    return;
  }

  const positionsForExport = positions.map(pos => ({
    isin: pos.isin,
    ticker: pos.ticker,
    assetType: pos.assetType,
    purchaseDate: pos.purchaseDate instanceof Date
      ? pos.purchaseDate
      : new Date(pos.purchaseDate),
    quantity: pos.quantity,
    purchasePrice: pos.purchasePrice,
    currency: pos.currency,
    notes: pos.notes || ''
  }));

  const csv = arrayToCSV(positionsForExport, POSITION_CSV_HEADERS);
  const timestamp = new Date().toISOString().split('T')[0];
  const safeBankName = bankName.replace(/[^a-zA-Z0-9]/g, '-');
  downloadFile(csv, `positionen-${safeBankName}-${timestamp}.csv`);
}

/**
 * Parses a single position row from CSV
 */
function parsePositionRow(
  row: Record<string, string>,
  rowIndex: number,
  bankId: number
): Omit<Position, 'id'> {
  // Validate required fields
  if (!row.isin?.trim()) {
    throw new Error('ISIN ist ein Pflichtfeld');
  }
  if (!row.ticker?.trim()) {
    throw new Error('Ticker ist ein Pflichtfeld');
  }
  if (!row.assetType?.trim()) {
    throw new Error('Asset-Typ ist ein Pflichtfeld');
  }
  if (!row.purchaseDate?.trim()) {
    throw new Error('Kaufdatum ist ein Pflichtfeld');
  }
  if (!row.quantity?.trim()) {
    throw new Error('Anzahl ist ein Pflichtfeld');
  }
  if (!row.purchasePrice?.trim()) {
    throw new Error('Kaufpreis ist ein Pflichtfeld');
  }
  if (!row.currency?.trim()) {
    throw new Error('Währung ist ein Pflichtfeld');
  }

  // Validate assetType
  const assetType = row.assetType.trim().toLowerCase();
  if (!['stock', 'etf', 'bond'].includes(assetType)) {
    throw new Error("Asset-Typ muss 'stock', 'etf' oder 'bond' sein");
  }

  // Validate currency
  const currency = row.currency.trim().toUpperCase();
  if (!['EUR', 'USD'].includes(currency)) {
    throw new Error("Währung muss 'EUR' oder 'USD' sein");
  }

  // Parse numbers
  const quantity = parseFloat(row.quantity.trim());
  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Anzahl muss eine positive Zahl sein');
  }

  const purchasePrice = parseFloat(row.purchasePrice.trim());
  if (isNaN(purchasePrice) || purchasePrice <= 0) {
    throw new Error('Kaufpreis muss eine positive Zahl sein');
  }

  // Parse date
  const purchaseDate = new Date(row.purchaseDate.trim());
  if (isNaN(purchaseDate.getTime())) {
    throw new Error('Kaufdatum hat ungültiges Format (erwartetes Format: YYYY-MM-DD)');
  }

  return {
    bankId,
    isin: row.isin.trim().toUpperCase(),
    ticker: row.ticker.trim().toUpperCase(),
    assetType: assetType as 'stock' | 'etf' | 'bond',
    purchaseDate,
    quantity,
    purchasePrice,
    currency: currency as 'EUR' | 'USD',
    notes: row.notes?.trim() || undefined,
    createdAt: new Date()
  };
}

/**
 * Parses CSV and returns result with successful positions and errors
 */
export function parsePositionCSV(
  csvContent: string,
  bankId: number
): ParseResult<Omit<Position, 'id'>> {
  const rows = csvToArray(csvContent);
  const success: Omit<Position, 'id'>[] = [];
  const errors: { row: number; error: string }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because: +1 for header, +1 for 1-based indexing
    try {
      const position = parsePositionRow(row, rowNumber, bankId);
      success.push(position);
    } catch (error) {
      errors.push({
        row: rowNumber,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });

  return { success, errors };
}
