import { useState, useRef, useEffect } from 'react';
import { Atencion, Tag, CHECKLIST_ITEMS } from '@/types/qa';
import { Plus, Pencil, Check, X } from 'lucide-react';
import {
  format,
  eachDayOfInterval,
  parseISO,
  differenceInCalendarDays,
  addDays,
} from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  atenciones: Atencion[];
  tags: Tag[];
  onUpdateAtencion: (a: Atencion) => void;
  onAddAtencion: (a: Atencion) => void;
}

// Colores por tag principal
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  calidad:    { bg: '#D97706', text: '#fff' },
  sap:        { bg: '#EA580C', text: '#fff' },
  core:       { bg: '#16A34A', text: '#fff' },
  desarrollo: { bg: '#2563EB', text: '#fff' },
  dl:         { bg: '#7C3AED', text: '#fff' },
  rend:       { bg: '#DB2777', text: '#fff' },
};

const DEFAULT_COLOR = { bg: '#2563EB', text: '#fff' };
const DELAY_COLOR = { bg: '#DC2626', text: '#fff' };
const PRIORITY_ORDER = ['dl', 'rend', 'desarrollo', 'core', 'sap', 'calidad'];

function getColor(a: Atencion) {
  for (const p of PRIORITY_ORDER) {
    if (a.tags.includes(p)) return TAG_COLORS[p] ?? DEFAULT_COLOR;
  }
  return DEFAULT_COLOR;
}

function getPrimaryTagLabel(a: Atencion, tags: Tag[]): string {
  for (const p of PRIORITY_ORDER) {
    if (a.tags.includes(p)) {
      const t = tags.find(x => x.id === p);
      return t ? t.label : p;
    }
  }
  return '';
}

const MIN_COL_W = 18;
const ROW_H = 40;
const BAR_H = 22;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const HEADER_H = 24;
const DAY_HEADER_H = 28;

export function TimelineView({ atenciones, tags, onUpdateAtencion, onAddAtencion }: Props) {
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const labelColRef = useRef<HTMLDivElement>(null);
  const [chartAreaWidth, setChartAreaWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(160);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Atencion>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingDelayLabelId, setEditingDelayLabelId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    code: '', startDate: '', endDate: '',
    delayEndDate: '', delayLabel: '', timelineNote: '',
  });

  // Auto-fit chart area
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const update = () => setChartAreaWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-regulate label column width
  useEffect(() => {
    if (!labelColRef.current) return;
    const spans = labelColRef.current.querySelectorAll('[data-label]');
    let maxW = 100;
    spans.forEach(s => {
      maxW = Math.max(maxW, (s as HTMLElement).scrollWidth + 24);
    });
    setLabelWidth(Math.min(Math.max(maxW, 120), 300));
  }, [atenciones, tags]);

  const items = atenciones
    .filter(a => a.startDate && a.endDate)
    .sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));

  // Date range
  const allDates: Date[] = [];
  items.forEach(a => {
    allDates.push(parseISO(a.startDate!), parseISO(a.endDate!));
    if (a.delayEndDate) allDates.push(parseISO(a.delayEndDate));
  });

  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date();
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : addDays(new Date(), 30);

  const rangeStart = addDays(minDate, -3);
  const rangeEnd = addDays(maxDate, 5);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const totalDays = days.length;

  const colWidth = totalDays > 0 && chartAreaWidth > 0
    ? Math.max(MIN_COL_W, chartAreaWidth / totalDays)
    : 24;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Group by month
  const months: { label: string; count: number }[] = [];
  days.forEach(d => {
    const label = format(d, 'MMMM', { locale: es });
    if (!months.length || months[months.length - 1].label !== label) {
      months.push({ label, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  // Edit handlers
  const startEdit = (a: Atencion) => {
    setEditingId(a.id);
    setEditData({
      startDate: a.startDate ?? '',
      endDate: a.endDate ?? '',
      delayEndDate: a.delayEndDate ?? '',
      delayLabel: a.delayLabel ?? '',
      timelineNote: a.timelineNote ?? '',
    });
  };
  const saveEdit = (a: Atencion) => {
    onUpdateAtencion({ ...a, ...editData });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const saveNote = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, timelineNote: val });
    setEditingNoteId(null);
  };

  const saveDelayLabel = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, delayLabel: val });
    setEditingDelayLabelId(null);
  };

  // Add new
  const handleAdd = () => {
    if (!newItem.code.trim() || !newItem.startDate || !newItem.endDate) return;
    onAddAtencion({
      id: Date.now().toString(),
      code: newItem.code.trim(),
      tags: [],
      progress: 0,
      columnId: '',
      checklist: CHECKLIST_ITEMS.map(() => false),
      comments: '',
      startDate: newItem.startDate,
      endDate: newItem.endDate,
      delayEndDate: newItem.delayEndDate || undefined,
      delayLabel: newItem.delayLabel || undefined,
      timelineNote: newItem.timelineNote || undefined,
    });
    setNewItem({ code: '', startDate: '', endDate: '', delayEndDate: '', delayLabel: '', timelineNote: '' });
    setShowAdd(false);
  };

  if (allDates.length === 0 && !showAdd) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm space-y-3">
        <p>Sin atenciones con fechas configuradas</p>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-primary/90 inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar Atención
        </button>
      </div>
    );
  }

  // Today line index
  const todayIdx = differenceInCalendarDays(today, rangeStart);

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(TAG_COLORS).map(([key, c]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: c.bg }} />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: DELAY_COLOR.bg }} />
            Atraso
          </span>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface-2 border border-primary/30 rounded-lg p-3 space-y-2 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Código *</label>
              <input value={newItem.code} onChange={e => setNewItem(p => ({ ...p, code: e.target.value }))}
                placeholder="RQ2026-99"
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Inicio Plan *</label>
              <input type="date" value={newItem.startDate} onChange={e => setNewItem(p => ({ ...p, startDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Fin Plan *</label>
              <input type="date" value={newItem.endDate} onChange={e => setNewItem(p => ({ ...p, endDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Fin Atraso</label>
              <input type="date" value={newItem.delayEndDate} onChange={e => setNewItem(p => ({ ...p, delayEndDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Texto atraso</label>
              <input value={newItem.delayLabel} onChange={e => setNewItem(p => ({ ...p, delayLabel: e.target.value }))}
                placeholder="Ej: Atrasos Dev - C2"
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Nota derecha</label>
              <input value={newItem.timelineNote} onChange={e => setNewItem(p => ({ ...p, timelineNote: e.target.value }))}
                placeholder="Ej: A la espera..."
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/90">Agregar</button>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground text-xs px-3 py-1.5 hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-lg border border-border overflow-hidden flex-1">
        <div className="overflow-x-auto h-full">
          <div className="flex h-full" style={{ minWidth: labelWidth + totalDays * MIN_COL_W }}>

            {/* Left label column */}
            <div ref={labelColRef} style={{ width: labelWidth, minWidth: labelWidth }} className="flex flex-col border-r border-border bg-surface-1 shrink-0 z-10">
              <div style={{ height: HEADER_H }} className="border-b border-border" />
              <div style={{ height: DAY_HEADER_H }} className="flex items-center px-3 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {items.length} registros
                </span>
              </div>
              {items.map((a, i) => {
                const isEditing = editingId === a.id;
                const tagLabel = getPrimaryTagLabel(a, tags);
                const isOdd = i % 2 === 0;
                return (
                  <div key={a.id}>
                    <div
                      style={{ height: ROW_H }}
                      className={`flex items-center gap-1.5 px-2 border-b border-border/40 group ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'}`}
                    >
                      <span data-label className="text-[11px] font-mono font-medium text-foreground truncate leading-tight flex-1">
                        {a.code}{tagLabel ? ` - ${tagLabel}` : ''}
                      </span>
                      <div className="shrink-0 flex gap-0.5">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(a)} className="text-green-500 hover:text-green-400 p-0.5"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={cancelEdit} className="text-muted-foreground hover:text-destructive p-0.5"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(a)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-0.5 transition-opacity">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isEditing && (
                      <div className="bg-surface-2/80 border-b border-primary/30 px-2 py-2 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Plan</label>
                            <input type="date" value={editData.startDate || ''} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Plan</label>
                            <input type="date" value={editData.endDate || ''} onChange={e => setEditData(p => ({ ...p, endDate: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Atraso</label>
                            <input type="date" value={editData.delayEndDate || ''} onChange={e => setEditData(p => ({ ...p, delayEndDate: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Texto Atraso</label>
                            <input value={editData.delayLabel || ''} onChange={e => setEditData(p => ({ ...p, delayLabel: e.target.value }))}
                              placeholder="Ej: Atrasos Dev - C2"
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Nota derecha</label>
                            <input value={editData.timelineNote || ''} onChange={e => setEditData(p => ({ ...p, timelineNote: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chart area */}
            <div ref={chartAreaRef} className="flex-1 flex flex-col overflow-hidden">

              {/* Month header */}
              <div style={{ height: HEADER_H }} className="flex border-b border-border bg-surface-2 shrink-0">
                {months.map((m, i) => (
                  <div key={i}
                    style={{ width: m.count * colWidth, minWidth: m.count * colWidth }}
                    className="text-[10px] font-bold text-muted-foreground text-center border-r border-border flex items-center justify-center capitalize"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div style={{ height: DAY_HEADER_H }} className="flex border-b border-border bg-surface-1 shrink-0">
                {days.map((d, i) => {
                  const isToday = format(d, 'yyyy-MM-dd') === todayStr;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div key={i}
                      style={{ width: colWidth, minWidth: colWidth }}
                      className={`flex flex-col items-center justify-center border-r border-border/50 select-none shrink-0
                        ${isToday ? 'bg-destructive/25 text-destructive font-bold' : isWeekend ? 'bg-surface-2/50 text-muted-foreground/50' : 'text-muted-foreground'}`}
                    >
                      <span className="text-[9px] leading-none">{format(d, 'dd')}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chart rows */}
              <div className="flex-1 overflow-hidden relative">
                {/* Today vertical line */}
                {todayIdx >= 0 && todayIdx < totalDays && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-destructive/60 z-20 pointer-events-none"
                    style={{ left: todayIdx * colWidth + colWidth / 2 }}
                  >
                    <div className="text-[8px] text-destructive font-bold bg-destructive/10 px-1 rounded-b">Today</div>
                  </div>
                )}

                {items.map((a, rowIdx) => {
                  const color = getColor(a);
                  const isOdd = rowIdx % 2 === 0;
                  const tagLabel = getPrimaryTagLabel(a, tags);

                  const startIdx = differenceInCalendarDays(parseISO(a.startDate!), rangeStart);
                  const endIdx = differenceInCalendarDays(parseISO(a.endDate!), rangeStart);
                  const plannedLeft = startIdx * colWidth;
                  const plannedWidth = Math.max(colWidth, (endIdx - startIdx + 1) * colWidth);

                  let delayWidth = 0;
                  if (a.delayEndDate) {
                    const delayEndIdx = differenceInCalendarDays(parseISO(a.delayEndDate), rangeStart);
                    if (delayEndIdx > endIdx) {
                      delayWidth = (delayEndIdx - endIdx) * colWidth;
                    }
                  }

                  const totalBarEnd = plannedLeft + plannedWidth + delayWidth;

                  return (
                    <div key={a.id}
                      style={{ height: ROW_H, position: 'relative' }}
                      className={`border-b border-border/30 ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'}`}
                    >
                      {/* Day grid lines */}
                      {days.map((d, i) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={i}
                            className={`absolute top-0 bottom-0 border-r border-border/20 pointer-events-none ${isWeekend ? 'bg-surface-2/10' : ''}`}
                            style={{ left: i * colWidth, width: colWidth }}
                          />
                        );
                      })}

                      {/* Planned bar - tag color */}
                      <div
                        className="absolute flex items-center overflow-hidden"
                        style={{
                          left: plannedLeft,
                          top: BAR_TOP,
                          height: BAR_H,
                          width: plannedWidth,
                          background: color.bg,
                          borderRadius: delayWidth > 0 ? '4px 0 0 4px' : '4px',
                          paddingLeft: 6,
                          paddingRight: 6,
                        }}
                      >
                        <span className="text-[10px] font-semibold truncate leading-none" style={{ color: color.text }}>
                          {a.code}{tagLabel ? ` - ${tagLabel}` : ''}
                        </span>
                      </div>

                      {/* Delay bar - RED */}
                      {delayWidth > 0 && (
                        <div
                          className="absolute flex items-center overflow-hidden cursor-pointer"
                          style={{
                            left: plannedLeft + plannedWidth,
                            top: BAR_TOP,
                            height: BAR_H,
                            width: delayWidth,
                            background: DELAY_COLOR.bg,
                            borderRadius: '0 4px 4px 0',
                            paddingLeft: 4,
                            paddingRight: 4,
                          }}
                          onDoubleClick={() => setEditingDelayLabelId(a.id)}
                        >
                          {editingDelayLabelId === a.id ? (
                            <input
                              autoFocus
                              defaultValue={a.delayLabel ?? ''}
                              onBlur={e => saveDelayLabel(a, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveDelayLabel(a, (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingDelayLabelId(null);
                              }}
                              className="w-full bg-transparent border-none outline-none text-[10px] font-semibold text-white placeholder:text-white/60"
                              placeholder="Texto atraso"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className="text-[10px] font-semibold truncate leading-none text-white" title="Doble clic para editar">
                              {a.delayLabel || ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Note to the right of the bar */}
                      <div
                        className="absolute flex items-center"
                        style={{
                          left: totalBarEnd + 6,
                          top: 0,
                          bottom: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {editingNoteId === a.id ? (
                          <input
                            autoFocus
                            defaultValue={a.timelineNote ?? ''}
                            onBlur={e => saveNote(a, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveNote(a, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingNoteId(null);
                            }}
                            className="bg-surface-2 border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-52"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="text-[10px] font-medium cursor-text px-1 rounded hover:bg-surface-2/60 transition-colors truncate"
                            style={{ color: 'hsl(var(--foreground))' }}
                            onClick={() => setEditingNoteId(a.id)}
                            title="Clic para editar nota"
                          >
                            {a.timelineNote || <span className="text-muted-foreground/40 italic">+ nota</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
