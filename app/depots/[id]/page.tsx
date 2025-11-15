'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Bank, Position } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  downloadExamplePositionCSV,
  exportPositionsToCSV,
  parsePositionCSV,
} from '@/lib/csv-positions';
import { readFile } from '@/lib/csv-utils';
import { DropdownDepotViewer } from '@/app/components/DropdownDepotViewer';
import { useSharedStockData } from '@/lib/hooks/useSharedStockData';

export default function BankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = parseInt(params.id as string);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [editingPositionId, setEditingPositionId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    isin: '',
    ticker: '',
    assetType: 'stock' as 'stock' | 'etf' | 'bond',
    purchaseDate: '',
    quantity: '',
    purchasePrice: '',
    currency: 'EUR' as 'EUR' | 'USD',
    notes: '',
  });
  const [isLoadingPurchaseData, setIsLoadingPurchaseData] = useState(false);
  const [isLoadingEditPurchaseData, setIsLoadingEditPurchaseData] = useState(false);

  // Shared stock data
  const { stockPrices, historicalData, isLoadingData, fetchStockData, hasData } = useSharedStockData();

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

    // Auto-close date picker popup after selection
    if (name === 'purchaseDate' && value && e.target instanceof HTMLInputElement) {
      e.target.blur();
    }
  };

  const handleLoadPurchaseData = async () => {
    if (!formData.ticker || !formData.purchaseDate) {
      alert('Bitte Ticker und Kaufdatum eingeben');
      return;
    }

    setIsLoadingPurchaseData(true);

    try {
      const response = await fetch(
        `/api/stock/${formData.ticker}/purchase-data?date=${formData.purchaseDate}`
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Daten');
      }

      const data = await response.json();

      // Update form with loaded data
      setFormData((prev) => ({
        ...prev,
        isin: data.isin || prev.isin,
        assetType: data.assetType || prev.assetType,
        purchasePrice: data.purchasePrice ? data.purchasePrice.toString() : prev.purchasePrice,
      }));

      console.log('Loaded purchase data:', data);
    } catch (error) {
      console.error('Failed to load purchase data:', error);
      alert('Fehler beim Laden der Kaufdaten von Yahoo Finance');
    } finally {
      setIsLoadingPurchaseData(false);
    }
  };

  const handleLoadEditPurchaseData = async () => {
    if (!editFormData.ticker || !editFormData.purchaseDate) {
      alert('Bitte Ticker und Kaufdatum eingeben');
      return;
    }

    setIsLoadingEditPurchaseData(true);

    try {
      const response = await fetch(
        `/api/stock/${editFormData.ticker}/purchase-data?date=${editFormData.purchaseDate}`
      );

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Daten');
      }

      const data = await response.json();

      // Update form with loaded data
      setEditFormData((prev) => ({
        ...prev,
        isin: data.isin || prev.isin,
        assetType: data.assetType || prev.assetType,
        purchasePrice: data.purchasePrice ? data.purchasePrice.toString() : prev.purchasePrice,
      }));

      console.log('Loaded purchase data:', data);
    } catch (error) {
      console.error('Failed to load purchase data:', error);
      alert('Fehler beim Laden der Kaufdaten von Yahoo Finance');
    } finally {
      setIsLoadingEditPurchaseData(false);
    }
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

  const handleEditPosition = (position: Position) => {
    setEditingPositionId(position.id!);
    const purchaseDateStr = position.purchaseDate instanceof Date
      ? position.purchaseDate.toISOString().split('T')[0]
      : new Date(position.purchaseDate).toISOString().split('T')[0];

    setEditFormData({
      isin: position.isin,
      ticker: position.ticker,
      assetType: position.assetType,
      purchaseDate: purchaseDateStr,
      quantity: position.quantity.toString(),
      purchasePrice: position.purchasePrice.toString(),
      currency: position.currency,
      notes: position.notes || '',
    });
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-close date picker popup after selection
    if (name === 'purchaseDate' && value && e.target instanceof HTMLInputElement) {
      e.target.blur();
    }
  };

  const handleUpdatePosition = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormData.isin || !editFormData.ticker || !editFormData.purchaseDate ||
      !editFormData.quantity || !editFormData.purchasePrice || !editingPositionId) {
      alert('Bitte fülle alle Pflichtfelder aus');
      return;
    }

    try {
      await db.positions.update(editingPositionId, {
        isin: editFormData.isin.trim().toUpperCase(),
        ticker: editFormData.ticker.trim().toUpperCase(),
        assetType: editFormData.assetType,
        purchaseDate: new Date(editFormData.purchaseDate),
        quantity: parseFloat(editFormData.quantity),
        purchasePrice: parseFloat(editFormData.purchasePrice),
        currency: editFormData.currency,
        notes: editFormData.notes.trim() || undefined,
      });

      // Reset edit state
      setEditingPositionId(null);
      setEditFormData({
        isin: '',
        ticker: '',
        assetType: 'stock',
        purchaseDate: '',
        quantity: '',
        purchasePrice: '',
        currency: 'EUR',
        notes: '',
      });
    } catch (error) {
      console.error('Failed to update position:', error);
      alert('Fehler beim Aktualisieren der Position');
    }
  };

  const handleCancelEditPosition = () => {
    setEditingPositionId(null);
    setEditFormData({
      isin: '',
      ticker: '',
      assetType: 'stock',
      purchaseDate: '',
      quantity: '',
      purchasePrice: '',
      currency: 'EUR',
      notes: '',
    });
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

  // CSV Handlers
  const handleExportPositions = () => {
    if (!positions || positions.length === 0) {
      alert('Keine Positionen zum Exportieren vorhanden');
      return;
    }
    if (!bank) return;
    exportPositionsToCSV(positions, bank.name);
  };

  const handleImportPositions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFile(file);
      const result = parsePositionCSV(content, bankId);

      // Store result in sessionStorage
      sessionStorage.setItem('positions_import_preview', JSON.stringify(result));

      // Navigate to preview page
      router.push(`/depots/${bankId}/import-preview`);
    } catch (error) {
      console.error('Import failed:', error);
      alert(
        `Fehler beim Lesen der Datei: ${error instanceof Error ? error.message : 'Unbekannter Fehler'
        }`
      );

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Stock Price Handlers
  const handleFetchPrices = async () => {
    if (!positions || positions.length === 0) {
      alert('Keine Positionen zum Aktualisieren vorhanden');
      return;
    }

    const tickers = [...new Set(positions.map((p) => p.ticker))];

    try {
      await fetchStockData(tickers);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      alert('Fehler beim Laden der Kursdaten');
    }
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors mb-4"
            >
              ← Zurück zur Übersicht
            </Link>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                  {bank.name}
                </h1>
                {bank.notes && (
                  <p className="text-zinc-600 dark:text-zinc-400">{bank.notes}</p>
                )}
              </div>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors inline-flex items-center gap-2"
              >
                📊 Zum Dashboard
              </Link>
            </div>
          </div>

          {/* Action Buttons */}
          {!isAddingPosition && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setIsAddingPosition(true)}
                className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors text-sm inline-flex items-center gap-2"
              >
                <span>➕</span>
                <span>Position hinzufügen</span>
              </button>
              <button
                onClick={handleFetchPrices}
                disabled={isLoadingData || !positions || positions.length === 0}
                className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLoadingData ? '⏳' : '📈'}</span>
                <span>{isLoadingData ? 'Lädt...' : 'Kurse aktualisieren'}</span>
              </button>
              <button
                onClick={downloadExamplePositionCSV}
                className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors text-sm inline-flex items-center gap-2"
              >
                <span>📄</span>
                <span>Beispiel-CSV herunterladen</span>
              </button>
              <button
                onClick={handleExportPositions}
                className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors text-sm inline-flex items-center gap-2"
              >
                <span>💾</span>
                <span>Positionen exportieren</span>
              </button>
              <label className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors cursor-pointer text-sm inline-flex items-center gap-2">
                <span>📥</span>
                <span>Positionen importieren</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportPositions}
                  className="hidden"
                />
              </label>
            </div>
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
                  <DropdownDepotViewer
                    label="Asset-Typ"
                    value={formData.assetType}
                    onChange={(value) => setFormData(prev => ({ ...prev, assetType: value as 'stock' | 'etf' | 'bond' }))}
                    options={[
                      { value: 'stock', label: 'Aktie' },
                      { value: 'etf', label: 'ETF' },
                      { value: 'bond', label: 'Anleihe' },
                    ]}
                    required
                  />
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
                      className="w-full px-4 py-3 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                      style={{ minHeight: '48px' }}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleLoadPurchaseData}
                      disabled={!formData.ticker || !formData.purchaseDate || isLoadingPurchaseData}
                      className="w-full px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      title="Lädt Kaufpreis, ISIN und Asset-Typ vom Yahoo Finance"
                    >
                      <span>{isLoadingPurchaseData ? '⏳' : '🔄'}</span>
                      <span>{isLoadingPurchaseData ? 'Lädt...' : 'Daten von Yahoo laden'}</span>
                    </button>
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
                  <DropdownDepotViewer
                    label="Währung"
                    value={formData.currency}
                    onChange={(value) => setFormData(prev => ({ ...prev, currency: value as 'EUR' | 'USD' }))}
                    options={[
                      { value: 'EUR', label: 'EUR' },
                      { value: 'USD', label: 'USD' },
                    ]}
                    required
                  />
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

          {/* Portfolio Summary */}
          {positions && positions.length > 0 && Object.keys(stockPrices).length > 0 && (
            <div className="mb-6 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Portfolio-Übersicht
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">Einkaufswert</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(
                      positions.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0),
                      'EUR'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">Aktueller Wert</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(
                      positions.reduce((sum, p) => {
                        const price = stockPrices[p.ticker];
                        return sum + (price ? p.quantity * price.currentPrice : p.quantity * p.purchasePrice);
                      }, 0),
                      'EUR'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">Gewinn/Verlust</p>
                  <p className={`text-xl font-bold ${positions.reduce((sum, p) => {
                    const price = stockPrices[p.ticker];
                    const current = price ? p.quantity * price.currentPrice : p.quantity * p.purchasePrice;
                    const purchase = p.quantity * p.purchasePrice;
                    return sum + (current - purchase);
                  }, 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                    }`}>
                    {formatCurrency(
                      positions.reduce((sum, p) => {
                        const price = stockPrices[p.ticker];
                        const current = price ? p.quantity * price.currentPrice : p.quantity * p.purchasePrice;
                        const purchase = p.quantity * p.purchasePrice;
                        return sum + (current - purchase);
                      }, 0),
                      'EUR'
                    )}
                    {' '}
                    ({(positions.reduce((sum, p) => {
                      const price = stockPrices[p.ticker];
                      const current = price ? p.quantity * price.currentPrice : p.quantity * p.purchasePrice;
                      const purchase = p.quantity * p.purchasePrice;
                      return sum + (current - purchase);
                    }, 0) / positions.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0) * 100).toFixed(2)}%)
                  </p>
                </div>
              </div>
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
                const isEditing = editingPositionId === position.id;
                const stockPrice = stockPrices[position.ticker];
                const currentValue = stockPrice ? position.quantity * stockPrice.currentPrice : null;
                const gain = currentValue ? currentValue - totalValue : null;
                const gainPercent = gain && totalValue ? (gain / totalValue) * 100 : null;

                return (
                  <div
                    key={position.id}
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    {isEditing ? (
                      // Edit Form
                      <form onSubmit={handleUpdatePosition}>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                          Position bearbeiten
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              ISIN *
                            </label>
                            <input
                              type="text"
                              name="isin"
                              value={editFormData.isin}
                              onChange={handleEditInputChange}
                              required
                              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Ticker *
                            </label>
                            <input
                              type="text"
                              name="ticker"
                              value={editFormData.ticker}
                              onChange={handleEditInputChange}
                              required
                              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>
                          <DropdownDepotViewer
                            label="Asset-Typ"
                            value={editFormData.assetType}
                            onChange={(value) => setEditFormData(prev => ({ ...prev, assetType: value as 'stock' | 'etf' | 'bond' }))}
                            options={[
                              { value: 'stock', label: 'Aktie' },
                              { value: 'etf', label: 'ETF' },
                              { value: 'bond', label: 'Anleihe' },
                            ]}
                            required
                          />
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Kaufdatum *
                            </label>
                            <input
                              type="date"
                              name="purchaseDate"
                              value={editFormData.purchaseDate}
                              onChange={handleEditInputChange}
                              required
                              className="w-full px-4 py-3 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                              style={{ minHeight: '48px' }}
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={handleLoadEditPurchaseData}
                              disabled={!editFormData.ticker || !editFormData.purchaseDate || isLoadingEditPurchaseData}
                              className="w-full px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                              title="Lädt Kaufpreis, ISIN und Asset-Typ vom Yahoo Finance"
                            >
                              <span>{isLoadingEditPurchaseData ? '⏳' : '🔄'}</span>
                              <span>{isLoadingEditPurchaseData ? 'Lädt...' : 'Daten von Yahoo laden'}</span>
                            </button>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Anzahl *
                            </label>
                            <input
                              type="number"
                              name="quantity"
                              value={editFormData.quantity}
                              onChange={handleEditInputChange}
                              step="0.001"
                              min="0"
                              required
                              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Kaufpreis (pro Stück) *
                            </label>
                            <input
                              type="number"
                              name="purchasePrice"
                              value={editFormData.purchasePrice}
                              onChange={handleEditInputChange}
                              step="0.01"
                              min="0"
                              required
                              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                            />
                          </div>
                          <DropdownDepotViewer
                            label="Währung"
                            value={editFormData.currency}
                            onChange={(value) => setEditFormData(prev => ({ ...prev, currency: value as 'EUR' | 'USD' }))}
                            options={[
                              { value: 'EUR', label: 'EUR' },
                              { value: 'USD', label: 'USD' },
                            ]}
                            required
                          />
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Notizen (optional)
                            </label>
                            <textarea
                              name="notes"
                              value={editFormData.notes}
                              onChange={handleEditInputChange}
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
                            onClick={handleCancelEditPosition}
                            className="px-6 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </form>
                    ) : (
                      // Normal View
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                              {position.ticker}
                            </h3>
                            <span className="px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">
                              {position.assetType === 'stock' ? 'Aktie' : position.assetType === 'etf' ? 'ETF' : 'Anleihe'}
                            </span>
                            {stockPrice && gainPercent !== null && (
                              <span className={`px-2 py-1 text-xs font-medium rounded ${gainPercent >= 0
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                }`}>
                                {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                            ISIN: {position.isin}
                            {stockPrice?.name && <span className="ml-2">• {stockPrice.name}</span>}
                          </p>

                          {/* Current Price Info */}
                          {stockPrice && (
                            <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                                <div>
                                  <p className="text-zinc-500 dark:text-zinc-500">Aktueller Kurs</p>
                                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                    {formatCurrency(stockPrice.currentPrice, stockPrice.currency)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-zinc-500 dark:text-zinc-500">Aktueller Wert</p>
                                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                    {currentValue && formatCurrency(currentValue, position.currency)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-zinc-500 dark:text-zinc-500">Gewinn/Verlust</p>
                                  <p className={`font-medium ${gain && gain >= 0
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                    }`}>
                                    {gain && formatCurrency(gain, position.currency)}
                                  </p>
                                </div>
                              </div>
                              {/* Dividends Section */}
                              {(stockPrice.trailingDividendRate || stockPrice.dividendRate) && (
                                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    {/* Trailing (Current) Dividend */}
                                    {stockPrice.trailingDividendRate && (
                                      <>
                                        <div>
                                          <p className="text-zinc-500 dark:text-zinc-500">Akt. Div.</p>
                                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                            {formatCurrency(stockPrice.trailingDividendRate, stockPrice.currency)}
                                            <span className="text-xs text-zinc-500 ml-1">
                                              ({((stockPrice.trailingDividendRate / stockPrice.currentPrice) * 100).toFixed(2)}%)
                                            </span>
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-zinc-500 dark:text-zinc-500">Akt. Div. Gesamt</p>
                                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                            {formatCurrency(stockPrice.trailingDividendRate * position.quantity, stockPrice.currency)}
                                          </p>
                                        </div>
                                      </>
                                    )}
                                    {/* Forward (Estimated) Dividend */}
                                    {stockPrice.dividendRate && (
                                      <>
                                        <div>
                                          <p className="text-zinc-500 dark:text-zinc-500">Zuk. Div.</p>
                                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                            {formatCurrency(stockPrice.dividendRate, stockPrice.currency)}
                                            <span className="text-xs text-zinc-500 ml-1">
                                              ({((stockPrice.dividendRate / stockPrice.currentPrice) * 100).toFixed(2)}%)
                                            </span>
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-zinc-500 dark:text-zinc-500">Zuk. Div. Gesamt</p>
                                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                                            {formatCurrency(stockPrice.dividendRate * position.quantity, stockPrice.currency)}
                                          </p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Purchase Info */}
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
                              <p className="text-zinc-500 dark:text-zinc-500">Kaufwert gesamt</p>
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
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleEditPosition(position)}
                            className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => position.id && handleDeletePosition(position.id)}
                            className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    )}
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
