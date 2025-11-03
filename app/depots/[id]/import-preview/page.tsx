'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db, Position } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface ImportPreviewData {
  success: Omit<Position, 'id'>[];
  errors: { row: number; error: string }[];
  allRows: Array<Omit<Position, 'id'> & { _rowNumber: number; _error?: string }>;
}

export default function PositionImportPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = parseInt(params.id as string);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const bank = useLiveQuery(() => db.banks.get(bankId));

  useEffect(() => {
    // Load preview data from sessionStorage
    const dataStr = sessionStorage.getItem('positions_import_preview');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setPreviewData(data);
      } catch (error) {
        console.error('Failed to parse preview data:', error);
        router.push(`/depots/${bankId}`);
      }
    } else {
      // No data, redirect back
      router.push(`/depots/${bankId}`);
    }
  }, [bankId, router]);

  const handleCancel = () => {
    sessionStorage.removeItem('positions_import_preview');
    router.push(`/depots/${bankId}`);
  };

  const handleOverwrite = async () => {
    if (!previewData || previewData.errors.length > 0) return;

    setIsProcessing(true);
    try {
      // Delete all existing positions for this bank
      await db.positions.where('bankId').equals(bankId).delete();

      // Add all new positions
      for (const position of previewData.success) {
        await db.positions.add(position);
      }

      sessionStorage.removeItem('positions_import_preview');
      alert(`${previewData.success.length} Positionen erfolgreich importiert (Depot überschrieben)`);
      router.push(`/depots/${bankId}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Fehler beim Importieren');
      setIsProcessing(false);
    }
  };

  const handleAppend = async () => {
    if (!previewData || previewData.errors.length > 0) return;

    setIsProcessing(true);
    try {
      // Add all new positions
      for (const position of previewData.success) {
        await db.positions.add(position);
      }

      sessionStorage.removeItem('positions_import_preview');
      alert(`${previewData.success.length} Positionen erfolgreich hinzugefügt`);
      router.push(`/depots/${bankId}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Fehler beim Importieren');
      setIsProcessing(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (!bank || !previewData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Lade Vorschau...</p>
      </div>
    );
  }

  const hasErrors = previewData.errors.length > 0;
  const canImport = !hasErrors;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Import-Vorschau: {bank.name}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Überprüfe die zu importierenden Positionen
            </p>
          </div>

          {/* Summary */}
          <div className="mb-6 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Gültige Zeilen</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {previewData.success.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Fehlerhafte Zeilen</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {previewData.errors.length}
                </p>
              </div>
            </div>
            {hasErrors && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                  Fehler gefunden:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {previewData.errors.map((err, idx) => (
                    <li key={idx}>
                      Zeile {err.row}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Preview Table */}
          <div className="mb-6 bg-white dark:bg-zinc-800 rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Zeile</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">ISIN</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Ticker</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Typ</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Anzahl</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Preis</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Währung</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Datum</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.allRows.map((row, idx) => {
                    const hasError = !!row._error;
                    return (
                      <tr
                        key={idx}
                        className={`border-t border-zinc-200 dark:border-zinc-700 ${
                          hasError ? 'bg-red-50 dark:bg-red-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row._rowNumber}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.isin || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.ticker || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.assetType || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.quantity || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.purchasePrice || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.currency || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.purchaseDate ? formatDate(row.purchaseDate) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {hasError ? (
                            <span className="text-red-600 dark:text-red-400 text-xs">
                              {row._error}
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 text-xs">
                              ✓ OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="px-6 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <span>✕</span>
              <span>Abbrechen</span>
            </button>
            <button
              onClick={handleOverwrite}
              disabled={!canImport || isProcessing}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <span>🔄</span>
              <span>{isProcessing ? 'Wird importiert...' : 'Depot überschreiben'}</span>
            </button>
            <button
              onClick={handleAppend}
              disabled={!canImport || isProcessing}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <span>➕</span>
              <span>{isProcessing ? 'Wird importiert...' : 'Depot ergänzen'}</span>
            </button>
          </div>

          {!canImport && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              Import ist nur möglich, wenn keine Pflichtfeld-Fehler vorhanden sind. Bitte korrigiere die CSV-Datei und importiere erneut.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
