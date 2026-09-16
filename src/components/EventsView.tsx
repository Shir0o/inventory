import React, { useState, useEffect } from 'react';
import { EventItem, Correction, EventLine } from '../types';
import { Plus, Calendar, ArrowLeft, AlertCircle, History, Check, CheckCircle2 } from 'lucide-react';

interface EventsViewProps {
  events: EventItem[];
  onStartCountForEvent: (event: EventItem) => void;
  onSavePlannedEvent: (date: string, location: string) => void;
  onPostCorrection: (eventId: string, note: string, changes: { key: string; from: number; to: number }[]) => void;
  onCompleteEvent?: (eventId: string) => void;
  selectedEventId?: string | null;
  onClearSelectedEvent?: () => void;
}

const PAST_LOCATIONS = [
  'Campus gate',
  'Downtown farmers market',
  'CISA — open house',
  'Eastside park'
];

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  onStartCountForEvent,
  onSavePlannedEvent,
  onPostCorrection,
  onCompleteEvent,
  selectedEventId: initialSelectedEventId,
  onClearSelectedEvent
}) => {
  const [viewingEventId, setViewingEventId] = useState<string | null>(initialSelectedEventId || null);

  useEffect(() => {
    if (initialSelectedEventId) {
      setViewingEventId(initialSelectedEventId);
    }
  }, [initialSelectedEventId]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planLocation, setPlanLocation] = useState('');

  // Correction Form State
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionKey, setCorrectionKey] = useState('');
  const [correctionTo, setCorrectionTo] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  const viewingEvent = events.find(e => e.id === viewingEventId);

  // Group events by Month
  const formatMonthGroup = (iso: string) => {
    try {
      const [y, m] = iso.split('-').map(Number);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[m - 1]} ${y}`;
    } catch {
      return iso;
    }
  };

  const formatDateShort = (iso: string) => {
    try {
      const [y, m, d] = iso.split('-').map(Number);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d} ${months[m - 1]} ${y}`;
    } catch {
      return iso;
    }
  };

  // Grouping logic
  const monthGroups: { month: string; events: EventItem[]; totalPassed: number }[] = [];
  const sortedEvents = [...events].sort((a, b) => b.date.localeCompare(a.date));

  sortedEvents.forEach(ev => {
    const monthKey = formatMonthGroup(ev.date);
    let g = monthGroups.find(x => x.month === monthKey);
    if (!g) {
      g = { month: monthKey, events: [], totalPassed: 0 };
      monthGroups.push(g);
    }
    g.events.push(ev);
    if (!ev.planned) {
      const passed = ev.lines && ev.lines.length > 0
        ? ev.lines.reduce((sum, l) => sum + (l.took - l.back), 0)
        : (ev.materialsDistributed || ev.totalPassed || 0);
      g.totalPassed += passed;
    }
  });

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planLocation.trim() || !planDate) return;
    onSavePlannedEvent(planDate, planLocation.trim());
    setShowPlanForm(false);
    setPlanLocation('');
  };

  const handleStartCorrection = (lineKey: string, currentBack: number) => {
    setCorrectionKey(lineKey);
    setCorrectionTo(String(currentBack));
    setCorrectionNote('');
    setShowCorrectionForm(true);
  };

  const handleSubmitCorrection = () => {
    if (!viewingEvent || !correctionKey || !correctionNote.trim()) return;
    const targetLine = viewingEvent.lines.find(l => l.key === correctionKey);
    if (!targetLine) return;
    const toNum = Math.max(0, parseInt(correctionTo, 10) || 0);
    if (toNum === targetLine.back) return;

    onPostCorrection(viewingEvent.id, correctionNote.trim(), [
      { key: correctionKey, from: targetLine.back, to: toNum }
    ]);
    setShowCorrectionForm(false);
    setCorrectionKey('');
    setCorrectionTo('');
    setCorrectionNote('');
  };

  // EVENT RECORD VIEW
  if (viewingEvent) {
    const totalTook = viewingEvent.lines.length > 0
      ? viewingEvent.lines.reduce((sum, l) => sum + l.took, 0)
      : (viewingEvent.materialsDistributed || viewingEvent.totalPassed || 0);
    const totalBack = viewingEvent.lines.reduce((sum, l) => sum + l.back, 0);
    const totalPassed = viewingEvent.lines.length > 0
      ? viewingEvent.lines.reduce((sum, l) => sum + (l.took - l.back), 0)
      : (viewingEvent.materialsDistributed || viewingEvent.totalPassed || 0);

    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* Record Header */}
        <div className="px-6 py-5 border-b border-[#dcdee3]">
          <button
            onClick={() => {
              setViewingEventId(null);
              if (onClearSelectedEvent) onClearSelectedEvent();
            }}
            className="text-[12.5px] font-semibold text-[#44474e] hover:text-[#1f5f8b] flex items-center gap-1.5 mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to events</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <h1 className="text-[25px] font-bold tracking-tight text-[#191c20]">
                {viewingEvent.location}
              </h1>
              <p className="text-[13.5px] text-[#44474e] mt-0.5">
                {formatDateShort(viewingEvent.date)} · {viewingEvent.planned ? 'Planned outreach event' : 'Count posted and closed'}
              </p>
            </div>
            {viewingEvent.planned && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onStartCountForEvent(viewingEvent)}
                  className="px-4 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Count this event
                </button>
                {onCompleteEvent && (
                  <button
                    onClick={() => onCompleteEvent(viewingEvent.id)}
                    className="px-3.5 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                    <span>Complete event</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Record Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {!viewingEvent.planned ? (
            <>
              {/* Top Stats Banner */}
              <div className="grid grid-cols-3 gap-px bg-[#dcdee3] border border-[#dcdee3] rounded-lg overflow-hidden max-w-xl">
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Passed out</div>
                  <div className="font-mono text-[24px] font-bold text-[#1f5f8b] mt-1 tabular-nums">
                    {totalPassed}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Took out</div>
                  <div className="font-mono text-[24px] font-bold text-[#44474e] mt-1 tabular-nums">
                    {totalTook}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Came back</div>
                  <div className="font-mono text-[24px] font-bold text-[#44474e] mt-1 tabular-nums">
                    {totalBack}
                  </div>
                </div>
              </div>

              {/* Count Sheet Table */}
              <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-3 bg-[#f6f7f9] border-b border-[#dcdee3] flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-[#6c6f77]">
                    Count sheet
                  </span>
                  <span className="text-[12px] text-[#8b8e96]">
                    {viewingEvent.lines.length > 0 
                      ? `${viewingEvent.lines.length} editions counted` 
                      : 'Summary record'}
                  </span>
                </div>

                {viewingEvent.lines.length === 0 ? (
                  <div className="p-8 text-center bg-white space-y-2">
                    <History className="w-8 h-8 text-[#8b8e96] mx-auto opacity-70" />
                    <div className="text-[14.5px] font-semibold text-[#191c20]">
                      Summary Distribution Record
                    </div>
                    <p className="text-[13px] text-[#6c6f77] max-w-md mx-auto">
                      This historic event recorded a total distribution of <strong className="font-mono text-[#1f5f8b] font-bold">{totalPassed.toLocaleString()} pieces</strong>. Detailed line-by-line item counts were not recorded for this past entry.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_80px_80px_80px_100px_70px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                      <div>Item</div>
                      <div className="text-right">Before</div>
                      <div className="text-right">Took</div>
                      <div className="text-right">Back</div>
                      <div className="text-right">Passed out</div>
                      <div className="text-right">Correct</div>
                    </div>

                    <div className="divide-y divide-[#eef0f3]">
                      {viewingEvent.lines.map(line => {
                        const passed = line.took - line.back;
                        const after = line.before - passed;
                        return (
                          <div
                            key={line.key}
                            className="grid grid-cols-[1fr_80px_80px_80px_100px_70px] items-center px-4 py-3 text-[13px]"
                          >
                            <div className="min-w-0 pr-3">
                              <div className="font-semibold text-[#191c20] truncate">
                                {line.title}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[11px] text-[#6c6f77]">{line.code}</span>
                                <span className={`
                                  text-[9px] font-bold px-1.5 py-0.5 rounded-xs
                                  ${line.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                                `}>
                                  {line.lang}
                                </span>
                              </div>
                            </div>

                            <div className="text-right font-mono text-[13px] text-[#6c6f77] tabular-nums">
                              {line.before}
                            </div>
                            <div className="text-right font-mono text-[13px] text-[#44474e] tabular-nums">
                              {line.took}
                            </div>
                            <div className="text-right font-mono text-[13px] text-[#44474e] tabular-nums">
                              {line.back}
                            </div>
                            <div className="text-right font-mono text-[14px] font-bold text-[#1f5f8b] tabular-nums">
                              {passed}
                            </div>
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => handleStartCorrection(line.key, line.back)}
                                className="px-2 py-0.5 text-[11.5px] font-semibold text-[#1f5f8b] hover:bg-[#e9f1f7] rounded-sm transition-colors cursor-pointer"
                              >
                                Fix
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Correction Form Modal / Drawer */}
              {showCorrectionForm && (
                <div className="p-4 border border-[#f2d9a8] bg-[#fffdf7] rounded-lg space-y-3">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#8a5a00]">
                    File a correction
                  </div>
                  <p className="text-[12.5px] text-[#44474e]">
                    Corrections are additive — the original count record stays intact and an adjustment entry is written to the ledger.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[13px] font-semibold text-[#191c20]">
                      {viewingEvent.lines.find(l => l.key === correctionKey)?.title}
                    </span>
                    <span className="text-[12.5px] text-[#6c6f77]">
                      Came back was {viewingEvent.lines.find(l => l.key === correctionKey)?.back} → New count:
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={correctionTo}
                      onChange={(e) => setCorrectionTo(e.target.value)}
                      className="w-20 px-2 py-1 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="Why this is being corrected (e.g. found extra copies on shelf)"
                      className="w-full px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCorrectionForm(false)}
                      className="px-3 py-1.5 border border-[#c9cbd2] bg-white text-[#44474e] text-[12px] font-semibold rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitCorrection}
                      disabled={!correctionNote.trim()}
                      className="px-3.5 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded-md cursor-pointer disabled:opacity-40"
                    >
                      Post correction
                    </button>
                  </div>
                </div>
              )}

              {/* Historical Corrections List */}
              {viewingEvent.corrections && viewingEvent.corrections.length > 0 && (
                <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white">
                  <div className="px-4 py-3 bg-[#f6f7f9] border-b border-[#dcdee3] text-[11px] font-bold tracking-wider uppercase text-[#6c6f77]">
                    Corrections filed ({viewingEvent.corrections.length})
                  </div>
                  <div className="divide-y divide-[#eef0f3] p-4 space-y-3">
                    {viewingEvent.corrections.map((c) => (
                      <div key={c.id} className="text-[13px] space-y-1">
                        <div className="flex items-center justify-between text-[11.5px] text-[#8b8e96]">
                          <span>{c.when} by {c.by}</span>
                        </div>
                        <div className="font-medium text-[#191c20]">{c.note}</div>
                        <div className="font-mono text-[12px] text-[#1f5f8b]">
                          {c.changes.map(ch => `${ch.key}: came back ${ch.from} → ${ch.to}`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              {viewingEvent.lines && viewingEvent.lines.length > 0 && (
                <div className="p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#1e40af]">
                      Count sheet recorded ({viewingEvent.lines.length} items)
                    </div>
                    <div className="text-[12px] text-[#3b82f6] mt-0.5">
                      Counts have been saved for this event. Click below to close and complete this record.
                    </div>
                  </div>
                  {onCompleteEvent && (
                    <button
                      onClick={() => onCompleteEvent(viewingEvent.id)}
                      className="px-3.5 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[12.5px] rounded-md transition-colors cursor-pointer whitespace-nowrap shadow-xs inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete event</span>
                    </button>
                  )}
                </div>
              )}

              <div className="p-8 border border-dashed border-[#c9cbd2] rounded-lg text-center space-y-3">
                <Calendar className="w-8 h-8 text-[#8b8e96] mx-auto" />
                <div className="font-bold text-[16px] text-[#191c20]">
                  Event is scheduled
                </div>
                <p className="text-[13px] text-[#6c6f77] leading-relaxed">
                  When you are ready to prepare literature or count the returned materials, click below.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => onStartCountForEvent(viewingEvent)}
                    className="px-4 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer shadow-xs"
                  >
                    Start count for this event
                  </button>
                  {onCompleteEvent && (
                    <button
                      onClick={() => onCompleteEvent(viewingEvent.id)}
                      className="px-4 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                      <span>Mark completed</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ALL EVENTS LIST VIEW
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Events</h1>
          <p className="text-[13.5px] text-[#44474e] mt-1">
            Outreach counts and planned distribution events.
          </p>
        </div>
        <button
          onClick={() => setShowPlanForm(true)}
          className="px-4 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer flex items-center gap-1.5 flex-none shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Plan an event</span>
        </button>
      </div>

      {/* Plan Event Drawer / Form */}
      {showPlanForm && (
        <form onSubmit={handleCreatePlan} className="p-6 bg-[#f6f9fb] border-b border-[#dcdee3] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#191c20]">Plan an event</h2>
            <button
              type="button"
              onClick={() => setShowPlanForm(false)}
              className="text-[12.5px] font-semibold text-[#6c6f77] hover:text-[#191c20] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3.5">
            <div>
              <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                Date
              </label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77] block mb-1">
                Location
              </label>
              <input
                type="text"
                value={planLocation}
                onChange={(e) => setPlanLocation(e.target.value)}
                placeholder="e.g. Campus main quad"
                required
                className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md text-[13.5px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
              />
            </div>
          </div>

          {/* Past location chips */}
          <div>
            <span className="text-[11px] text-[#8b8e96] mr-2">Recent locations:</span>
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {PAST_LOCATIONS.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setPlanLocation(loc)}
                  className="px-2.5 py-1 text-[11.5px] font-medium bg-white border border-[#dcdee3] hover:border-[#1f5f8b] rounded-md text-[#44474e] cursor-pointer transition-colors"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer shadow-xs"
            >
              Save planned event
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {monthGroups.map(group => (
          <div key={group.month} className="space-y-3">
            {/* Month Header */}
            <div className="flex items-center justify-between text-[13px] font-bold text-[#6c6f77] border-b border-[#dcdee3] pb-1.5">
              <span>{group.month}</span>
              <span className="font-mono text-[12px] tabular-nums font-semibold">
                {group.totalPassed.toLocaleString()} pieces passed out
              </span>
            </div>

            {/* Events Cards */}
            <div className="divide-y divide-[#dcdee3] border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
              {group.events.map(ev => {
                const passed = ev.lines.length > 0
                  ? ev.lines.reduce((sum, l) => sum + (l.took - l.back), 0)
                  : (ev.materialsDistributed || ev.totalPassed || 0);
                const hasCorrection = ev.corrections && ev.corrections.length > 0;

                return (
                  <div
                    key={ev.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbfbfc] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold text-[#6c6f77]">
                          {formatDateShort(ev.date)}
                        </span>
                        {ev.planned ? (
                          <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs text-[#1f5f8b] bg-[#e9f1f7] border border-[#d2e4f2]">
                            Planned
                          </span>
                        ) : (
                          hasCorrection && (
                            <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs text-[#8a5a00] bg-[#fdf0d8] border border-[#f2d9a8]">
                              1 correction
                            </span>
                          )
                        )}
                      </div>
                      <div className="font-bold text-[15px] text-[#191c20] mt-1 truncate">
                        {ev.location}
                      </div>
                      <div className="text-[12px] text-[#6c6f77] mt-0.5">
                        {ev.planned 
                          ? 'Taking literature reserves it until count is posted'
                          : ev.lines.length > 0
                            ? `${ev.lines.length} editions counted back`
                            : `${passed.toLocaleString()} total pieces distributed`
                        }
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-none">
                      {!ev.planned && (
                        <div className="text-right">
                          <div className="font-mono text-[18px] font-bold text-[#1f5f8b] tabular-nums">
                            {passed.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-[#8b8e96]">passed out</div>
                        </div>
                      )}

                      {ev.planned ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onStartCountForEvent(ev)}
                            className="px-3.5 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[12.5px] rounded-md transition-colors cursor-pointer shadow-xs"
                          >
                            {(() => {
                              try {
                                const raw = localStorage.getItem(`lit_ledger_count_draft_event_${ev.id}`);
                                if (raw) {
                                  const parsed = JSON.parse(raw);
                                  if (parsed?.itemsData && Object.values(parsed.itemsData).some((v: any) => v.took > 0)) {
                                    return 'Resume count';
                                  }
                                }
                              } catch {}
                              return 'Count event';
                            })()}
                          </button>
                          {ev.lines && ev.lines.length > 0 && onCompleteEvent && (
                            <button
                              onClick={() => onCompleteEvent(ev.id)}
                              title="Count was posted — click to complete event"
                              className="px-3 py-2 border border-[#2e7d32] bg-[#f1f8f1] hover:bg-[#e4f2e4] text-[#1b5e20] font-semibold text-[12px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}
                          <button
                            onClick={() => setViewingEventId(ev.id)}
                            className="px-2.5 py-2 text-[#6c6f77] hover:text-[#191c20] text-[12px] font-medium transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setViewingEventId(ev.id)}
                          className="px-3.5 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[12.5px] rounded-md transition-colors cursor-pointer"
                        >
                          View record
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
