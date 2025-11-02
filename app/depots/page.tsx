'use client';

import { useState } from 'react';
import Link from 'next/link';
import { db, Bank } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function DepotsPage() {
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankNotes, setBankNotes] = useState('');

  // Live query - updates automatically when data changes
  const banks = useLiveQuery(() => db.banks.toArray());
  const positions = useLiveQuery(() => db.positions.toArray());

  // Count positions per bank
  const getPositionCount = (bankId: number) => {
    return positions?.filter((p) => p.bankId === bankId).length || 0;
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName.trim()) return;

    try {
      await db.banks.add({
        name: bankName.trim(),
        notes: bankNotes.trim() || undefined,
        createdAt: new Date(),
      });

      // Reset form
      setBankName('');
      setBankNotes('');
      setIsAddingBank(false);
    } catch (error) {
      console.error('Failed to add bank:', error);
      alert('Fehler beim Hinzufügen der Bank');
    }
  };

  const handleDeleteBank = async (id: number) => {
    if (!confirm('Bank wirklich löschen?')) return;

    try {
      await db.banks.delete(id);
    } catch (error) {
      console.error('Failed to delete bank:', error);
      alert('Fehler beim Löschen der Bank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Meine Depots
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Verwalte deine Banken und Broker
            </p>
          </div>

          {/* Add Bank Button */}
          {!isAddingBank && (
            <button
              onClick={() => setIsAddingBank(true)}
              className="mb-6 px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              + Bank hinzufügen
            </button>
          )}

          {/* Add Bank Form */}
          {isAddingBank && (
            <div className="mb-6 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Neue Bank hinzufügen
              </h2>
              <form onSubmit={handleAddBank}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="bankName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Bank/Broker Name *
                    </label>
                    <input
                      type="text"
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="z.B. Comdirect, Trade Republic"
                      required
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="bankNotes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Notizen (optional)
                    </label>
                    <textarea
                      id="bankNotes"
                      value={bankNotes}
                      onChange={(e) => setBankNotes(e.target.value)}
                      placeholder="Zusätzliche Informationen..."
                      rows={2}
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-zinc-500 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBank(false);
                        setBankName('');
                        setBankNotes('');
                      }}
                      className="px-6 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Banks List */}
          <div className="space-y-4">
            {!banks || banks.length === 0 ? (
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-8 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Noch keine Banken angelegt. Klicke auf &quot;Bank hinzufügen&quot; um zu starten.
                </p>
              </div>
            ) : (
              banks.map((bank) => {
                const positionCount = bank.id ? getPositionCount(bank.id) : 0;
                return (
                  <div
                    key={bank.id}
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                          {bank.name}
                        </h3>
                        {bank.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            {bank.notes}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-3">
                          Erstellt: {new Date(bank.createdAt).toLocaleDateString('de-DE')} • {positionCount} Position{positionCount !== 1 ? 'en' : ''}
                        </p>
                        <Link
                          href={`/depots/${bank.id}`}
                          className="inline-block px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                        >
                          Positionen verwalten →
                        </Link>
                      </div>
                      <button
                        onClick={() => bank.id && handleDeleteBank(bank.id)}
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
