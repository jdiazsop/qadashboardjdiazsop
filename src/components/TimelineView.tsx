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

// Tag color map — sólidos para barras del timeline
const TAG_BAR_COLORS: Record<string, string> = {
  calidad:   '#E9A91E',  // amarillo
  sap:       '#F97316',  // naranja
  core:      '#22C55E',  // verde
  desarrollo:'#3B82F6',  // azul
  dl:        '#A855F7',  // violeta
  rend:      '#EC4899',  // rosa
};

const DELAY_BAR_COLOR = '#EF4444'; // rojo

function getBarColor(a: Atencion): string {
  // Prioridad de tags para el color de barra
  const priority = ['desarrollo', 'dl', 'rend', 'core', 'sap', 'calidad'];
  for (const p of priority) {
    if (a.tags.includes(p)) return TAG_BAR_COLORS[p];
  }
  return '#3B82F6';
}

export function TimelineView({ atenciones, tags, onUpdateAtencion, onAddAtencion }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Atencion>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    code: '', startDate: '', endDate: '',
    delayStartDate: '', delayEndDate: '', timelineNote: '',
  });

  const items = atenciones
    .filter(a => a.startDate && a.endDate)
    .sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));

  // Calcular rango total de fechas
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
          <button
            onClick={() => setShowAdd(true)}
            className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar Atención
          </button>
        </div>
      </div>
    );
  }

  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date();
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : addDays(new Date(), 30);

  const rangeStart = addDays(minDate, -2);
  const rangeEnd = addDays(maxDate, 3);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const totalDays = days.length;

  const today = new Date();

  // Agrupar días por mes para cabecera
  const months: { label: string; count: number }[] = [];
  days.forEach(d => {
    const label = format(d, 'MMM yyyy', { locale: es });
    if (months.length === 0 || months[months.length - 1].label !== label) {
      months.push({ label, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  const COL_W = 30;       // ancho de cada día en px
  const LABEL_W = 260;    // columna "Atención" - ancha
  const NOTE_W = 200;     // columna "Detalle"
  const ROW_H = 52;       // altura de fila (suficiente para 2 barras)
  const BAR_H = 14;       // altura de cada barra
  const BAR_GAP = 4;      // separación entre barras
  const BAR_TOP = 10;     // posición top de la primera barra (planificada)

  const chartWidth = totalDays * COL_W;

  const startEdit = (a: Atencion) => {
    setEditingId(a.id);
    setEditData({
      startDate: a.startDate,
      endDate: a.endDate,
      delayStartDate: a.delayStartDate || '',
      delayEndDate: a.delayEndDate || '',
      timelineNote: a.timelineNote || '',
    });
  };

  const saveEdit = (a: Atencion) => {
    onUpdateAtencion({ ...a, ...editData });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

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

  return (
    <div className="space-y-3">
      {/* Header row: button + leyenda */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: TAG_BAR_COLORS.calidad }} />
            Calidad
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: TAG_BAR_COLORS.sap }} />
            SAP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: TAG_BAR_COLORS.core }} />
            CORE
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: TAG_BAR_COLORS.desarrollo }} />
            Desarrollo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: TAG_BAR_COLORS.dl }} />
            DL
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-3 rounded-sm" style={{ background: DELAY_BAR_COLOR }} />
            Atraso
          </span>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Agregar Atención
        </button>
      </div>

      {/* Form agregar */}
      {showAdd && (
        <div className="bg-surface-2 border border-primary/30 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Código</label>
              <input
                value={newItem.code}
                onChange={e => setNewItem(p => ({ ...p, code: e.target.value }))}
                placeholder="Ej: RQ2026-99"
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Inicio Planificado</label>
              <input type="date" value={newItem.startDate} onChange={e => setNewItem(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Fin Planificado</label>
              <input type="date" value={newItem.endDate} onChange={e => setNewItem(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Inicio Atraso</label>
              <input type="date" value={newItem.delayStartDate} onChange={e => setNewItem(p => ({ ...p, delayStartDate: e.target.value }))} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Fin Atraso</label>
              <input type="date" value={newItem.delayEndDate} onChange={e => setNewItem(p => ({ ...p, delayEndDate: e.target.value }))} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Detalle / Nota</label>
              <input
                value={newItem.timelineNote}
                onChange={e => setNewItem(p => ({ ...p, timelineNote: e.target.value }))}
                placeholder="Comentario de estado..."
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/90">Agregar</button>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground text-xs px-3 py-1.5 hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* Timeline grid */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <div style={{ minWidth: LABEL_W + chartWidth + NOTE_W }}>

          {/* Fila meses */}
          <div className="flex bg-surface-2">
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-border" />
            <div className="flex">
              {months.map((m, i) => (
                <div
                  key={i}
                  style={{ width: m.count * COL_W }}
                  className="text-[10px] font-bold text-muted-foreground text-center border-r border-border py-1.5 uppercase tracking-wider"
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div style={{ width: NOTE_W, minWidth: NOTE_W }} className="border-l border-border" />
          </div>

          {/* Fila días */}
          <div className="flex bg-surface-1 border-b border-border">
            <div
              style={{ width: LABEL_W, minWidth: LABEL_W }}
              className="flex items-center px-3 py-1 border-r border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Atención
            </div>
            <div className="flex">
              {days.map((d, i) => {
                const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    style={{ width: COL_W }}
                    className={`
                      flex flex-col items-center justify-center py-1 border-r border-border text-center
                      ${isToday ? 'bg-destructive/25 text-destructive font-bold' : isWeekend ? 'bg-surface-2/60 text-muted-foreground/60' : 'text-muted-foreground'}
                    `}
                  >
                    <span className="text-[9px] leading-tight">{format(d, 'dd')}</span>
                    <span className="text-[8px] leading-tight uppercase">{format(d, 'EEE', { locale: es }).slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>
            <div
              style={{ width: NOTE_W, minWidth: NOTE_W }}
              className="flex items-center px-3 border-l border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Detalle
            </div>
          </div>

          {/* Filas de atenciones */}
          {items.map((a, rowIdx) => {
            const isEditing = editingId === a.id;
            const atencionTags = tags.filter(t => a.tags.includes(t.id));
            const barColor = getBarColor(a);

            const startIdx = differenceInCalendarDays(parseISO(a.startDate!), rangeStart);
            const endIdx = differenceInCalendarDays(parseISO(a.endDate!), rangeStart);
            const plannedLeft = startIdx * COL_W;
            const plannedWidth = Math.max(COL_W, (endIdx - startIdx + 1) * COL_W);

            let delayLeft = 0, delayWidth = 0;
            if (a.delayStartDate && a.delayEndDate) {
              const dStartIdx = differenceInCalendarDays(parseISO(a.delayStartDate), rangeStart);
              const dEndIdx = differenceInCalendarDays(parseISO(a.delayEndDate), rangeStart);
              delayLeft = dStartIdx * COL_W;
              delayWidth = Math.max(COL_W, (dEndIdx - dStartIdx + 1) * COL_W);
            }

            const isOdd = rowIdx % 2 === 0;

            return (
              <div key={a.id}>
                {/* Fila principal */}
                <div
                  className={`flex group border-b border-border/40 hover:bg-surface-2/80 transition-colors ${isOdd ? 'bg-surface-0' : 'bg-surface-1/50'}`}
                  style={{ height: ROW_H }}
                >
                  {/* Columna Atención — ancha */}
                  <div
                    style={{ width: LABEL_W, minWidth: LABEL_W, height: ROW_H }}
                    className="flex items-center gap-2 px-3 border-r border-border shrink-0"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-mono font-semibold text-foreground truncate">{a.code}</span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {atencionTags.map(t => (
                          <TagBadge key={t.id} tag={t} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
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
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Área del gráfico */}
                  <div className="relative flex-shrink-0" style={{ width: chartWidth, height: ROW_H }}>
                    {/* Líneas verticales de días */}
                    {days.map((d, i) => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                      return (
                        <div
                          key={i}
                          className={`absolute top-0 bottom-0 border-r border-border/25 ${isWeekend ? 'bg-surface-2/20' : ''} ${isToday ? 'bg-destructive/10' : ''}`}
                          style={{ left: i * COL_W, width: COL_W }}
                        />
                      );
                    })}

                    {/* Barra planificada (arriba) */}
                    <div
                      className="absolute rounded-sm shadow-sm"
                      style={{
                        left: plannedLeft,
                        width: plannedWidth,
                        top: BAR_TOP,
                        height: BAR_H,
                        background: barColor,
                        opacity: 0.85,
                      }}
                      title={`Planificado: ${a.startDate} → ${a.endDate}`}
                    />

                    {/* Barra atraso (abajo) — solo si existe */}
                    {delayWidth > 0 && (
                      <div
                        className="absolute rounded-sm shadow-sm"
                        style={{
                          left: delayLeft,
                          width: delayWidth,
                          top: BAR_TOP + BAR_H + BAR_GAP,
                          height: BAR_H,
                          background: DELAY_BAR_COLOR,
                          opacity: 0.85,
                        }}
                        title={`Atraso: ${a.delayStartDate} → ${a.delayEndDate}`}
                      />
                    )}
                  </div>

                  {/* Columna detalle */}
                  <div
                    style={{ width: NOTE_W, minWidth: NOTE_W, height: ROW_H }}
                    className="flex items-center px-3 border-l border-border shrink-0"
                  >
                    {isEditing ? (
                      <input
                        value={editData.timelineNote || ''}
                        onChange={e => setEditData(p => ({ ...p, timelineNote: e.target.value }))}
                        className="w-full bg-surface-0 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Detalle..."
                      />
                    ) : (
                      <span className="text-[11px] text-destructive font-medium line-clamp-2 leading-tight">
                        {a.timelineNote || ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fila de edición de fechas (solo cuando se edita) */}
                {isEditing && (
                  <div className="flex bg-surface-2/60 border-b border-primary/30 px-3 py-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] uppercase text-muted-foreground tracking-wide">Inicio Plan</label>
                      <input type="date" value={editData.startDate || ''} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))}
                        className="bg-surface-0 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] uppercase text-muted-foreground tracking-wide">Fin Plan</label>
                      <input type="date" value={editData.endDate || ''} onChange={e => setEditData(p => ({ ...p, endDate: e.target.value }))}
                        className="bg-surface-0 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                        <span className="inline-block w-3 h-2 rounded-sm" style={{ background: DELAY_BAR_COLOR }} />
                        Inicio Atraso
                      </label>
                      <input type="date" value={editData.delayStartDate || ''} onChange={e => setEditData(p => ({ ...p, delayStartDate: e.target.value }))}
                        className="bg-surface-0 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                        <span className="inline-block w-3 h-2 rounded-sm" style={{ background: DELAY_BAR_COLOR }} />
                        Fin Atraso
                      </label>
                      <input type="date" value={editData.delayEndDate || ''} onChange={e => setEditData(p => ({ ...p, delayEndDate: e.target.value }))}
                        className="bg-surface-0 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
