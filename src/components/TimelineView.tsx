import { useState, useRef, useEffect } from 'react';
import { Atencion, Tag, CHECKLIST_ITEMS } from '@/types/qa';
import { TagBadge } from './TagBadge';
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

// Colores sólidos por tag
const TAG_COLORS: Record<string, { bg: string; text: string; dimBg: string }> = {
  calidad:    { bg: '#D97706', text: '#fff', dimBg: '#D97706' },
  sap:        { bg: '#EA580C', text: '#fff', dimBg: '#EA580C' },
  core:       { bg: '#16A34A', text: '#fff', dimBg: '#16A34A' },
  desarrollo: { bg: '#2563EB', text: '#fff', dimBg: '#2563EB' },
  dl:         { bg: '#7C3AED', text: '#fff', dimBg: '#7C3AED' },
  rend:       { bg: '#DB2777', text: '#fff', dimBg: '#DB2777' },
};

const DEFAULT_COLOR = { bg: '#2563EB', text: '#fff', dimBg: '#2563EB' };
const PRIORITY_ORDER = ['dl', 'rend', 'desarrollo', 'core', 'sap', 'calidad'];

function getColor(a: Atencion) {
  for (const p of PRIORITY_ORDER) {
    if (a.tags.includes(p)) return TAG_COLORS[p] ?? DEFAULT_COLOR;
  }
  return DEFAULT_COLOR;
}

const LABEL_W = 240;
const MIN_COL_W = 18;
const ROW_H = 44;
const BAR_H = 20;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const HEADER_H = 28;
const DAY_HEADER_H = 32;

export function TimelineView({ atenciones, tags, onUpdateAtencion, onAddAtencion }: Props) {
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartAreaWidth, setChartAreaWidth] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Atencion>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBarLabelId, setEditingBarLabelId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    code: '', startDate: '', endDate: '',
    delayEndDate: '', timelineNote: '',
  });

  // Auto-fit: medir el ancho del área del gráfico
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const update = () => setChartAreaWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = atenciones
    .filter(a => a.startDate && a.endDate)
    .sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));

  // Calcular rango de fechas
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

  // Auto-fit: colWidth se ajusta al espacio disponible
  const colWidth = totalDays > 0 && chartAreaWidth > 0
    ? Math.max(MIN_COL_W, chartAreaWidth / totalDays)
    : 26;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Agrupar por mes
  const months: { label: string; count: number }[] = [];
  days.forEach(d => {
    const label = format(d, 'MMM yyyy', { locale: es });
    if (!months.length || months[months.length - 1].label !== label) {
      months.push({ label, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  // Handlers edición de fechas
  const startEdit = (a: Atencion) => {
    setEditingId(a.id);
    setEditData({
      startDate: a.startDate ?? '',
      endDate: a.endDate ?? '',
      delayEndDate: a.delayEndDate ?? '',
      timelineNote: a.timelineNote ?? '',
      barLabel: a.barLabel ?? '',
    });
  };
  const saveEdit = (a: Atencion) => {
    onUpdateAtencion({ ...a, ...editData });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  // Handler nota flotante inline
  const saveNote = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, timelineNote: val });
    setEditingNoteId(null);
  };

  // Handler texto dentro de la barra
  const saveBarLabel = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, barLabel: val });
    setEditingBarLabelId(null);
  };

  // Agregar nueva atención
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
      timelineNote: newItem.timelineNote || undefined,
    });
    setNewItem({ code: '', startDate: '', endDate: '', delayEndDate: '', timelineNote: '' });
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
            <span className="inline-block w-5 h-2.5 rounded-sm opacity-40 bg-foreground" />
            Atraso (extensión)
          </span>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar Atención
        </button>
      </div>

      {/* Formulario de agregar */}
      {showAdd && (
        <div className="bg-surface-2 border border-primary/30 rounded-lg p-3 space-y-2 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5 tracking-wide">Código *</label>
              <input
                value={newItem.code}
                onChange={e => setNewItem(p => ({ ...p, code: e.target.value }))}
                placeholder="RQ2026-99"
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5 tracking-wide">Inicio Planificado *</label>
              <input type="date" value={newItem.startDate} onChange={e => setNewItem(p => ({ ...p, startDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5 tracking-wide">Fin Planificado *</label>
              <input type="date" value={newItem.endDate} onChange={e => setNewItem(p => ({ ...p, endDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5 tracking-wide">Fin Atraso (si aplica)</label>
              <input type="date" value={newItem.delayEndDate} onChange={e => setNewItem(p => ({ ...p, delayEndDate: e.target.value }))}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5 tracking-wide">Nota al final de la barra</label>
              <input value={newItem.timelineNote} onChange={e => setNewItem(p => ({ ...p, timelineNote: e.target.value }))}
                placeholder="Ej: Atrasos Dev - C2"
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/90">Agregar</button>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground text-xs px-3 py-1.5 hover:text-foreground transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Timeline principal */}
      <div className="rounded-lg border border-border overflow-hidden flex-1">
        <div className="overflow-x-auto h-full">
          <div className="flex h-full" style={{ minWidth: LABEL_W + totalDays * MIN_COL_W }}>

            {/* Columna izquierda fija: labels */}
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex flex-col border-r border-border bg-surface-1 shrink-0 z-10">
              {/* Cabecera mes (espacio) */}
              <div style={{ height: HEADER_H }} className="border-b border-border" />
              {/* Cabecera día (espacio) */}
              <div style={{ height: DAY_HEADER_H }} className="flex items-center px-3 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Atención</span>
              </div>
              {/* Filas de atenciones */}
              {items.map((a, i) => {
                const isEditing = editingId === a.id;
                const atencionTags = tags.filter(t => a.tags.includes(t.id));
                const isOdd = i % 2 === 0;
                return (
                  <div key={a.id}>
                    <div
                      style={{ height: ROW_H }}
                      className={`flex items-center gap-2 px-2 border-b border-border/40 group ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'}`}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-mono font-semibold text-foreground truncate leading-tight">{a.code}</span>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {atencionTags.map(t => <TagBadge key={t.id} tag={t} />)}
                        </div>
                      </div>
                      <div className="shrink-0 flex gap-0.5">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(a)} className="text-green-500 hover:text-green-400 p-0.5">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelEdit} className="text-muted-foreground hover:text-destructive p-0.5">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(a)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-0.5 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Panel de edición de fechas — debajo del label */}
                    {isEditing && (
                      <div className="bg-surface-2/80 border-b border-primary/30 px-2 py-2 space-y-1.5">
                        <div className="grid grid-cols-1 gap-1.5">
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
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                              Fin Atraso
                            </label>
                            <input type="date" value={editData.delayEndDate || ''} onChange={e => setEditData(p => ({ ...p, delayEndDate: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Área del gráfico — auto-fit */}
            <div ref={chartAreaRef} className="flex-1 flex flex-col overflow-hidden">

              {/* Cabecera de meses */}
              <div style={{ height: HEADER_H }} className="flex border-b border-border bg-surface-2 shrink-0">
                {months.map((m, i) => (
                  <div
                    key={i}
                    style={{ width: m.count * colWidth, minWidth: m.count * colWidth }}
                    className="text-[10px] font-bold text-muted-foreground text-center border-r border-border flex items-center justify-center uppercase tracking-widest"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Cabecera de días */}
              <div style={{ height: DAY_HEADER_H }} className="flex border-b border-border bg-surface-1 shrink-0">
                {days.map((d, i) => {
                  const isToday = format(d, 'yyyy-MM-dd') === todayStr;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={i}
                      style={{ width: colWidth, minWidth: colWidth }}
                      className={`
                        flex flex-col items-center justify-center border-r border-border/50 select-none shrink-0
                        ${isToday ? 'bg-destructive/25 text-destructive font-bold' : isWeekend ? 'bg-surface-2/50 text-muted-foreground/50' : 'text-muted-foreground'}
                      `}
                    >
                      <span className="text-[9px] leading-none">{format(d, 'dd')}</span>
                      <span className="text-[8px] leading-none uppercase mt-0.5">{format(d, 'EEE', { locale: es }).slice(0, 2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Filas del gráfico */}
              <div className="flex-1 overflow-hidden">
                {items.map((a, rowIdx) => {
                  const isEditing = editingId === a.id;
                  const color = getColor(a);
                  const isOdd = rowIdx % 2 === 0;

                  const startIdx = differenceInCalendarDays(parseISO(a.startDate!), rangeStart);
                  const endIdx = differenceInCalendarDays(parseISO(a.endDate!), rangeStart);
                  const plannedLeft = startIdx * colWidth;
                  const plannedWidth = Math.max(colWidth, (endIdx - startIdx + 1) * colWidth);

                  // Extensión de atraso (desde fin planificado hasta fin de atraso)
                  let delayExtWidth = 0;
                  if (a.delayEndDate) {
                    const delayEndIdx = differenceInCalendarDays(parseISO(a.delayEndDate), rangeStart);
                    if (delayEndIdx > endIdx) {
                      delayExtWidth = (delayEndIdx - endIdx) * colWidth;
                    }
                  }

                  const totalBarWidth = plannedWidth + delayExtWidth;
                  const noteLeft = plannedLeft + totalBarWidth + 6;

                  return (
                    <div key={a.id}>
                      <div
                        style={{ height: ROW_H, position: 'relative' }}
                        className={`border-b border-border/30 ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'}`}
                      >
                        {/* Líneas verticales de días */}
                        {days.map((d, i) => {
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const isToday = format(d, 'yyyy-MM-dd') === todayStr;
                          return (
                            <div
                              key={i}
                              className={`absolute top-0 bottom-0 border-r border-border/20 pointer-events-none
                                ${isWeekend ? 'bg-surface-2/15' : ''}
                                ${isToday ? 'bg-destructive/10' : ''}`}
                              style={{ left: i * colWidth, width: colWidth }}
                            />
                          );
                        })}

                        {/* BARRA ÚNICA: parte planificada (sólido) + extensión de atraso (mismo color, semitransparente) */}
                        <div
                          className="absolute flex items-stretch cursor-pointer group/bar"
                          style={{
                            left: plannedLeft,
                            top: BAR_TOP,
                            height: BAR_H,
                            width: totalBarWidth,
                          }}
                        >
                          {/* Parte planificada */}
                          <div
                            className="flex items-center overflow-hidden select-none"
                            style={{
                              width: plannedWidth,
                              background: color.bg,
                              borderRadius: delayExtWidth > 0 ? '4px 0 0 4px' : '4px',
                              paddingLeft: 6,
                              paddingRight: delayExtWidth > 0 ? 0 : 6,
                              flexShrink: 0,
                            }}
                            onDoubleClick={() => setEditingBarLabelId(a.id)}
                          >
                            {editingBarLabelId === a.id ? (
                              <input
                                autoFocus
                                defaultValue={a.barLabel ?? ''}
                                onBlur={e => saveBarLabel(a, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveBarLabel(a, (e.target as HTMLInputElement).value);
                                  if (e.key === 'Escape') setEditingBarLabelId(null);
                                }}
                                className="w-full bg-transparent border-none outline-none text-[10px] font-semibold text-white placeholder:text-white/60"
                                placeholder={a.code}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="text-[10px] font-semibold truncate leading-none"
                                style={{ color: color.text }}
                                title="Doble clic para editar texto dentro de la barra"
                              >
                                {a.barLabel || a.code}
                              </span>
                            )}
                          </div>

                          {/* Extensión de atraso (mismo color, 45% opacidad + patrón diagonal) */}
                          {delayExtWidth > 0 && (
                            <div
                              className="flex-shrink-0 relative overflow-hidden"
                              style={{
                                width: delayExtWidth,
                                background: color.bg,
                                opacity: 0.45,
                                borderRadius: '0 4px 4px 0',
                              }}
                            >
                              {/* Patrón de rayas para indicar atraso */}
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage: `repeating-linear-gradient(
                                    -45deg,
                                    transparent,
                                    transparent 4px,
                                    rgba(0,0,0,0.35) 4px,
                                    rgba(0,0,0,0.35) 7px
                                  )`,
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Nota flotante al final de la barra */}
                        <div
                          className="absolute flex items-center"
                          style={{
                            left: noteLeft,
                            top: 0,
                            bottom: 0,
                            maxWidth: 200,
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
                              className="bg-surface-2 border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className="text-[10px] font-medium cursor-text px-1 rounded hover:bg-surface-2/60 transition-colors truncate"
                              style={{ color: '#FCA5A5' }}
                              onClick={() => setEditingNoteId(a.id)}
                              title="Clic para editar nota"
                            >
                              {a.timelineNote || (
                                <span className="text-muted-foreground/40 italic">+ nota</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Panel de edición expandido (fechas) — aparece debajo de la fila cuando se edita */}
                      {isEditing && (
                        <div
                          className="flex items-center gap-3 px-3 py-2 bg-surface-2/70 border-b border-primary/25"
                          style={{ height: 'auto' }}
                        >
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold shrink-0">Fechas:</span>
                          <div className="flex gap-2 flex-wrap">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase text-muted-foreground/70">Inicio Plan</label>
                              <input type="date" value={editData.startDate || ''} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))}
                                className="bg-surface-0 border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase text-muted-foreground/70">Fin Plan</label>
                              <input type="date" value={editData.endDate || ''} onChange={e => setEditData(p => ({ ...p, endDate: e.target.value }))}
                                className="bg-surface-0 border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] uppercase text-muted-foreground/70 flex items-center gap-1">
                                Fin Atraso
                              </label>
                              <input type="date" value={editData.delayEndDate || ''} onChange={e => setEditData(p => ({ ...p, delayEndDate: e.target.value }))}
                                className="bg-surface-0 border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                            </div>
                          </div>
                        </div>
                      )}
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
