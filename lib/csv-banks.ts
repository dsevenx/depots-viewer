import { Bank } from './db';
import { arrayToCSV, csvToArray, downloadFile } from './csv-utils';

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
 * Parses CSV and returns array of banks (without id and createdAt)
 */
export function parseBankCSV(csvContent: string): Omit<Bank, 'id' | 'createdAt'>[] {
  const rows = csvToArray(csvContent);

  return rows.map(row => {
    if (!row.name || !row.name.trim()) {
      throw new Error('Bank-Name ist ein Pflichtfeld');
    }

    return {
      name: row.name.trim(),
      notes: row.notes?.trim() || undefined,
      createdAt: new Date()
    };
  });
}
