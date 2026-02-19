import { useState } from 'react';
import { Atencion, Tag, CHECKLIST_ITEMS } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  atenciones: Atencion[];
  tags: Tag[];
  onUpdateAtencion: (a: Atencion) => void;
  onAddAtencion: (a: Atencion) => void;
}

export function TimelineView({ atenciones, tags, onUpdateAtencion, onAddAtencion }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Atencion>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ code: '', startDate: '', endDate: '', delayStartDate: '', delayEndDate: '', timelineNote: '' });

  const items = atenciones
    .filter(a => a.startDate && a.endDate)
    .sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));

  // Calculate date range from all dates
  const allDates: Date[] = [];
  items.forEach(a => {
    allDates.push(parseISO(a.startDate!), parseISO(a.endDate!));
    if (a.delayStartDate) allDates.push(parseISO(a.delayStartDate));
    if (a.delayEndDate) allDates.push(parseISO(a.delayEndDate));
  });

  if (allDates.length === 0 && !showAdd) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Sin atenciones con fechas configuradas
        <div className="mt-3">
          <button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Agregar Atención
          </button>
        </div>
      </div>
    );
  }

  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 30);

  // Add padding days
  const rangeStart = addDays(minDate, -2);
  const rangeEnd = addDays(maxDate, 3);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const totalDays = days.length;

  const today = new Date();
  const todayIdx = differenceInCalendarDays(today, rangeStart);
  const todayPct = (todayIdx / totalDays) * 100;

  const getBarColor = (a: Atencion) => {
    if (a.tags.includes('calidad') && a.tags.includes('sap')) return 'bg-tag-calidad/80';
    if (a.tags.includes('calidad') && a.tags.includes('core')) return 'bg-tag-core/80';
    if (a.tags.includes('desarrollo')) return 'bg-tag-desarrollo/80';
    if (a.tags.includes('calidad')) return 'bg-tag-calidad/80';
    return 'bg-primary/60';
  };

  const startEdit = (a: Atencion) => {
    setEditingId(a.id);
    setEditData({ startDate: a.startDate, endDate: a.endDate, delayStartDate: a.delayStartDate || '', delayEndDate: a.delayEndDate || '', timelineNote: a.timelineNote || '' });
  };

  const saveEdit = (a: Atencion) => {
    onUpdateAtencion({ ...a, ...editData });
    setEditingId(null);
  };

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
      delayStartDate: newItem.delayStartDate || undefined,
      delayEndDate: newItem.delayEndDate || undefined,
      timelineNote: newItem.timelineNote || undefined,
    });
    setNewItem({ code: '', startDate: '', endDate: '', delayStartDate: '', delayEndDate: '', timelineNote: '' });
    setShowAdd(false);
  };

  // Group days by month for header
  const months: { label: string; startIdx: number; count: number }[] = [];
  days.forEach((d, i) => {
    const label = format(d, 'MMM yyyy', { locale: es });
    if (months.length === 0 || months[months.length - 1].label !== label) {
      months.push({ label, startIdx: i, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  const colWidth = 28;
  const labelWidth = 160;
  const noteWidth = 180;
  const chartWidth = totalDays * colWidth;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1">
          <Plus className="w-3 h-3" /> Agregar Atención
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface-2 border border-primary/30 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={newItem.code} onChange={e => setNewItem(p => ({ ...p, code: e.target.value }))} placeholder="Código" className="bg-surface-0 border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-1">
            <input type="date" value={newItem.startDate} onChange={e => setNewItem(p => ({ ...p, startDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1" title="Inicio planificado" />
            <input type="date" value={newItem.endDate} onChange={e => setNewItem(p => ({ ...p, endDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1" title="Fin planificado" />
          </div>
          <div className="flex gap-1">
            <input type="date" value={newItem.delayStartDate} onChange={e => setNewItem(p => ({ ...p, delayStartDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1" title="Inicio atraso" />
            <input type="date" value={newItem.delayEndDate} onChange={e => setNewItem(p => ({ ...p, delayEndDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1" title="Fin atraso" />
          </div>
          <input value={newItem.timelineNote} onChange={e => setNewItem(p => ({ ...p, timelineNote: e.target.value }))} placeholder="Detalle / Nota" className="bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="col-span-2 md:col-span-4 flex gap-1">
            <button onClick={handleAdd} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded">Agregar</button>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground text-xs px-2 py-1">Cancelar</button>
          </div>
        </div>
      )}

      {/* Timeline chart */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: labelWidth + chartWidth + noteWidth }}>
          {/* Month headers */}
          <div className="flex">
            <div style={{ width: labelWidth, minWidth: labelWidth }} />
            <div className="flex flex-1">
              {months.map((m, i) => (
                <div key={i} style={{ width: m.count * colWidth }} className="text-[10px] font-semibold text-muted-foreground text-center border-b border-border py-1 uppercase">
                  {m.label}
                </div>
              ))}
            </div>
            <div style={{ width: noteWidth, minWidth: noteWidth }} />
          </div>

          {/* Day headers */}
          <div className="flex">
            <div style={{ width: labelWidth, minWidth: labelWidth }} className="text-[9px] text-muted-foreground px-2 py-1 border-b border-border">Atención</div>
            <div className="flex">
              {days.map((d, i) => {
                const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    style={{ width: colWidth }}
                    className={`text-[8px] text-center py-1 border-b border-r border-border ${isToday ? 'bg-destructive/20 text-destructive font-bold' : isWeekend ? 'bg-surface-2 text-muted-foreground' : 'text-muted-foreground'}`}
                  >
                    <div>{format(d, 'dd')}</div>
                    <div>{format(d, 'EEE', { locale: es }).slice(0, 2)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ width: noteWidth, minWidth: noteWidth }} className="text-[9px] text-muted-foreground px-2 py-1 border-b border-border">Detalle</div>
          </div>

          {/* Rows */}
          {items.map(a => {
            const isEditing = editingId === a.id;
            const startIdx = differenceInCalendarDays(parseISO(a.startDate!), rangeStart);
            const endIdx = differenceInCalendarDays(parseISO(a.endDate!), rangeStart);
            const plannedLeft = startIdx * colWidth;
            const plannedWidth = Math.max(colWidth, (endIdx - startIdx + 1) * colWidth);

            let delayLeft = 0, delayWidth = 0;
            if (a.delayStartDate && a.delayEndDate) {
              const dStartIdx = differenceInCalendarDays(parseISO(a.delayStartDate), rangeStart);
              const dEndIdx = differenceInCalendarDays(parseISO(a.delayEndDate), rangeStart);
              delayLeft = dStartIdx * colWidth;
              delayWidth = Math.max(colWidth, (dEndIdx - dStartIdx + 1) * colWidth);
            }

            const atencionTags = tags.filter(t => a.tags.includes(t.id));

            return (
              <div key={a.id} className="flex group border-b border-border/50 hover:bg-surface-2/50">
                {/* Label */}
                <div style={{ width: labelWidth, minWidth: labelWidth }} className="flex items-center gap-1.5 px-2 py-1.5">
                  <span className="text-[10px] font-mono font-semibold text-foreground">{a.code}</span>
                  <div className="flex gap-0.5">
                    {atencionTags.slice(0, 2).map(t => (
                      <TagBadge key={t.id} tag={t} />
                    ))}
                  </div>
                  <button onClick={() => isEditing ? saveEdit(a) : startEdit(a)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary ml-auto">
                    {isEditing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </button>
                </div>

                {/* Chart area */}
                <div className="relative" style={{ width: chartWidth }}>
                  {/* Day grid lines */}
                  {days.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                    return (
                      <div key={i} className={`absolute top-0 bottom-0 border-r border-border/30 ${isWeekend ? 'bg-surface-2/30' : ''} ${isToday ? 'bg-destructive/10' : ''}`} style={{ left: i * colWidth, width: colWidth }} />
                    );
                  })}

                  {/* Planned bar */}
                  <div
                    className={`absolute top-1 h-3 rounded-sm ${getBarColor(a)}`}
                    style={{ left: plannedLeft, width: plannedWidth }}
                    title={`Plan: ${a.startDate} → ${a.endDate}`}
                  />

                  {/* Delay bar */}
                  {delayWidth > 0 && (
                    <div
                      className="absolute bottom-1 h-3 rounded-sm bg-destructive/70"
                      style={{ left: delayLeft, width: delayWidth }}
                      title={`Atraso: ${a.delayStartDate} → ${a.delayEndDate}`}
                    />
                  )}
                </div>

                {/* Note / Detail */}
                <div style={{ width: noteWidth, minWidth: noteWidth }} className="flex items-center px-2">
                  {isEditing ? (
                    <input
                      value={editData.timelineNote || ''}
                      onChange={e => setEditData(p => ({ ...p, timelineNote: e.target.value }))}
                      className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Detalle..."
                    />
                  ) : (
                    <span className="text-[10px] text-destructive font-medium truncate">{a.timelineNote || ''}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Edit row inline */}
          {editingId && (() => {
            const a = items.find(x => x.id === editingId);
            if (!a) return null;
            return (
              <div className="bg-surface-2/50 border border-primary/20 rounded p-2 mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-xs text-muted-foreground">
                  <span className="block text-[9px] uppercase mb-0.5">Inicio Plan</span>
                  <input type="date" value={editData.startDate || ''} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="block text-[9px] uppercase mb-0.5">Fin Plan</span>
                  <input type="date" value={editData.endDate || ''} onChange={e => setEditData(p => ({ ...p, endDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="block text-[9px] uppercase mb-0.5">Inicio Atraso</span>
                  <input type="date" value={editData.delayStartDate || ''} onChange={e => setEditData(p => ({ ...p, delayStartDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="block text-[9px] uppercase mb-0.5">Fin Atraso</span>
                  <input type="date" value={editData.delayEndDate || ''} onChange={e => setEditData(p => ({ ...p, delayEndDate: e.target.value }))} className="bg-surface-0 border border-border rounded px-1 py-1 text-xs text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
