import { Bank } from './db';
import { arrayToCSV, csvToArray, downloadFile } from './csv-utils';

export interface BankImportRow extends Omit<Bank, 'id'> {
  _rowNumber: number;
  _error?: string;
}

export interface BankParseResult {
  success: Omit<Bank, 'id'>[];
  errors: { row: number; error: string }[];
  allRows: BankImportRow[];
}

const BANK_CSV_HEADERS = ['name', 'notes'];

/**
 * Downloads example bank CSV file
 */
export function downloadExampleBankCSV() {
  const exampleBanks = [
    {
      name: 'Beispielbank AG',
      notes: 'Mein Hauptdepot'
    },
    {
      name: 'Broker XYZ',
      notes: 'Für ETF-Sparpläne'
    }
  ];

  const csv = arrayToCSV(exampleBanks, BANK_CSV_HEADERS);
  downloadFile(csv, 'banken-beispiel.csv');
}

/**
 * Exports all banks to CSV and downloads it
 */
export function exportBanksToCSV(banks: Bank[]) {
  if (banks.length === 0) {
    alert('Keine Banken zum Exportieren vorhanden');
    return;
  }

  const banksForExport = banks.map(bank => ({
    name: bank.name,
    notes: bank.notes || ''
  }));

  const csv = arrayToCSV(banksForExport, BANK_CSV_HEADERS);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `banken-export-${timestamp}.csv`);
}

/**
 * Parses a single bank row from CSV
 */
function parseBankRow(row: Record<string, string>, rowIndex: number): Omit<Bank, 'id'> {
  if (!row.name || !row.name.trim()) {
    throw new Error('Bank-Name ist ein Pflichtfeld');
  }

  return {
    name: row.name.trim(),
    notes: row.notes?.trim() || undefined,
    createdAt: new Date()
  };
}

/**
 * Parses CSV and returns result with successful banks, errors, and all rows for preview
 */
export function parseBankCSV(csvContent: string): BankParseResult {
  const rows = csvToArray(csvContent);
  const success: Omit<Bank, 'id'>[] = [];
  const errors: { row: number; error: string }[] = [];
  const allRows: BankImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because: +1 for header, +1 for 1-based indexing
    try {
      const bank = parseBankRow(row, rowNumber);
      success.push(bank);
      allRows.push({
        ...bank,
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
        name: row.name?.trim() || '',
        notes: row.notes?.trim(),
        createdAt: new Date(),
        _rowNumber: rowNumber,
        _error: errorMessage
      });
    }
  });

  return { success, errors, allRows };
}
