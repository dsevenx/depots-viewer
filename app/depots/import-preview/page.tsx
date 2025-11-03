'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, Bank } from '@/lib/db';

interface BankImportRow extends Omit<Bank, 'id'> {
  _rowNumber: number;
  _error?: string;
}

interface ImportPreviewData {
  success: Omit<Bank, 'id'>[];
  errors: { row: number; error: string }[];
  allRows: BankImportRow[];
}

export default function BankImportPreviewPage() {
  const router = useRouter();
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load preview data from sessionStorage
    const dataStr = sessionStorage.getItem('banks_import_preview');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setPreviewData(data);
      } catch (error) {
        console.error('Failed to parse preview data:', error);
        router.push('/depots');
      }
    } else {
      // No data, redirect back
      router.push('/depots');
    }
  }, [router]);

  const handleCancel = () => {
    sessionStorage.removeItem('banks_import_preview');
    router.push('/depots');
  };

  const handleOverwrite = async () => {
    if (!previewData || previewData.errors.length > 0) return;

    setIsProcessing(true);
    try {
      // Delete all existing banks (and cascade delete positions)
      const allBanks = await db.banks.toArray();
      for (const bank of allBanks) {
        if (bank.id) {
          await db.positions.where('bankId').equals(bank.id).delete();
          await db.banks.delete(bank.id);
        }
      }

      // Add all new banks
      for (const bank of previewData.success) {
        await db.banks.add(bank);
      }

      sessionStorage.removeItem('banks_import_preview');
      alert(`${previewData.success.length} Banken erfolgreich importiert (alle Depots überschrieben)`);
      router.push('/depots');
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
      // Add all new banks
      for (const bank of previewData.success) {
        await db.banks.add(bank);
      }

      sessionStorage.removeItem('banks_import_preview');
      alert(`${previewData.success.length} Banken erfolgreich hinzugefügt`);
      router.push('/depots');
    } catch (error) {
      console.error('Import failed:', error);
      alert('Fehler beim Importieren');
      setIsProcessing(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (!previewData) {
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
              Import-Vorschau: Banken
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Überprüfe die zu importierenden Banken
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
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Name</th>
                    <th className="px-4 py-3 text-left text-zinc-700 dark:text-zinc-300">Notizen</th>
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
                          {row.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {row.notes || '-'}
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
              className="px-6 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abbrechen
            </button>
            <button
              onClick={handleOverwrite}
              disabled={!canImport || isProcessing}
              className="px-6 py-3 bg-orange-600 dark:bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Wird importiert...' : 'Alle Depots überschreiben'}
            </button>
            <button
              onClick={handleAppend}
              disabled={!canImport || isProcessing}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Wird importiert...' : 'Banken hinzufügen'}
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
