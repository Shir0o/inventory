import React, { useState, useMemo } from 'react';
import { Title, SettingsData, Category, Person } from '../types';
import { Plus, Trash2, Shield, Save, RotateCcw, Sparkles, Database, ShieldCheck } from 'lucide-react';
import { InventoryCleanupModal } from './InventoryCleanupModal';
import { analyzeInventory } from '../services/inventoryCleanupService';

interface SettingsViewProps {
  titles: Title[];
  rawInventory?: any[];
  settings: SettingsData;
  onSaveSettings: (next: SettingsData) => void;
}

const CATS: Category[] = ['Bible', 'Booklet', 'Tract'];
const PLURAL: Record<Category, string> = { Bible: 'Bibles', Booklet: 'Booklets', Tract: 'Tracts' };

export const SettingsView: React.FC<SettingsViewProps> = ({
  titles,
  rawInventory = [],
  settings,
  onSaveSettings
}) => {
  const [draft, setDraft] = useState<SettingsData>(() => JSON.parse(JSON.stringify(settings)));
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<'Admin' | 'View only'>('View only');
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);

  const cleanupPlan = useMemo(() => {
    return analyzeInventory(rawInventory);
  }, [rawInventory]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const getFlaggedCountForCat = (cat: Category, threshold: number) => {
    let count = 0;
    titles.filter(t => t.cat === cat).forEach(t => {
      t.editions.forEach(ed => {
        if (ed.stock < threshold) count++;
      });
    });
    return count;
  };

  const handleAddPersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim() || !newPersonEmail.trim()) return;

    const newPerson: Person = {
      id: `p-${Date.now()}`,
      name: newPersonName.trim(),
      email: newPersonEmail.trim(),
      role: newPersonRole
    };

    setDraft({
      ...draft,
      people: [...draft.people, newPerson]
    });
    setNewPersonName('');
    setNewPersonEmail('');
    setShowAddPerson(false);
  };

  const handleRemovePerson = (id: string) => {
    setDraft({
      ...draft,
      people: draft.people.filter(p => p.id !== id)
    });
  };

  const handleToggleRole = (id: string) => {
    setDraft({
      ...draft,
      people: draft.people.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          role: p.role === 'Admin' ? 'View only' : 'Admin'
        };
      })
    });
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3]">
        <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Settings</h1>
        <p className="text-[13.5px] text-[#44474e] mt-1">
          Reorder thresholds, pack rounding, roles, and hall configuration.
        </p>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-8">
        <div className="max-w-3xl space-y-8 pb-12">
          {/* Hall Name Setting */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold tracking-tight text-[#191c20]">Hall & Workspace</h2>
            <div className="p-4 border border-[#dcdee3] rounded-lg bg-white space-y-3 shadow-xs">
              <div>
                <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                  Hall name
                </label>
                <input
                  type="text"
                  value={draft.hallName}
                  onChange={(e) => setDraft({ ...draft, hallName: e.target.value })}
                  placeholder="e.g. CISA Inventory"
                  className="w-full sm:w-80 px-3 py-2 border border-[#c9cbd2] rounded-md text-[13.5px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
                />
              </div>
              <p className="text-[12px] text-[#8b8e96]">
                Appears at the top of the navigation rail and export headers.
              </p>
            </div>
          </div>

          {/* Reorder Points Setting */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold tracking-tight text-[#191c20]">Reorder points per category</h2>
            <p className="text-[13px] text-[#6c6f77]">
              When an edition falls below this number in store, it is flagged as needing reorder.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CATS.map(cat => {
                const currentVal = draft.reorder[cat] || 0;
                const flaggedCount = getFlaggedCountForCat(cat, currentVal);

                return (
                  <div key={cat} className="p-4 border border-[#dcdee3] rounded-lg bg-white space-y-2 shadow-xs">
                    <div className="font-bold text-[14px] text-[#191c20]">
                      {PLURAL[cat]}
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={currentVal}
                        onChange={(e) => {
                          const num = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setDraft({
                            ...draft,
                            reorder: { ...draft.reorder, [cat]: num }
                          });
                        }}
                        className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md font-mono text-[14px] font-bold text-right text-[#191c20] bg-white outline-none focus:border-[#1f5f8b] tabular-nums"
                      />
                    </div>
                    <div className="text-[11.5px] text-[#8a5a00] font-medium">
                      Flagged at this point: {flaggedCount} {flaggedCount === 1 ? 'edition' : 'editions'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pack Sizes Setting */}
          <div className="space-y-3">
            <h2 className="text-[17px] font-bold tracking-tight text-[#191c20]">Pack sizes per category</h2>
            <p className="text-[13px] text-[#6c6f77]">
              Suggested order quantities round up to the nearest whole pack size from the publisher.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CATS.map(cat => (
                <div key={cat} className="p-4 border border-[#dcdee3] rounded-lg bg-white space-y-2 shadow-xs">
                  <div className="font-bold text-[14px] text-[#191c20]">
                    {PLURAL[cat]}
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      value={draft.pack[cat] || 0}
                      onChange={(e) => {
                        const num = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setDraft({
                          ...draft,
                          pack: { ...draft.pack, [cat]: num }
                        });
                      }}
                      className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md font-mono text-[14px] font-bold text-right text-[#191c20] bg-white outline-none focus:border-[#1f5f8b] tabular-nums"
                    />
                  </div>
                  <div className="text-[11.5px] text-[#8b8e96]">
                    pieces per shrinkwrapped pack
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-[#f6f7f9] border border-[#dcdee3] rounded-md text-[12.5px] text-[#44474e]">
              <strong>Worked example:</strong> If a booklet edition has <strong>8</strong> in store with a reorder point of <strong>60</strong> (deficit of 52) and a pack size of <strong>20</strong>, the system smart-suggests ordering <strong>60</strong> (3 packs of 20) to bring stock to 68, safely reaching and exceeding the 60 threshold.
            </div>
          </div>

          {/* People & Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-[#191c20]">People & roles</h2>
                <p className="text-[13px] text-[#6c6f77]">
                  Admins can post counts, adjust stock, and edit catalog metadata. View-only users can review counts and inventory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPerson(true)}
                className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 flex-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add a person</span>
              </button>
            </div>

            {/* Add person form */}
            {showAddPerson && (
              <form onSubmit={handleAddPersonSubmit} className="p-4 border border-[#c9cbd2] bg-[#f6f9fb] rounded-lg space-y-3">
                <div className="font-bold text-[14px] text-[#191c20]">Add user or team member</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Full name"
                      required
                      className="w-full px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newPersonEmail}
                      onChange={(e) => setNewPersonEmail(e.target.value)}
                      placeholder="name@cisa.org"
                      required
                      className="w-full px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                      Role
                    </label>
                    <select
                      value={newPersonRole}
                      onChange={(e) => setNewPersonRole(e.target.value as any)}
                      className="w-full px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] bg-white outline-none"
                    >
                      <option value="Admin">Admin</option>
                      <option value="View only">View only</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddPerson(false)}
                    className="px-3 py-1.5 border border-[#c9cbd2] bg-white text-[#44474e] text-[12px] font-semibold rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded-md cursor-pointer"
                  >
                    Add person
                  </button>
                </div>
              </form>
            )}

            {/* People Table */}
            <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
              <div className="grid grid-cols-[1fr_1fr_120px_60px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                <div>Name</div>
                <div>Email</div>
                <div>Role</div>
                <div className="text-right" />
              </div>

              <div className="divide-y divide-[#eef0f3]">
                {draft.people.map(person => (
                  <div
                    key={person.id}
                    className="grid grid-cols-[1fr_1fr_120px_60px] items-center px-4 py-3 text-[13px]"
                  >
                    <div className="font-semibold text-[#191c20] flex items-center gap-2">
                      <span>{person.name}</span>
                      {person.self && (
                        <span className="text-[10px] text-[#8b8e96] font-normal italic">(you)</span>
                      )}
                    </div>

                    <div className="text-[#6c6f77] text-[12.5px] truncate pr-2">
                      {person.email}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleToggleRole(person.id)}
                        className={`
                          px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer
                          ${person.role === 'Admin'
                            ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]'
                            : 'bg-[#f6f7f9] text-[#6c6f77] border border-[#dcdee3]'
                          }
                        `}
                      >
                        {person.role}
                      </button>
                    </div>

                    <div className="text-right">
                      {!person.self && (
                        <button
                          type="button"
                          onClick={() => handleRemovePerson(person.id)}
                          className="text-[#8b8e96] hover:text-[#b3261e] p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 ml-auto" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Database Integrity & Deduplication */}
        <div className="bg-white border border-[#dcdee3] rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1f5f8b]" />
                <h2 className="text-[16px] font-bold text-[#191c20]">Database Maintenance & Count Reconciliation</h2>
              </div>
              <p className="text-[13px] text-[#6c6f77] mt-1 max-w-2xl">
                Scan your Firestore inventory for duplicate title items, inconsistent SKUs, or split English/Spanish records. Reconcile counts to the latest, most accurate shelf records with full <strong>Dry Run preview</strong> before applying batch updates.
              </p>
              {cleanupPlan.duplicateDocsCount > 0 ? (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-[12px] font-semibold text-amber-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{cleanupPlan.duplicateDocsCount} duplicate document(s) detected across {cleanupPlan.groups.length} title group(s)</span>
                </div>
              ) : (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-[12px] font-semibold text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Inventory database is healthy and consolidated ({rawInventory.length} records)</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCleanupOpen(true)}
              className="px-4 py-2 bg-white border border-[#1f5f8b]/40 text-[#1f5f8b] hover:bg-[#f0f7fc] text-[13px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-2 flex-none shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Deduplicate & Reconcile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="px-6 py-3.5 bg-[#fdf0d8] border-t border-[#f2d9a8] flex items-center justify-between gap-4">
          <span className="text-[13px] font-semibold text-[#8a5a00]">
            You have unsaved changes to your settings.
          </span>
          <div className="flex items-center gap-2 flex-none">
            <button
              onClick={() => setDraft(JSON.parse(JSON.stringify(settings)))}
              className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12.5px] font-semibold rounded-md cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={() => onSaveSettings(draft)}
              className="px-4 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12.5px] font-semibold rounded-md cursor-pointer shadow-xs"
            >
              Save settings
            </button>
          </div>
        </div>
      )}

      {/* Inventory Deduplication & Merge Modal */}
      <InventoryCleanupModal
        isOpen={isCleanupOpen}
        onClose={() => setIsCleanupOpen(false)}
        rawInventory={rawInventory}
      />
    </div>
  );
};
