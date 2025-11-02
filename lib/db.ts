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
}

// Database class
export class DepotsDatabase extends Dexie {
  banks!: Table<Bank>;
  positions!: Table<Position>;

  constructor() {
    super('DepotsViewerDB');

    this.version(1).stores({
      banks: '++id, name, createdAt',
      positions: '++id, bankId, isin, ticker, assetType, purchaseDate, currency, createdAt'
    });
  }
}

export const db = new DepotsDatabase();
