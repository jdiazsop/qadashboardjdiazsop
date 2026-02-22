import { useState, useRef, useEffect, useCallback } from 'react';
import { Atencion, Tag, KanbanColumn, CHECKLIST_ITEMS, TestCycle, computeDatesFromCycles, computeCycleDelay } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { Plus, Pencil, Check, X, Eye, EyeOff, GripVertical, ChevronDown, ChevronRight, MapPin, Trash2, CheckCircle2, Circle } from 'lucide-react';
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
  columns: KanbanColumn[];
  onUpdateAtencion: (a: Atencion) => void;
  onAddAtencion: (a: Atencion) => void;
  onReorderAtenciones: (atenciones: Atencion[]) => void;
}

const BAR_BLUE = '#2563EB';
const BAR_GREEN = '#16A34A';
const DELAY_RED = '#DC2626';
const CYCLE_BLUE = '#3B82F6';
const CYCLE_DELAY = '#EF4444';
const REAL_START_COLOR = '#F59E0B';

function isCompleted(a: Atencion): boolean {
  return a.columnId.toLowerCase().includes('completado');
}

function getBarColor(a: Atencion): string {
  return isCompleted(a) ? BAR_GREEN : BAR_BLUE;
}

const LABEL_W = 280;
const MIN_COL_W = 18;
const ROW_H = 44;
const SUB_ROW_H = 30;
const BAR_H = 24;
const SUB_BAR_H = 16;
const BAR_TOP = (ROW_H - BAR_H) / 2;
const SUB_BAR_TOP = (SUB_ROW_H - SUB_BAR_H) / 2;
const HEADER_H = 24;
const DAY_HEADER_H = 28;

export function TimelineView({ atenciones, tags, columns, onUpdateAtencion, onAddAtencion, onReorderAtenciones }: Props) {
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartAreaWidth, setChartAreaWidth] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Atencion>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingDelayLabelId, setEditingDelayLabelId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [editCycleData, setEditCycleData] = useState<Partial<TestCycle>>({});
  const [editingCycleLabelId, setEditingCycleLabelId] = useState<string | null>(null);
  const [editingCycleNoteId, setEditingCycleNoteId] = useState<string | null>(null);
  const [editingCycleDelayId, setEditingCycleDelayId] = useState<string | null>(null);

  // Drag state for cycle bars
  type DragMode = 'move' | 'resize-left' | 'resize-right';
  const dragRef = useRef<{
    atencionId: string;
    cycleId: string;
    mode: DragMode;
    startX: number;
    origStartDate: string;
    origEndDate: string;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState(0); // pixels delta during drag
  const [draggingCycleId, setDraggingCycleId] = useState<string | null>(null);

  const handleCycleBarMouseDown = useCallback((
    e: React.MouseEvent,
    atencion: Atencion,
    cycle: TestCycle,
    mode: DragMode,
  ) => {
    if (!cycle.startDate || !cycle.endDate) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      atencionId: atencion.id,
      cycleId: cycle.id,
      mode,
      startX: e.clientX,
      origStartDate: cycle.startDate,
      origEndDate: cycle.endDate,
    };
    setDraggingCycleId(cycle.id);
    setDragDelta(0);
  }, []);


  const toggleCycleCompleted = (atencion: Atencion, cycleId: string) => {
    const newCycles = (atencion.cycles ?? []).map(c =>
      c.id === cycleId ? { ...c, completed: !c.completed } : c
    );
    onUpdateAtencion({ ...atencion, cycles: newCycles });
  };

  const [newItem, setNewItem] = useState({
    code: '', startDate: '', endDate: '',
    delayEndDate: '', delayLabel: '', timelineNote: '',
  });

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const update = () => setChartAreaWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allItems = atenciones
    .filter(a => a.startDate && a.endDate)
    .sort((a, b) => {
      const aComp = isCompleted(a) ? 1 : 0;
      const bComp = isCompleted(b) ? 1 : 0;
      if (aComp !== bComp) return aComp - bComp;
      return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    });

  const items = hideCompleted ? allItems.filter(a => !isCompleted(a)) : allItems;

  const allDates: Date[] = [];
  items.forEach(a => {
    allDates.push(parseISO(a.startDate!), parseISO(a.endDate!));
    if (a.delayEndDate) allDates.push(parseISO(a.delayEndDate));
    (a.cycles ?? []).forEach(c => {
      if (c.startDate) allDates.push(parseISO(c.startDate));
      if (c.endDate) allDates.push(parseISO(c.endDate));
      if (c.realEndDate) allDates.push(parseISO(c.realEndDate));
    });
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

  // Drag effect for cycle bars
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setDragDelta(e.clientX - dragRef.current.startX);
    };
    const handleMouseUp = () => {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const daysDelta = Math.round(dragDelta / colWidth);
      if (daysDelta !== 0) {
        const atencion = atenciones.find(a => a.id === drag.atencionId);
        if (atencion) {
          const origStart = parseISO(drag.origStartDate);
          const origEnd = parseISO(drag.origEndDate);
          let newStart: Date, newEnd: Date;

          if (drag.mode === 'move') {
            newStart = addDays(origStart, daysDelta);
            newEnd = addDays(origEnd, daysDelta);
          } else if (drag.mode === 'resize-left') {
            newStart = addDays(origStart, daysDelta);
            newEnd = origEnd;
            if (newStart >= newEnd) newStart = addDays(newEnd, -1);
          } else {
            newStart = origStart;
            newEnd = addDays(origEnd, daysDelta);
            if (newEnd <= newStart) newEnd = addDays(newStart, 1);
          }

          const newCycles = (atencion.cycles ?? []).map(c =>
            c.id === drag.cycleId
              ? { ...c, startDate: format(newStart, 'yyyy-MM-dd'), endDate: format(newEnd, 'yyyy-MM-dd') }
              : c
          );
          const computed = computeDatesFromCycles(newCycles);
          onUpdateAtencion({
            ...atencion,
            cycles: newCycles,
            startDate: computed.startDate || atencion.startDate,
            endDate: computed.endDate || atencion.endDate,
            delayEndDate: computed.delayEndDate || undefined,
            delayLabel: computed.delayLabel || undefined,
          });
        }
      }
      dragRef.current = null;
      setDraggingCycleId(null);
      setDragDelta(0);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragDelta, colWidth, atenciones, onUpdateAtencion]);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const months: { label: string; count: number }[] = [];
  days.forEach(d => {
    const label = format(d, 'MMMM', { locale: es });
    if (!months.length || months[months.length - 1].label !== label) {
      months.push({ label, count: 1 });
    } else {
      months[months.length - 1].count++;
    }
  });

  const startEdit = (a: Atencion) => {
    setEditingId(a.id);
    setEditData({
      delayEndDate: a.delayEndDate ?? '',
      delayLabel: a.delayLabel ?? '',
      timelineNote: a.timelineNote ?? '',
      realStartDate: a.realStartDate ?? '',
    });
  };
  const saveEdit = (a: Atencion) => {
    // Only save manual fields — planned dates & delayEndDate are auto-calculated from cycles
    onUpdateAtencion({ ...a, delayLabel: editData.delayLabel || undefined, timelineNote: editData.timelineNote || undefined, realStartDate: editData.realStartDate || undefined });
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  const startEditCycle = (cycle: TestCycle) => {
    setEditingCycleId(cycle.id);
     setEditCycleData({
      startDate: cycle.startDate ?? '',
      endDate: cycle.endDate ?? '',
      realStartDate: cycle.realStartDate ?? '',
      realEndDate: cycle.realEndDate ?? '',
      delayLabel: cycle.delayLabel ?? '',
      note: cycle.note ?? '',
    });
  };
  const saveEditCycle = (atencion: Atencion, cycleId: string) => {
    const newCycles = (atencion.cycles ?? []).map(c =>
      c.id === cycleId ? { ...c, ...editCycleData } : c
    );
    const computed = computeDatesFromCycles(newCycles);
    onUpdateAtencion({
      ...atencion,
      cycles: newCycles,
      startDate: computed.startDate || atencion.startDate,
      endDate: computed.endDate || atencion.endDate,
      delayEndDate: computed.delayEndDate || undefined,
      delayLabel: computed.delayLabel || undefined,
    });
    setEditingCycleId(null);
  };
  const cancelEditCycle = () => setEditingCycleId(null);
  const addCycleToTimeline = (atencion: Atencion) => {
    const cycles = atencion.cycles ?? [];
    const num = cycles.length + 1;
    const newCycle: TestCycle = { id: Date.now().toString(), label: `C${num}` };
    const newCycles = [...cycles, newCycle];
    const computed = computeDatesFromCycles(newCycles);
    onUpdateAtencion({ ...atencion, cycles: newCycles, ...computed });
  };

  const deleteCycleFromTimeline = (atencion: Atencion, cycleId: string) => {
    const newCycles = (atencion.cycles ?? []).filter(c => c.id !== cycleId);
    const computed = computeDatesFromCycles(newCycles);
    onUpdateAtencion({
      ...atencion,
      cycles: newCycles,
      startDate: computed.startDate || atencion.startDate,
      endDate: computed.endDate || atencion.endDate,
      delayEndDate: computed.delayEndDate || undefined,
      delayLabel: computed.delayLabel || undefined,
    });
    setEditingCycleId(null);
  };

  const saveNote = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, timelineNote: val });
    setEditingNoteId(null);
  };

  const saveDelayLabel = (a: Atencion, val: string) => {
    onUpdateAtencion({ ...a, delayLabel: val });
    setEditingDelayLabelId(null);
  };

  const saveCycleLabel = (atencion: Atencion, cycleId: string, val: string) => {
    const newCycles = (atencion.cycles ?? []).map(c =>
      c.id === cycleId ? { ...c, label: val || c.label } : c
    );
    onUpdateAtencion({ ...atencion, cycles: newCycles });
    setEditingCycleLabelId(null);
  };

  const saveCycleNote = (atencion: Atencion, cycleId: string, val: string) => {
    const newCycles = (atencion.cycles ?? []).map(c =>
      c.id === cycleId ? { ...c, note: val } : c
    );
    onUpdateAtencion({ ...atencion, cycles: newCycles });
    setEditingCycleNoteId(null);
  };

  const saveCycleDelayLabel = (atencion: Atencion, cycleId: string, val: string) => {
    const newCycles = (atencion.cycles ?? []).map(c =>
      c.id === cycleId ? { ...c, delayLabel: val } : c
    );
    const computed = computeDatesFromCycles(newCycles);
    onUpdateAtencion({ ...atencion, cycles: newCycles, delayLabel: computed.delayLabel || undefined });
    setEditingCycleDelayId(null);
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
      delayEndDate: newItem.delayEndDate || undefined,
      delayLabel: newItem.delayLabel || undefined,
      timelineNote: newItem.timelineNote || undefined,
      
    });
    setNewItem({ code: '', startDate: '', endDate: '', delayEndDate: '', delayLabel: '', timelineNote: '' });
    setShowAdd(false);
  };

  const handleRowDragStart = (e: React.DragEvent, id: string) => {
    setDragRowId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragRowId || dragRowId === targetId) return;

    const currentOrder = [...items];
    const dragIdx = currentOrder.findIndex(a => a.id === dragRowId);
    const targetIdx = currentOrder.findIndex(a => a.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;

    const [moved] = currentOrder.splice(dragIdx, 1);
    currentOrder.splice(targetIdx, 0, moved);

    const updated = atenciones.map(a => {
      const newIdx = currentOrder.findIndex(x => x.id === a.id);
      if (newIdx >= 0) return { ...a, sortOrder: newIdx };
      return a;
    });

    onReorderAtenciones(updated);
    setDragRowId(null);
  };

  if (allDates.length === 0 && !showAdd) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm space-y-3">
        <p>Sin atenciones con fechas configuradas</p>
        <button onClick={() => setShowAdd(true)}
          className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded hover:bg-primary/90 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Agregar Atención
        </button>
      </div>
    );
  }

  const todayIdx = differenceInCalendarDays(today, rangeStart);
  const completedCount = allItems.filter(a => isCompleted(a)).length;

  // Helper to render a bar (planned + delay + real start marker)
  function renderBar(
    startDate: string | undefined,
    endDate: string | undefined,
    delayEndDate: string | undefined,
    realStartDate: string | undefined,
    barColor: string,
    barH: number,
    barTop: number,
    label: string,
    delayLabel: string | undefined,
    isMainRow: boolean,
    atencionForEdit?: Atencion,
    cycleForEdit?: TestCycle,
    tooltipAbove?: boolean,
  ) {
    if (!startDate || !endDate) return null;
    const startIdx = differenceInCalendarDays(parseISO(startDate), rangeStart);
    const endIdx = differenceInCalendarDays(parseISO(endDate), rangeStart);
    let plannedLeft = startIdx * colWidth;
    let plannedWidth = Math.max(colWidth, (endIdx - startIdx + 1) * colWidth);

    // Apply visual drag offset for cycle bars being dragged
    const isDragging = !isMainRow && cycleForEdit && draggingCycleId === cycleForEdit.id;
    if (isDragging && dragRef.current) {
      const mode = dragRef.current.mode;
      if (mode === 'move') {
        plannedLeft += dragDelta;
      } else if (mode === 'resize-left') {
        plannedLeft += dragDelta;
        plannedWidth -= dragDelta;
        if (plannedWidth < colWidth) plannedWidth = colWidth;
      } else if (mode === 'resize-right') {
        plannedWidth += dragDelta;
        if (plannedWidth < colWidth) plannedWidth = colWidth;
      }
    }

    let delayWidth = 0;
    if (delayEndDate && !isDragging) {
      const delayEndIdx = differenceInCalendarDays(parseISO(delayEndDate), rangeStart);
      if (delayEndIdx > endIdx) {
        delayWidth = (delayEndIdx - endIdx) * colWidth;
      }
    }

    // Real start marker
    let realStartMarker = null;
    if (realStartDate) {
      const realIdx = differenceInCalendarDays(parseISO(realStartDate), rangeStart);
      const realLeft = realIdx * colWidth + colWidth / 2;
      realStartMarker = (
        <div
          className="absolute z-10 flex flex-col items-center"
          style={{ left: realLeft - 4, top: barTop - 6 }}
          title={`Inicio real: ${realStartDate}`}
        >
          <MapPin className="text-amber-500" style={{ width: 10, height: 10 }} />
          <div className="w-0.5 bg-amber-500/60" style={{ height: barH + 4 }} />
        </div>
      );
    }

    // If realEndDate (fin real) is before endDate, show marker at the real end within planned bar
    let realEndMarker = null;
    if (delayEndDate) {
      const delayEndIdx = differenceInCalendarDays(parseISO(delayEndDate), rangeStart);
      if (delayEndIdx <= endIdx) {
        const realEndLeft = delayEndIdx * colWidth + colWidth / 2;
        realEndMarker = (
          <div
            className="absolute z-10"
            style={{ left: realEndLeft, top: barTop, height: barH }}
            title={`Fin real: ${delayEndDate}`}
          >
            <div className="w-0.5 h-full bg-green-400" />
          </div>
        );
      }
    }

    const canDrag = !isMainRow && cycleForEdit && atencionForEdit;

    return (
      <>
        {realStartMarker}
        {realEndMarker}
        {/* Planned bar */}
        <div
          className={`absolute flex items-center overflow-hidden ${isDragging ? 'opacity-80 z-30' : ''}`}
          style={{
            left: plannedLeft,
            top: barTop,
            height: barH,
            width: plannedWidth,
            background: barColor,
            borderRadius: delayWidth > 0 ? '4px 0 0 4px' : '4px',
            paddingLeft: canDrag ? 8 : 4,
            paddingRight: canDrag ? 8 : 4,
            cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : undefined,
            userSelect: 'none',
          }}
          onMouseDown={canDrag ? (e) => handleCycleBarMouseDown(e, atencionForEdit!, cycleForEdit!, 'move') : undefined}
        >
          {/* Left resize handle */}
          {canDrag && (
            <div
              className="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/20"
              onMouseDown={(e) => { e.stopPropagation(); handleCycleBarMouseDown(e, atencionForEdit!, cycleForEdit!, 'resize-left'); }}
            />
          )}
          <span className="text-[10px] font-semibold truncate leading-none text-white" style={{ fontSize: isMainRow ? 10 : 8 }}>
            {label}
          </span>
          {/* Right resize handle */}
          {canDrag && (
            <div
              className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/20"
              onMouseDown={(e) => { e.stopPropagation(); handleCycleBarMouseDown(e, atencionForEdit!, cycleForEdit!, 'resize-right'); }}
            />
          )}
        </div>

        {/* Delay bar */}
        {delayWidth > 0 && (() => {
          const isEditingMain = isMainRow && atencionForEdit && editingDelayLabelId === atencionForEdit.id;
          const isEditingCycle = !isMainRow && cycleForEdit && atencionForEdit && editingCycleDelayId === cycleForEdit.id;
          const isEditing = isEditingMain || isEditingCycle;
          const displayLabel = delayLabel || '';

          return (
            <div
              className="absolute group cursor-pointer"
              style={{
                left: plannedLeft + plannedWidth,
                top: barTop,
                height: barH,
                width: delayWidth,
                background: isMainRow ? DELAY_RED : CYCLE_DELAY,
                borderRadius: '0 4px 4px 0',
              }}
              onDoubleClick={() => {
                if (isMainRow && atencionForEdit && !(atencionForEdit.cycles?.length)) setEditingDelayLabelId(atencionForEdit.id);
                if (!isMainRow && cycleForEdit && atencionForEdit) setEditingCycleDelayId(cycleForEdit.id);
              }}
            >
              {isEditing ? (
                <div className="absolute inset-0 flex items-center px-1">
                  {isEditingMain && atencionForEdit ? (
                    <input
                      autoFocus
                      defaultValue={atencionForEdit.delayLabel ?? ''}
                      onBlur={e => saveDelayLabel(atencionForEdit, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveDelayLabel(atencionForEdit, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setEditingDelayLabelId(null);
                      }}
                      className="w-full bg-transparent border-none outline-none text-[10px] font-semibold text-white placeholder:text-white/60"
                      placeholder="Texto atraso"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : cycleForEdit && atencionForEdit ? (
                    <input
                      autoFocus
                      defaultValue={cycleForEdit.delayLabel ?? ''}
                      onBlur={e => saveCycleDelayLabel(atencionForEdit, cycleForEdit.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveCycleDelayLabel(atencionForEdit, cycleForEdit.id, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setEditingCycleDelayId(null);
                      }}
                      className="w-full bg-transparent border-none outline-none text-[8px] font-semibold text-white placeholder:text-white/60"
                      placeholder="Texto atraso"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : null}
                </div>
              ) : displayLabel ? (
                <>
                  {/* Text on bar - hidden via CSS overflow */}
                  <div className="absolute inset-0 flex items-center px-1 overflow-hidden">
                    <span className="text-[10px] font-semibold text-white truncate leading-none" style={{ fontSize: isMainRow ? 10 : 8 }}>
                      {displayLabel}
                    </span>
                  </div>
                  {/* Tooltip below on hover - always visible for full text */}
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none ${tooltipAbove ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                  >
                    {tooltipAbove ? null : <div className="w-2 h-2 bg-popover border-t border-l rotate-45 absolute left-1/2 -translate-x-1/2 -top-1" />}
                    <div className="bg-popover text-popover-foreground text-[10px] font-medium px-2 py-1 rounded shadow-md border whitespace-nowrap">
                      {displayLabel}
                    </div>
                    {tooltipAbove ? <div className="w-2 h-2 bg-popover border-b border-r rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" /> : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })()}
      </>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: BAR_BLUE }} />
            En proceso
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: BAR_GREEN }} />
            Completado
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block w-5 h-2.5 rounded-sm" style={{ background: DELAY_RED }} />
            Atraso
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3 text-amber-500" />
            Inicio real
          </span>
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={() => setHideCompleted(v => !v)}
              className="text-muted-foreground hover:text-foreground text-[10px] inline-flex items-center gap-1 transition-colors"
            >
              {hideCompleted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {hideCompleted ? 'Mostrar' : 'Ocultar'} completados ({completedCount})
            </button>
          )}
          <button onClick={() => setShowAdd(v => !v)}
            className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
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
          <div className="flex h-full" style={{ minWidth: LABEL_W + totalDays * MIN_COL_W }}>

            {/* Left label column */}
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex flex-col border-r border-border bg-surface-1 shrink-0 z-10">
              <div style={{ height: HEADER_H }} className="border-b border-border" />
              <div style={{ height: DAY_HEADER_H }} className="flex items-center px-3 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {items.length} registros
                </span>
              </div>
              {items.map((a, i) => {
                const isEditing = editingId === a.id;
                const atencionTags = tags.filter(t => a.tags.includes(t.id))
                  .sort((x, y) => (x.kind === 'estado' ? -1 : 1) - (y.kind === 'estado' ? -1 : 1));
                const isOdd = i % 2 === 0;
                const completed = isCompleted(a);
                const cycles = a.cycles ?? [];
                const isExpanded = expandedRows.has(a.id);
                const hasCycles = cycles.length > 0;

                return (
                  <div key={a.id}>
                    <div
                      draggable
                      onDragStart={e => handleRowDragStart(e, a.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleRowDrop(e, a.id)}
                      style={{ height: ROW_H }}
                      className={`flex items-center gap-1 px-1.5 border-b border-border/40 group cursor-grab ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'} ${completed ? 'opacity-60' : ''}`}
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {hasCycles && (
                        <button onClick={() => toggleExpand(a.id)} className="shrink-0 text-muted-foreground hover:text-primary p-0.5">
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}
                      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-mono font-semibold text-foreground truncate leading-tight">
                          {a.code}
                        </span>
                        {atencionTags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {atencionTags.map(t => <TagBadge key={t.id} tag={t} />)}
                          </div>
                        )}
                      </div>
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
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Plan (auto)</label>
                            <div className="w-full bg-surface-0/50 border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground">
                              {a.startDate || '—'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Plan (auto)</label>
                            <div className="w-full bg-surface-0/50 border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground">
                              {a.endDate || '—'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Real</label>
                            <input type="date" value={editData.realStartDate || ''} onChange={e => setEditData(p => ({ ...p, realStartDate: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Atraso (auto)</label>
                            <div className="w-full bg-surface-0/50 border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground">
                              {a.delayEndDate || '—'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Texto Atraso</label>
                            <input value={editData.delayLabel || ''} onChange={e => setEditData(p => ({ ...p, delayLabel: e.target.value }))}
                              placeholder="Ej: Atrasos Dev - C2"
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Nota derecha</label>
                            <input value={editData.timelineNote || ''} onChange={e => setEditData(p => ({ ...p, timelineNote: e.target.value }))}
                              className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Cycle sub-rows in left column */}
                    {isExpanded && cycles.map(c => {
                      const isCycleEditing = editingCycleId === c.id;
                      return (
                        <div key={c.id}>
                          <div style={{ height: SUB_ROW_H }}
                            className="flex items-center gap-1 pl-6 pr-1.5 border-b border-border/20 bg-surface-2/30 group/cycle">
                            <button
                              onClick={() => toggleCycleCompleted(a, c.id)}
                              className="shrink-0 p-0 hover:scale-110 transition-transform"
                              title={c.completed ? 'Marcar como pendiente' : 'Marcar como finalizado'}
                            >
                              {c.completed
                                ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                                : <Circle className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground" />
                              }
                            </button>
                            {editingCycleLabelId === c.id ? (
                              <input
                                autoFocus
                                defaultValue={c.label}
                                onBlur={e => saveCycleLabel(a, c.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveCycleLabel(a, c.id, (e.target as HTMLInputElement).value);
                                  if (e.key === 'Escape') setEditingCycleLabelId(null);
                                }}
                                className="text-[9px] font-mono bg-surface-0 border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-0"
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="text-[9px] font-mono text-muted-foreground truncate flex-1 cursor-text hover:text-foreground transition-colors"
                                onClick={() => setEditingCycleLabelId(c.id)}
                                title="Clic para editar nombre"
                              >
                                {c.label}
                              </span>
                            )}
                            {c.realStartDate && <MapPin className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                            <div className="shrink-0 flex gap-0.5">
                              {isCycleEditing ? (
                                <>
                                  <button onClick={() => saveEditCycle(a, c.id)} className="text-green-500 hover:text-green-400 p-0.5"><Check className="w-3 h-3" /></button>
                                  <button onClick={cancelEditCycle} className="text-muted-foreground hover:text-destructive p-0.5"><X className="w-3 h-3" /></button>
                                  <button onClick={() => deleteCycleFromTimeline(a, c.id)} className="text-muted-foreground hover:text-destructive p-0.5" title="Eliminar ciclo">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => startEditCycle(c)}
                                  className="opacity-0 group-hover/cycle:opacity-100 text-muted-foreground hover:text-primary p-0.5 transition-opacity">
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {isCycleEditing && (
                            <div className="bg-surface-2/60 border-b border-primary/20 px-2 py-1.5 pl-8 space-y-1">
                              <div className="grid grid-cols-2 gap-1">
                                <div>
                                  <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Inicio Plan</label>
                                  <input type="date" value={editCycleData.startDate || ''} onChange={e => setEditCycleData(p => ({ ...p, startDate: e.target.value }))}
                                    className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div>
                                  <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Fin Plan</label>
                                  <input type="date" value={editCycleData.endDate || ''} onChange={e => setEditCycleData(p => ({ ...p, endDate: e.target.value }))}
                                    className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div>
                                  <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Inicio Real</label>
                                  <input type="date" value={editCycleData.realStartDate || ''} onChange={e => setEditCycleData(p => ({ ...p, realStartDate: e.target.value }))}
                                    className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                                <div>
                                  <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Fin Real</label>
                                  <input type="date" value={editCycleData.realEndDate || ''} onChange={e => setEditCycleData(p => ({ ...p, realEndDate: e.target.value }))}
                                    className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Texto Atraso</label>
                                <input value={editCycleData.delayLabel || ''} onChange={e => setEditCycleData(p => ({ ...p, delayLabel: e.target.value }))}
                                  placeholder="Ej: Atrasos Dev"
                                  className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="block text-[7px] uppercase text-muted-foreground mb-0.5">Nota</label>
                                <input value={editCycleData.note || ''} onChange={e => setEditCycleData(p => ({ ...p, note: e.target.value }))}
                                  placeholder="Ej: Pendiente entrega dev"
                                  className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Add cycle button */}
                    {isExpanded && (
                      <div style={{ height: SUB_ROW_H }}
                        className="flex items-center pl-8 border-b border-border/20 bg-surface-2/20">
                        <button
                          onClick={() => addCycleToTimeline(a)}
                          className="text-[9px] text-primary hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" /> Agregar ciclo
                        </button>
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
                {/* Today line */}
                {todayIdx >= 0 && todayIdx < totalDays && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-destructive/60 z-20 pointer-events-none"
                    style={{ left: todayIdx * colWidth + colWidth / 2 }}
                  >
                    <div className="text-[8px] text-destructive font-bold bg-destructive/10 px-1 rounded-b">Hoy</div>
                  </div>
                )}

                {items.map((a, rowIdx) => {
                  const barColor = getBarColor(a);
                  const isOdd = rowIdx % 2 === 0;
                  const completed = isCompleted(a);
                  const cycles = a.cycles ?? [];
                  const isExpanded = expandedRows.has(a.id);

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
                    <div key={a.id}>
                      {/* Main row */}
                      <div
                        style={{ height: ROW_H, position: 'relative' }}
                        className={`border-b border-border/30 ${isOdd ? 'bg-surface-0' : 'bg-surface-1/40'} ${completed ? 'opacity-60' : ''}`}
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

                        {renderBar(a.startDate, a.endDate, a.delayEndDate, a.realStartDate, barColor, BAR_H, BAR_TOP, a.code, a.delayLabel, true, a, undefined, rowIdx >= items.length - 2)}

                        {/* Note to the right */}
                        <div
                          className="absolute flex items-center"
                          style={{ left: totalBarEnd + 6, top: 0, bottom: 0, whiteSpace: 'nowrap' }}
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
                              className="text-[10px] font-medium cursor-text px-1 rounded hover:bg-surface-2/60 transition-colors truncate text-foreground"
                              onClick={() => setEditingNoteId(a.id)}
                              title="Clic para editar nota"
                            >
                              {a.timelineNote || <span className="text-muted-foreground/40 italic">+ nota</span>}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cycle sub-rows */}
                      {isExpanded && cycles.map(c => {
                        const isCycleEditing = editingCycleId === c.id;
                        return (
                          <div key={c.id}>
                            <div
                              style={{ height: SUB_ROW_H, position: 'relative' }}
                              className="border-b border-border/20 bg-surface-2/20"
                            >
                              {/* Day grid lines */}
                              {days.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                  <div key={i}
                                    className={`absolute top-0 bottom-0 border-r border-border/10 pointer-events-none ${isWeekend ? 'bg-surface-2/5' : ''}`}
                                    style={{ left: i * colWidth, width: colWidth }}
                                  />
                                );
                              })}

                              {renderBar(c.startDate, c.endDate, computeCycleDelay(c), c.realStartDate, c.completed ? BAR_GREEN : CYCLE_BLUE, SUB_BAR_H, SUB_BAR_TOP, c.label, c.delayLabel, false, a, c, rowIdx >= items.length - 2)}

                              {/* Cycle note */}
                              {(() => {
                                if (!c.startDate || !c.endDate) return null;
                                const cStartIdx = differenceInCalendarDays(parseISO(c.startDate), rangeStart);
                                const cEndIdx = differenceInCalendarDays(parseISO(c.endDate), rangeStart);
                                let cBarEnd = cStartIdx * colWidth + Math.max(colWidth, (cEndIdx - cStartIdx + 1) * colWidth);
                                const cycleDelay = computeCycleDelay(c);
                                if (cycleDelay) {
                                  const cDelayIdx = differenceInCalendarDays(parseISO(cycleDelay), rangeStart);
                                  if (cDelayIdx > cEndIdx) cBarEnd += (cDelayIdx - cEndIdx) * colWidth;
                                }
                                return (
                                  <div className="absolute flex items-center" style={{ left: cBarEnd + 4, top: 0, bottom: 0, whiteSpace: 'nowrap' }}>
                                    {editingCycleNoteId === c.id ? (
                                      <input
                                        autoFocus
                                        defaultValue={c.note ?? ''}
                                        onBlur={e => saveCycleNote(a, c.id, e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') saveCycleNote(a, c.id, (e.target as HTMLInputElement).value);
                                          if (e.key === 'Escape') setEditingCycleNoteId(null);
                                        }}
                                        className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44"
                                        onClick={e => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span
                                        className="text-[9px] text-muted-foreground truncate cursor-text hover:text-foreground px-0.5 rounded hover:bg-surface-2/60 transition-colors"
                                        onClick={() => setEditingCycleNoteId(c.id)}
                                        title="Clic para editar nota"
                                      >
                                        {c.note || <span className="text-muted-foreground/30 italic">+ nota</span>}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            {/* Spacer to match left-column edit form */}
                            {isCycleEditing && (
                              <div className="border-b border-primary/20 bg-surface-2/10" style={{ height: 130 }} />
                            )}
                          </div>
                        );
                      })}
                      {/* Spacer for add-cycle button row */}
                      {isExpanded && (
                        <div style={{ height: SUB_ROW_H }} className="border-b border-border/20 bg-surface-2/20" />
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
