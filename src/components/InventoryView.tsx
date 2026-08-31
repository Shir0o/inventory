import React, { useState } from 'react';
import { Title, Category, Language } from '../types';
import { Search, Plus, Download, Edit2, SlidersHorizontal, ArrowLeft, X } from 'lucide-react';
import { exportToCSV } from '../lib/csvExport';

interface InventoryViewProps {
  titles: Title[];
  onAdjustStock: (code: string, qty: number, note: string) => void;
  onSaveTitle: (originalCode: string | null, nextTitle: Title) => void;
  reorderSensitivity?: number;
}

const CATS: Category[] = ['Bible', 'Booklet', 'Tract'];
const PLURAL: Record<Category, string> = { Bible: 'Bibles', Booklet: 'Booklets', Tract: 'Tracts' };
const PREFIX: Record<Category, string> = { Bible: 'BIB', Booklet: 'BKL', Tract: 'TR' };
const DEFAULT_REORDER: Record<Category, number> = { Bible: 20, Booklet: 60, Tract: 150 };
const PACK: Record<Category, number> = { Bible: 10, Booklet: 20, Tract: 50 };
const LANG_NAME: Record<Language, string> = { EN: 'English', ES: 'Spanish' };

function aliasesOf(t: Title): string[] {
  return t.aliases || (t.alias ? [t.alias] : []);
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  titles,
  onAdjustStock,
  onSaveTitle,
  reorderSensitivity = 1
}) => {
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [langFilter, setLangFilter] = useState<string>('All');
  const [lowOnly, setLowOnly] = useState(false);

  // Inline adjustment state
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustNote, setAdjustNote] = useState<string>('');

  // Title Editor State
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [originalTitle, setOriginalTitle] = useState<Title | null>(null);
  const [draftTitle, setDraftTitle] = useState<{
    code: string;
    name: string;
    cat: Category;
    reorder: string;
    aliases: string[];
    editions: { lang: Language; title: string; stock: string; isNew: boolean }[];
  } | null>(null);
  const [aliasInput, setAliasInput] = useState('');

  const reorderAt = (t: Title) => Math.round(t.reorder * reorderSensitivity);

  const getStatus = (t: Title, stock: number) => {
    if (stock === 0) return 'out';
    return stock < reorderAt(t) ? 'low' : 'ok';
  };

  const matches = (t: Title, ed: Title['editions'][0]) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const aliases = aliasesOf(t);
    const codeKey = `${t.code}-${ed.lang}`;
    return (
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      ed.title.toLowerCase().includes(q) ||
      codeKey.toLowerCase().includes(q) ||
      aliases.some(a => a.toLowerCase().includes(q))
    );
  };

  // Filter titles & editions
  const visibleGroups: { title: Title; editions: Title['editions'] }[] = [];
  titles.forEach(t => {
    if (catFilter !== 'All' && t.cat !== catFilter) return;
    const eds = t.editions.filter(ed => {
      const matchLang = langFilter === 'All' || ed.lang === langFilter;
      const matchQuery = matches(t, ed);
      const matchLow = !lowOnly || getStatus(t, ed.stock) !== 'ok';
      return matchLang && matchQuery && matchLow;
    });
    if (eds.length > 0) {
      visibleGroups.push({ title: t, editions: eds });
    }
  });

  // Calculate stats
  let totalEditions = 0;
  let totalFlagged = 0;
  titles.forEach(t => {
    t.editions.forEach(ed => {
      totalEditions++;
      if (getStatus(t, ed.stock) !== 'ok') totalFlagged++;
    });
  });

  // Start adjusting an edition
  const handleStartAdjust = (code: string, currentStock: number) => {
    setAdjustingKey(code);
    setAdjustQty(String(currentStock));
    setAdjustNote('');
  };

  const handleSaveAdjust = (code: string) => {
    const qty = Math.max(0, parseInt(adjustQty, 10) || 0);
    onAdjustStock(code, qty, adjustNote);
    setAdjustingKey(null);
    setAdjustQty('');
    setAdjustNote('');
  };

  // Start adding new title
  const handleStartNewTitle = () => {
    setOriginalTitle(null);
    setAliasInput('');
    setDraftTitle({
      code: 'TR-',
      name: '',
      cat: 'Tract',
      reorder: String(DEFAULT_REORDER.Tract),
      aliases: [],
      editions: [{ lang: 'EN', title: '', stock: '0', isNew: true }]
    });
    setMode('edit');
  };

  // Start editing existing title
  const handleStartEdit = (t: Title) => {
    setOriginalTitle(t);
    setAliasInput('');
    setDraftTitle({
      code: t.code,
      name: t.name,
      cat: t.cat,
      reorder: String(t.reorder),
      aliases: aliasesOf(t).slice(),
      editions: t.editions.map(ed => ({
        lang: ed.lang,
        title: ed.title,
        stock: String(ed.stock),
        isNew: false
      }))
    });
    setMode('edit');
  };

  // Title Editor Helpers
  const handleSetDraftCat = (cat: Category) => {
    if (!draftTitle) return;
    const wasDefault = draftTitle.reorder === String(DEFAULT_REORDER[draftTitle.cat]);
    const code = (!originalTitle && (!draftTitle.code || draftTitle.code.startsWith('TR-') || draftTitle.code.startsWith('BIB-') || draftTitle.code.startsWith('BKL-')))
      ? `${PREFIX[cat]}-`
      : draftTitle.code;
    setDraftTitle({
      ...draftTitle,
      cat,
      code,
      reorder: wasDefault ? String(DEFAULT_REORDER[cat]) : draftTitle.reorder
    });
  };

  const handleAddAlias = () => {
    const val = aliasInput.trim();
    if (!val || !draftTitle) return;
    if (!draftTitle.aliases.some(a => a.toLowerCase() === val.toLowerCase())) {
      setDraftTitle({
        ...draftTitle,
        aliases: [...draftTitle.aliases, val]
      });
    }
    setAliasInput('');
  };

  const handleRemoveAlias = (val: string) => {
    if (!draftTitle) return;
    setDraftTitle({
      ...draftTitle,
      aliases: draftTitle.aliases.filter(a => a !== val)
    });
  };

  const handleAddEdition = (lang: Language) => {
    if (!draftTitle) return;
    setDraftTitle({
      ...draftTitle,
      editions: [...draftTitle.editions, { lang, title: '', stock: '0', isNew: true }]
        .sort((a, b) => (a.lang === 'EN' ? -1 : 1))
    });
  };

  const handleRemoveEdition = (lang: Language) => {
    if (!draftTitle) return;
    setDraftTitle({
      ...draftTitle,
      editions: draftTitle.editions.filter(ed => ed.lang !== lang)
    });
  };

  const getDraftErrors = (): string[] => {
    if (!draftTitle) return ['nothing to save'];
    const errs: string[] = [];
    if (!draftTitle.name.trim()) errs.push('a name');
    if (!/^[A-Za-z0-9-]{3,}$/.test(draftTitle.code.trim())) errs.push('a code (min 3 chars)');
    if (draftTitle.editions.length === 0) errs.push('at least one language edition');
    else if (draftTitle.editions.some(ed => !ed.title.trim())) errs.push('a title for every edition');
    
    const codeConflict = titles.some(
      t => t.code.toLowerCase() === draftTitle.code.trim().toLowerCase() &&
           (!originalTitle || t.code !== originalTitle.code)
    );
    if (codeConflict) errs.push('a unique code not already used');
    return errs;
  };

  const handleSaveTitleSubmit = () => {
    if (!draftTitle) return;
    const errors = getDraftErrors();
    if (errors.length > 0) return;

    const nextTitle: Title = {
      code: draftTitle.code.trim().toUpperCase(),
      name: draftTitle.name.trim(),
      cat: draftTitle.cat,
      reorder: Math.max(0, parseInt(draftTitle.reorder, 10) || 0),
      pack: originalTitle?.pack || PACK[draftTitle.cat] || 50,
      aliases: draftTitle.aliases.slice(),
      editions: draftTitle.editions.map(ed => ({
        lang: ed.lang,
        title: ed.title.trim(),
        stock: ed.isNew 
          ? Math.max(0, parseInt(ed.stock, 10) || 0)
          : (originalTitle?.editions.find(o => o.lang === ed.lang)?.stock || 0)
      }))
    };

    onSaveTitle(originalTitle ? originalTitle.code : null, nextTitle);
    setMode('list');
    setDraftTitle(null);
    setOriginalTitle(null);
  };

  // CSV Export
  const handleExportCSV = () => {
    const rows: any[] = [];
    titles.forEach(t => {
      t.editions.forEach(ed => {
        rows.push({
          Title: t.name,
          Code: `${t.code}-${ed.lang}`,
          Category: t.cat,
          Language: ed.lang,
          EditionTitle: ed.title,
          Stock: ed.stock,
          ReorderPoint: reorderAt(t),
          Status: getStatus(t, ed.stock)
        });
      });
    });
    exportToCSV(rows, 'literature_inventory');
  };

  if (mode === 'edit' && draftTitle) {
    const isNew = !originalTitle;
    const errors = getDraftErrors();
    const existingLangs = draftTitle.editions.map(ed => ed.lang);
    const missingLangs = (['EN', 'ES'] as Language[]).filter(l => !existingLangs.includes(l));

    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* Editor Top Bar */}
        <div className="px-6 py-5 border-b border-[#dcdee3]">
          <button
            onClick={() => setMode('list')}
            className="text-[12.5px] font-semibold text-[#44474e] hover:text-[#1f5f8b] flex items-center gap-1.5 mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to inventory</span>
          </button>
          <h1 className="text-[25px] font-bold tracking-tight text-[#191c20]">
            {isNew ? 'Add a title' : draftTitle.name || 'Untitled'}
          </h1>
          <p className="text-[13.5px] text-[#44474e] mt-1">
            {isNew 
              ? 'A title is the content. Its language editions are what you actually count on the shelf.'
              : 'Editing the title, its former names, and its language editions. Stock is changed on the list, not here.'
            }
          </p>
        </div>

        {/* Editor Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-2xl space-y-6">
            {/* Title Section */}
            <div>
              <h2 className="text-[16px] font-bold text-[#191c20]">The title</h2>
              <p className="text-[12.5px] text-[#6c6f77] mt-0.5">
                The content itself. Its canonical name is shown when referring to the title across editions.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3.5">
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={draftTitle.name}
                    onChange={(e) => setDraftTitle({ ...draftTitle, name: e.target.value })}
                    placeholder="What this piece of literature is called"
                    className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md text-[13.5px] text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1.5">
                    Code
                  </label>
                  <input
                    type="text"
                    value={draftTitle.code}
                    onChange={(e) => setDraftTitle({ ...draftTitle, code: e.target.value.toUpperCase() })}
                    placeholder="TR-NEW"
                    className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md font-mono text-[13.5px] font-semibold text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none uppercase transition-all"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3.5 items-end">
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1.5">
                    Type
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATS.map(c => {
                      const active = draftTitle.cat === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleSetDraftCat(c)}
                          className={`
                            px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors cursor-pointer
                            ${active 
                              ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]' 
                              : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                            }
                          `}
                        >
                          {PLURAL[c]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1.5">
                    Reorder at
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draftTitle.reorder}
                    onChange={(e) => setDraftTitle({ ...draftTitle, reorder: e.target.value })}
                    className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md font-mono text-[13.5px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all tabular-nums"
                  />
                </div>
              </div>
              <p className="text-[11.5px] text-[#8b8e96] mt-2">
                Anything below {parseInt(draftTitle.reorder, 10) || 0} in store is flagged for reorder. {PLURAL[draftTitle.cat]} default to {DEFAULT_REORDER[draftTitle.cat]}.
              </p>
            </div>

            <div className="h-px bg-[#eef0f3]" />

            {/* Former Names (Aliases) */}
            <div>
              <h2 className="text-[16px] font-bold text-[#191c20]">Former names</h2>
              <p className="text-[12.5px] text-[#6c6f77] mt-0.5">
                Names this title used to be printed under. Search matches them everywhere, so an old count sheet still finds the item.
              </p>

              {draftTitle.aliases.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {draftTitle.aliases.map((alias) => (
                    <span
                      key={alias}
                      className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#f6f7f9] border border-[#dcdee3] rounded-md text-[13px] text-[#44474e]"
                    >
                      <span>{alias}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(alias)}
                        className="text-[#8b8e96] hover:text-[#b3261e] cursor-pointer text-sm font-bold leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(); } }}
                  placeholder="A name this used to go by"
                  className="flex-1 px-3 py-2 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddAlias}
                  disabled={!aliasInput.trim()}
                  className={`
                    px-3.5 py-2 rounded-md text-[13px] font-semibold transition-colors cursor-pointer flex-none
                    ${aliasInput.trim()
                      ? 'border border-[#1f5f8b] bg-white text-[#1f5f8b] hover:bg-[#e9f1f7]'
                      : 'border border-[#dcdee3] bg-[#f6f7f9] text-[#a4a7ae] cursor-default'
                    }
                  `}
                >
                  Add name
                </button>
              </div>
            </div>

            <div className="h-px bg-[#eef0f3]" />

            {/* Language Editions */}
            <div>
              <h2 className="text-[16px] font-bold text-[#191c20]">Language editions</h2>
              <p className="text-[12.5px] text-[#6c6f77] mt-0.5">
                Stock is counted per edition. The Spanish title is whatever is printed on the Spanish copy.
              </p>

              <div className="mt-3.5 space-y-3">
                {draftTitle.editions.map((ed) => (
                  <div key={ed.lang} className="p-4 border border-[#dcdee3] rounded-lg bg-white shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`
                          text-[9px] font-bold px-1.5 py-0.5 rounded-xs
                          ${ed.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                        `}>
                          {ed.lang}
                        </span>
                        <span className="text-[12.5px] font-bold text-[#44474e]">{LANG_NAME[ed.lang]}</span>
                        <span className="font-mono text-[11px] text-[#a8abb3]">{draftTitle.code}-{ed.lang}</span>
                      </div>
                      {ed.isNew && draftTitle.editions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEdition(ed.lang)}
                          className="text-[11.5px] font-semibold text-[#44474e] hover:text-[#b3261e] border border-[#dcdee3] px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-3 items-end">
                      <div>
                        <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                          Edition title
                        </label>
                        <input
                          type="text"
                          value={ed.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftTitle({
                              ...draftTitle,
                              editions: draftTitle.editions.map(item => item.lang === ed.lang ? { ...item, title: val } : item)
                            });
                          }}
                          placeholder={ed.lang === 'EN' ? 'Title as printed in English' : 'Título tal como aparece impreso'}
                          className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md text-[13.5px] text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all"
                        />
                      </div>

                      {ed.isNew ? (
                        <div>
                          <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                            Starting shelf count
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={ed.stock}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftTitle({
                                ...draftTitle,
                                editions: draftTitle.editions.map(item => item.lang === ed.lang ? { ...item, stock: val } : item)
                              });
                            }}
                            className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md font-mono text-[13.5px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all tabular-nums"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                            In store
                          </label>
                          <div className="px-3 py-2 border border-[#eef0f3] bg-[#f6f7f9] rounded-md font-mono text-[13.5px] font-bold text-right text-[#6c6f77] tabular-nums">
                            {ed.stock}
                          </div>
                        </div>
                      )}
                    </div>

                    {!ed.isNew && (
                      <p className="text-[11px] text-[#8b8e96] mt-2">
                        Stock is not edited here — use <em>Adjust</em> on the inventory list so the change is logged with a reason.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {missingLangs.length > 0 && (
                <div className="mt-3 p-3.5 border border-dashed border-[#c9cbd2] rounded-lg flex flex-wrap items-center justify-between gap-3 bg-[#fbfbfc]">
                  <span className="text-[12.5px] text-[#6c6f77]">
                    This title exists in {LANG_NAME[existingLangs[0] || 'EN']} only.
                  </span>
                  <div className="flex gap-2">
                    {missingLangs.map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => handleAddEdition(l)}
                        className="px-3 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12px] font-semibold rounded-md cursor-pointer transition-colors"
                      >
                        Add {LANG_NAME[l]} edition
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Bottom Actions */}
        <div className="px-6 py-4 border-t border-[#dcdee3] bg-[#f6f7f9] flex items-center justify-between gap-4">
          <div className="text-[12.5px] text-[#6c6f77]">
            {errors.length > 0 ? (
              <span className="text-[#8a5a00] font-semibold">Still needs {errors.join(', ')}.</span>
            ) : isNew ? (
              'Starting stock is recorded as an adjusted shelf count in the ledger.'
            ) : (
              'Renaming keeps the old name searchable if added as a former name.'
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-none">
            <button
              type="button"
              onClick={() => setMode('list')}
              className="px-4 py-2 border border-[#c9cbd2] bg-white hover:bg-[#eef0f3] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTitleSubmit}
              disabled={errors.length > 0}
              className={`
                px-4 py-2 rounded-md font-semibold text-[13px] transition-colors cursor-pointer shadow-xs
                ${errors.length === 0
                  ? 'border border-[#1f5f8b] bg-[#1f5f8b] hover:bg-[#17496c] text-white'
                  : 'border border-[#dcdee3] bg-[#eef0f3] text-[#a3a6ad] cursor-not-allowed'
                }
              `}
            >
              {isNew ? 'Add title' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular List Mode
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dcdee3]">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Inventory</h1>
          <p className="text-[13.5px] text-[#44474e] mt-0.5">
            {titles.length} titles · {totalEditions} language editions · {totalFlagged} need reordering
          </p>
        </div>
        <button
          onClick={handleStartNewTitle}
          className="px-4 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer flex items-center gap-1.5 flex-none shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add a title</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-6 py-3.5 flex flex-wrap items-center gap-2.5 border-b border-[#dcdee3] bg-white">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, code, or a former name"
            className="w-full pl-9 pr-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none transition-all"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1">
          {['All', ...CATS].map(c => {
            const active = catFilter === c;
            const label = c === 'All' ? 'All types' : PLURAL[c as Category];
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`
                  px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer
                  ${active 
                    ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]' 
                    : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                  }
                `}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Language Chips */}
        <div className="flex items-center gap-1">
          {['All', 'EN', 'ES'].map(l => {
            const active = langFilter === l;
            const label = l === 'All' ? 'Both languages' : l === 'EN' ? 'English' : 'Spanish';
            return (
              <button
                key={l}
                onClick={() => setLangFilter(l)}
                className={`
                  px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer
                  ${active 
                    ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]' 
                    : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                  }
                `}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Low only toggle */}
        <button
          onClick={() => setLowOnly(!lowOnly)}
          className={`
            px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer
            ${lowOnly 
              ? 'bg-[#fdf0d8] text-[#8a5a00] border border-[#f2d9a8]' 
              : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
            }
          `}
        >
          Needs reordering {totalFlagged > 0 ? `(${totalFlagged})` : ''}
        </button>
      </div>

      {/* Main Inventory Table */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_90px_80px_80px_70px_70px] items-center px-6 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
          <div>Title and editions</div>
          <div>Code</div>
          <div className="text-right">In store</div>
          <div className="text-right">Reorder</div>
          <div className="text-right">Status</div>
          <div className="text-right">Actions</div>
        </div>

        {visibleGroups.length === 0 ? (
          <div className="py-16 text-center text-[#6c6f77]">
            <p className="font-semibold text-[15px] text-[#191c20]">Nothing matches &ldquo;{query}&rdquo;</p>
            <p className="text-[13px] mt-1">Former names are searched too, so an old sheet name should still find the title.</p>
          </div>
        ) : (
          <div>
            {visibleGroups.map(({ title: t, editions: eds }, groupIdx) => {
              const aliases = aliasesOf(t);
              const titleTotal = t.editions.reduce((sum, e) => sum + e.stock, 0);

              return (
                <div key={t.code} className="border-b border-[#dcdee3]">
                  {/* Title Header Row */}
                  <div className="grid grid-cols-[1fr_90px_80px_80px_70px_70px] items-baseline px-6 pt-3.5 pb-2 bg-[#fbfbfc]">
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-[14.5px] text-[#191c20] tracking-tight truncate">
                        {t.name}
                      </div>
                      {aliases.length > 0 && (
                        <div className="text-[11.5px] text-[#8b8e96] italic mt-0.5 truncate">
                          also known as {aliases.map(a => `“${a}”`).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-[#a8abb3] truncate">
                      {t.code}
                    </div>
                    <div className="text-right font-mono text-[13px] font-bold text-[#8b8e96] tabular-nums">
                      {titleTotal}
                    </div>
                    <div />
                    <div />
                    <div className="text-right">
                      <button
                        onClick={() => handleStartEdit(t)}
                        className="px-2 py-0.5 text-[12px] font-semibold text-[#1f5f8b] hover:bg-[#e9f1f7] rounded-sm transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Editions rows */}
                  <div className="divide-y divide-[#eef0f3]">
                    {eds.map((ed) => {
                      const codeKey = `${t.code}-${ed.lang}`;
                      const status = getStatus(t, ed.stock);
                      const isAdjusting = adjustingKey === codeKey;
                      const parsedStock = parseInt(adjustQty, 10);
                      const delta = isNaN(parsedStock) ? 0 : parsedStock - ed.stock;

                      return (
                        <React.Fragment key={codeKey}>
                          <div className={`
                            grid grid-cols-[1fr_90px_80px_80px_70px_70px] items-center px-6 py-2.5 text-[13px] transition-colors
                            ${status === 'out' ? 'bg-[#fffcfc]' : status === 'low' ? 'bg-[#fffdf7]' : 'bg-white'}
                          `}>
                            {/* Edition title & lang badge */}
                            <div className="min-w-0 flex items-baseline gap-2.5 pl-4 pr-3">
                              <span className={`
                                text-[9px] font-bold px-1.5 py-0.5 rounded-xs flex-none
                                ${ed.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                              `}>
                                {ed.lang}
                              </span>
                              <span className="font-medium text-[#191c20] text-[13.5px] truncate">
                                {ed.title}
                              </span>
                            </div>

                            {/* Code */}
                            <div className="font-mono text-[11px] text-[#6c6f77] truncate">
                              {codeKey}
                            </div>

                            {/* Stock */}
                            <div className={`
                              text-right font-mono text-[14px] font-bold tabular-nums
                              ${status === 'out' ? 'text-[#b3261e]' : status === 'low' ? 'text-[#8a5a00]' : 'text-[#191c20]'}
                            `}>
                              {ed.stock}
                            </div>

                            {/* Reorder point */}
                            <div className="text-right font-mono text-[13px] text-[#6c6f77] tabular-nums">
                              {reorderAt(t)}
                            </div>

                            {/* Status */}
                            <div className="flex justify-end">
                              {status === 'out' && (
                                <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs text-[#b3261e] bg-[#fdeceb] border border-[#f4cfcd]">
                                  Out
                                </span>
                              )}
                              {status === 'low' && (
                                <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs text-[#8a5a00] bg-[#fdf0d8] border border-[#f2d9a8]">
                                  Low
                                </span>
                              )}
                            </div>

                            {/* Adjust button */}
                            <div className="text-right">
                              <button
                                onClick={() => handleStartAdjust(codeKey, ed.stock)}
                                className="px-2 py-0.5 text-[12px] font-semibold text-[#1f5f8b] hover:bg-[#e9f1f7] rounded-sm transition-colors cursor-pointer"
                              >
                                Adjust
                              </button>
                            </div>
                          </div>

                          {/* Inline Shelf Adjustment Row */}
                          {isAdjusting && (
                            <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#f6f9fb] border-t border-b border-[#dcdee3]">
                              <span className="text-[12px] font-bold text-[#44474e] flex-none">
                                Counted on the shelf
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={adjustQty}
                                onChange={(e) => setAdjustQty(e.target.value)}
                                className="w-20 px-2.5 py-1.5 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums"
                              />
                              <span className={`
                                font-mono text-[12.5px] font-bold min-w-[70px] flex-none tabular-nums
                                ${delta === 0 ? 'text-[#8b8e96]' : delta > 0 ? 'text-[#1f5f8b]' : 'text-[#b3261e]'}
                              `}>
                                {delta === 0 ? 'no change' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}
                              </span>
                              <input
                                type="text"
                                value={adjustNote}
                                onChange={(e) => setAdjustNote(e.target.value)}
                                placeholder="Why the number changed (e.g. shelf recount)"
                                className="flex-1 min-w-[160px] px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none"
                              />
                              <div className="flex items-center gap-1.5 flex-none">
                                <button
                                  type="button"
                                  onClick={() => setAdjustingKey(null)}
                                  className="px-3 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12px] font-semibold rounded-md cursor-pointer transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveAdjust(codeKey)}
                                  disabled={delta === 0}
                                  className={`
                                    px-3.5 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer
                                    ${delta !== 0 
                                      ? 'bg-[#1f5f8b] hover:bg-[#17496c] text-white border border-[#1f5f8b]' 
                                      : 'bg-[#f6f7f9] text-[#a4a7ae] border border-[#dcdee3] cursor-default'
                                    }
                                  `}
                                >
                                  Save adjustment
                                </button>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info bar */}
      <div className="px-6 py-3.5 border-t border-[#dcdee3] flex items-center justify-between gap-4 bg-white">
        <div className="text-[12.5px] text-[#6c6f77]">
          Stock changes are logged every time something moves — receiving, events, and shelf adjustments.
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[12.5px] rounded-md transition-colors cursor-pointer flex items-center gap-1.5 flex-none"
        >
          <Download className="w-3.5 h-3.5 text-[#6c6f77]" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};
