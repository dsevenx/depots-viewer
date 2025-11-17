import Dexie, { Table } from 'dexie';

// Bank/Broker interface
export interface Bank {
  id?: number;
  name: string;
  notes?: string;
  createdAt: Date;
}

// Position interface
export interface Position {
  id?: number;
  bankId: number;
  isin: string;
  ticker: string;
  assetType: 'stock' | 'etf' | 'bond';
  purchaseDate: Date;
  quantity: number;
  purchasePrice: number;
  currency: 'EUR' | 'USD';
  notes?: string;
  createdAt: Date;
  // Bond-specific fields
  nominalValue?: number; // Nominalwert für Anleihen (z.B. 10000)
  couponRate?: number; // Kupon in Prozent (z.B. 4 für 4%)
}

// Database class
export class DepotsDatabase extends Dexie {
  banks!: Table<Bank>;
  positions!: Table<Position>;

  constructor() {
    super('DepotsViewerDB');

    // Version 1: Initial schema
    this.version(1).stores({
      banks: '++id, name, createdAt',
      positions: '++id, bankId, isin, ticker, assetType, purchaseDate, currency, createdAt'
    });

    // Version 2: Add bond-specific fields
    this.version(2).stores({
      banks: '++id, name, createdAt',
      positions: '++id, bankId, isin, ticker, assetType, purchaseDate, currency, createdAt'
    });
  }
}

export const db = new DepotsDatabase();
