'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Bank, Position } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function BankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = parseInt(params.id as string);

  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [formData, setFormData] = useState({
    isin: '',
    ticker: '',
    assetType: 'stock' as 'stock' | 'etf' | 'bond',
    purchaseDate: '',
    quantity: '',
    purchasePrice: '',
    currency: 'EUR' as 'EUR' | 'USD',
    notes: '',
  });

  // Live queries
  const bank = useLiveQuery(() => db.banks.get(bankId));
  const positions = useLiveQuery(
    () => db.positions.where('bankId').equals(bankId).toArray(),
    [bankId]
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.isin || !formData.ticker || !formData.purchaseDate || !formData.quantity || !formData.purchasePrice) {
      alert('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    try {
      await db.positions.add({
        bankId,
        isin: formData.isin.trim().toUpperCase(),
        ticker: formData.ticker.trim().toUpperCase(),
        assetType: formData.assetType,
        purchaseDate: new Date(formData.purchaseDate),
        quantity: parseFloat(formData.quantity),
        purchasePrice: parseFloat(formData.purchasePrice),
        currency: formData.currency,
        notes: formData.notes.trim() || undefined,
        createdAt: new Date(),
      });

      // Reset form
      setFormData({
        isin: '',
        ticker: '',
        assetType: 'stock',
        purchaseDate: '',
        quantity: '',
        purchasePrice: '',
        currency: 'EUR',
        notes: '',
      });
      setIsAddingPosition(false);
    } catch (error) {
      console.error('Failed to add position:', error);
      alert('Fehler beim Hinzufügen der Position');
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!confirm('Position wirklich löschen?')) return;

    try {
      await db.positions.delete(id);
    } catch (error) {
      console.error('Failed to delete position:', error);
      alert('Fehler beim Löschen der Position');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (!bank) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Bank nicht gefunden</p>
          <Link
            href="/depots"
            className="text-zinc-900 dark:text-zinc-50 hover:underline"
          >
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/depots"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-2 inline-block"
            >
              ← Zurück zur Übersicht
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              {bank.name}
            </h1>
            {bank.notes && (
              <p className="text-zinc-600 dark:text-zinc-400">{bank.notes}</p>
            )}
          </div>

          {/* Add Position Button */}
          {!isAddingPosition && (
            <button
              onClick={() => setIsAddingPosition(true)}
              className="mb-6 px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              + Position hinzufügen
            </button>
          )}

          {/* Add Position Form */}
          {isAddingPosition && (
            <div className="mb-6 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Neue Position hinzufügen
              </h2>
              <form onSubmit={handleAddPosition}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="isin" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      ISIN *
                    </label>
                    <input
                      type="text"
                      id="isin"
                      name="isin"
                      value={formData.isin}
                      onChange={handleInputChange}
                      placeholder="z.B. US5949181045"
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="ticker" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Ticker *
                    </label>
                    <input
                      type="text"
                      id="ticker"
                      name="ticker"
                      value={formData.ticker}
                      onChange={handleInputChange}
                      placeholder="z.B. MSFT"
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="assetType" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Asset-Typ *
                    </label>
                    <select
                      id="assetType"
                      name="assetType"
                      value={formData.assetType}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value="stock">Aktie</option>
                      <option value="etf">ETF</option>
                      <option value="bond">Anleihe</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="purchaseDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Kaufdatum *
                    </label>
                    <input
                      type="date"
                      id="purchaseDate"
                      name="purchaseDate"
                      value={formData.purchaseDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Anzahl *
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      placeholder="z.B. 10"
                      step="0.001"
                      min="0"
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="purchasePrice" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Kaufpreis (pro Stück) *
                    </label>
                    <input
                      type="number"
                      id="purchasePrice"
                      name="purchasePrice"
                      value={formData.purchasePrice}
                      onChange={handleInputChange}
                      placeholder="z.B. 350.50"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="currency" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Währung *
                    </label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Notizen (optional)
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Zusätzliche Informationen..."
                      rows={2}
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPosition(false);
                      setFormData({
                        isin: '',
                        ticker: '',
                        assetType: 'stock',
                        purchaseDate: '',
                        quantity: '',
                        purchasePrice: '',
                        currency: 'EUR',
                        notes: '',
                      });
                    }}
                    className="px-6 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Positions List */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Positionen ({positions?.length || 0})
            </h2>

            {!positions || positions.length === 0 ? (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-8 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Noch keine Positionen angelegt. Klicke auf &quot;Position hinzufügen&quot; um zu starten.
                </p>
              </div>
            ) : (
              positions.map((position) => {
                const totalValue = position.quantity * position.purchasePrice;
                return (
                  <div
                    key={position.id}
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                            {position.ticker}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">
                            {position.assetType === 'stock' ? 'Aktie' : position.assetType === 'etf' ? 'ETF' : 'Anleihe'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                          ISIN: {position.isin}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-500">Anzahl</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {position.quantity}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-500">Kaufpreis</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {formatCurrency(position.purchasePrice, position.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-500">Gesamtwert</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {formatCurrency(totalValue, position.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-500">Kaufdatum</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {formatDate(position.purchaseDate)}
                            </p>
                          </div>
                        </div>
                        {position.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-3">
                            {position.notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => position.id && handleDeletePosition(position.id)}
                        className="ml-4 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
