import { Position } from './db';
import { arrayToCSV, csvToArray, downloadFile } from './csv-utils';

export interface PositionImportRow extends Omit<Position, 'id'> {
  _rowNumber: number;
  _error?: string;
}

export interface PositionParseResult {
  success: Omit<Position, 'id'>[];
  errors: { row: number; error: string }[];
  allRows: PositionImportRow[];
}

const POSITION_CSV_HEADERS = [
  'isin',
  'ticker',
  'assetType',
  'purchaseDate',
  'quantity',
  'purchasePrice',
  'currency',
  'notes',
  'nominalValue',
  'couponRate'
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
      notes: 'Tech-Aktie',
      nominalValue: '',
      couponRate: ''
    },
    {
      isin: 'IE00B4L5Y983',
      ticker: 'IWDA',
      assetType: 'etf',
      purchaseDate: '2024-02-01',
      quantity: '50',
      purchasePrice: '78.25',
      currency: 'EUR',
      notes: 'MSCI World ETF',
      nominalValue: '',
      couponRate: ''
    },
    {
      isin: 'DE0001135085',
      ticker: 'DBR',
      assetType: 'bond',
      purchaseDate: '2024-03-01',
      quantity: '1',
      purchasePrice: '10000',
      currency: 'EUR',
      notes: 'Bundesanleihe',
      nominalValue: '10000',
      couponRate: '4'
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
    notes: pos.notes || '',
    nominalValue: pos.nominalValue || '',
    couponRate: pos.couponRate || ''
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

  // Parse bond-specific fields
  let nominalValue: number | undefined;
  let couponRate: number | undefined;

  if (assetType === 'bond') {
    // For bonds, nominalValue and couponRate are required
    if (row.nominalValue?.trim()) {
      nominalValue = parseFloat(row.nominalValue.trim());
      if (isNaN(nominalValue) || nominalValue <= 0) {
        throw new Error('Nominalwert muss eine positive Zahl sein');
      }
    } else {
      throw new Error('Nominalwert ist für Anleihen ein Pflichtfeld');
    }

    if (row.couponRate?.trim()) {
      couponRate = parseFloat(row.couponRate.trim());
      if (isNaN(couponRate) || couponRate < 0) {
        throw new Error('Kupon muss eine nicht-negative Zahl sein');
      }
    } else {
      throw new Error('Kupon ist für Anleihen ein Pflichtfeld');
    }
  } else {
    // For stocks/ETFs, these fields are optional
    if (row.nominalValue?.trim()) {
      nominalValue = parseFloat(row.nominalValue.trim());
      if (isNaN(nominalValue)) {
        nominalValue = undefined;
      }
    }
    if (row.couponRate?.trim()) {
      couponRate = parseFloat(row.couponRate.trim());
      if (isNaN(couponRate)) {
        couponRate = undefined;
      }
    }
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
    nominalValue,
    couponRate,
    createdAt: new Date()
  };
}

/**
 * Parses CSV and returns result with successful positions, errors, and all rows for preview
 */
export function parsePositionCSV(
  csvContent: string,
  bankId: number
): PositionParseResult {
  const rows = csvToArray(csvContent);
  const success: Omit<Position, 'id'>[] = [];
  const errors: { row: number; error: string }[] = [];
  const allRows: PositionImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because: +1 for header, +1 for 1-based indexing
    try {
      const position = parsePositionRow(row, rowNumber, bankId);
      success.push(position);
      allRows.push({
        ...position,
        _rowNumber: rowNumber
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      errors.push({
        row: rowNumber,
        error: errorMessage
      });
      // Create partial row for preview (with raw values)
      allRows.push({
        bankId,
        isin: row.isin?.trim() || '',
        ticker: row.ticker?.trim() || '',
        assetType: (row.assetType?.trim().toLowerCase() as any) || 'stock',
        purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : new Date(),
        quantity: parseFloat(row.quantity) || 0,
        purchasePrice: parseFloat(row.purchasePrice) || 0,
        currency: (row.currency?.trim().toUpperCase() as any) || 'EUR',
        notes: row.notes?.trim(),
        nominalValue: row.nominalValue ? parseFloat(row.nominalValue) : undefined,
        couponRate: row.couponRate ? parseFloat(row.couponRate) : undefined,
        createdAt: new Date(),
        _rowNumber: rowNumber,
        _error: errorMessage
      });
    }
  });

  return { success, errors, allRows };
}
