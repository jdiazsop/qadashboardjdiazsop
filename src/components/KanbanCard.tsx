import { useState } from 'react';
import { Atencion, AtencionStatus, Tag, ChecklistPhase, DEFAULT_CHECKLIST_PHASES, TestCycle, computeDatesFromCycles, computeCycleDelay, CYCLE_LABEL_OPTIONS } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { CheckSquare, MessageSquare, X, ChevronDown, ChevronRight, Plus, Trash2, MapPin, RefreshCw, Copy, GripVertical } from 'lucide-react';

const JIRA_STATES = [
  'Registrado',
  'Desarrollo',
  'Ctrl Calidad',
  'Ctrl Cal Proveedor',
  'Ctrl Cal Prov Terminado',
  'Pruebas de Aceptación',
  'Producción',
  'Calificación',
] as const;

interface Props {
  atencion: Atencion;
  tags: Tag[];
  checklistPhases: ChecklistPhase[];
  onUpdate: (a: Atencion) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (a: Atencion) => void;
}

/** Count sequential Cx cycles (C1, C2, C3...) and return the last Cx label */
function computeCicloActual(cycles: TestCycle[]): { total: number; current: string } {
  const cxPattern = /^C(\d+)$/i;
  const cxCycles = cycles
    .filter(c => cxPattern.test(c.label.trim()))
    .map(c => ({ label: c.label.trim(), num: parseInt(c.label.trim().match(cxPattern)![1]) }))
    .sort((a, b) => a.num - b.num);
  if (cxCycles.length === 0) return { total: 0, current: '—' };
  return { total: cxCycles.length, current: cxCycles[cxCycles.length - 1].label };
}

export function KanbanCard({ atencion, tags, checklistPhases, onUpdate, onDelete, onDuplicate }: Props) {
  const [open, setOpen] = useState(false);
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [dragCycleId, setDragCycleId] = useState<string | null>(null);

  // Compute checklist counts from phases + checklistMap
  const allItemIds = checklistPhases.flatMap(p => p.items.map(i => i.id));
  const checkMap = atencion.checklistMap ?? {};
  const applicableIds = allItemIds.filter(id => checkMap[id] !== 'na');
  const checkedCount = applicableIds.filter(id => checkMap[id] === true).length;
  const total = applicableIds.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const cycles = atencion.cycles ?? [];
  const cicloActual = computeCicloActual(cycles);

  const atencionTags = tags.filter(t => atencion.tags.includes(t.id))
    .sort((a, b) => (a.kind === 'estado' ? -1 : 1) - (b.kind === 'estado' ? -1 : 1));

  const addCycle = () => {
    // Determine next label: find the next unused predefined label
    const usedLabels = new Set(cycles.map(c => c.label));
    const nextLabel = CYCLE_LABEL_OPTIONS.find(opt => !usedLabels.has(opt)) || `C${cycles.length + 1}`;
    const lastEnd = [...cycles].reverse().find(c => c.endDate)?.endDate;
    const baseDate = lastEnd
      ? new Date(new Date(lastEnd).getTime() + 86400000)
      : new Date();
    const endDate = new Date(baseDate.getTime() + 2 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const newCycle: TestCycle = { id: Date.now().toString(), label: nextLabel, startDate: fmt(baseDate), endDate: fmt(endDate) };
    const newCycles = [...cycles, newCycle];
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, ...computed });
  };

  const updateCycle = (cycleId: string, patch: Partial<TestCycle>) => {
    const newCycles = cycles.map(c => c.id === cycleId ? { ...c, ...patch } : c);
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, startDate: computed.startDate || atencion.startDate, endDate: computed.endDate || atencion.endDate, delayEndDate: computed.delayEndDate || undefined, delayLabel: computed.delayLabel || undefined });
  };

  const deleteCycle = (cycleId: string) => {
    const newCycles = cycles.filter(c => c.id !== cycleId);
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, startDate: computed.startDate || atencion.startDate, endDate: computed.endDate || atencion.endDate, delayEndDate: computed.delayEndDate || undefined, delayLabel: computed.delayLabel || undefined });
  };

  return (
    <>
      <div
        className="bg-surface-2 border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors group"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm font-semibold text-foreground">{atencion.code}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onDuplicate && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(atencion); }}
                className="text-muted-foreground hover:text-primary"
                title="Duplicar a otra columna"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(atencion.id); }}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {atencion.aplicativo && (
          <span className="text-[10px] text-primary font-medium">{atencion.aplicativo}</span>
        )}
        {atencion.description && (
          <p className="text-[11px] text-muted-foreground mb-1.5 line-clamp-2">{atencion.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mb-2">
          {atencionTags.map(t => <TagBadge key={t.id} tag={t} />)}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {atencion.estadoJira && (
            <span className="bg-surface-0 px-1.5 py-0.5 rounded text-[10px]">{atencion.estadoJira}</span>
          )}
          {atencion.totalCPs != null && atencion.totalCPs > 0 && (
            <span className="text-[10px]">CPs: {atencion.totalCPs}</span>
          )}
          {cicloActual.total > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-surface-0 px-1.5 py-0.5 rounded">
              <RefreshCw className="w-2.5 h-2.5" />
              {cicloActual.current} ({cicloActual.total})
            </span>
          )}
          <div className="flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            <span>{checkedCount}/{total}</span>
          </div>
          {atencion.comments && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
            </div>
          )}
        </div>
        <div className="mt-2 h-1 bg-surface-0 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Detail Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <input
                value={atencion.code}
                onChange={e => onUpdate({ ...atencion, code: e.target.value })}
                className="font-mono text-lg font-bold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-foreground w-full mr-2"
                placeholder="Código..."
              />
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Tags</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tags
                .sort((a, b) => (a.kind === 'estado' ? -1 : 1) - (b.kind === 'estado' ? -1 : 1))
                .map(t => {
                  const isSelected = atencion.tags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const newTags = isSelected
                          ? atencion.tags.filter(id => id !== t.id)
                          : [...atencion.tags, t.id];
                        onUpdate({ ...atencion, tags: newTags });
                      }}
                      className={`transition-all ${isSelected ? 'ring-2 ring-primary scale-105' : 'opacity-40 hover:opacity-70'}`}
                    >
                      <TagBadge tag={t} />
                    </button>
                  );
                })}
            </div>

            {/* New fields: Descripción, Estado Jira, Total CPs, Ciclo Actual */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descripción</label>
                <textarea
                  value={atencion.description || ''}
                  onChange={e => onUpdate({ ...atencion, description: e.target.value || undefined })}
                  placeholder="Descripción de la atención..."
                  className="w-full bg-surface-1 border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aplicativo</label>
                <input
                  value={atencion.aplicativo || ''}
                  onChange={e => onUpdate({ ...atencion, aplicativo: e.target.value || undefined })}
                  placeholder="Ej: SAP, CORE..."
                  className="w-full bg-surface-1 border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Estado Jira</label>
                <select
                  value={atencion.estadoJira || ''}
                  onChange={e => onUpdate({ ...atencion, estadoJira: e.target.value || undefined })}
                  className="w-full bg-surface-1 border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Seleccionar...</option>
                  {JIRA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total CPs</label>
                <input
                  type="number"
                  min={0}
                  value={atencion.totalCPs ?? ''}
                  onChange={e => onUpdate({ ...atencion, totalCPs: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="0"
                  className="w-full bg-surface-1 border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ciclo Actual</label>
                <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-sm text-foreground">
                  {cicloActual.total > 0
                    ? <span>{cicloActual.current} <span className="text-muted-foreground">({cicloActual.total} {cicloActual.total === 1 ? 'ciclo' : 'ciclos'} secuenciales)</span></span>
                    : <span className="text-muted-foreground">Sin ciclos Cx</span>
                  }
                </div>
              </div>
            </div>

            {/* Cycles Section */}
            <div className="mb-4">
              <button
                onClick={() => setCyclesOpen(v => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                {cyclesOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Ciclos de Prueba
                </h3>
                <span className="text-xs text-muted-foreground/70">({cycles.length})</span>
              </button>

              {/* Collapsed summary */}
              {!cyclesOpen && (
                <div className="mt-2 bg-surface-1 rounded-lg p-2.5 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Total ciclos: {cycles.length}</span>
                    <span>
                      {atencion.startDate && atencion.endDate
                        ? `${atencion.startDate} → ${atencion.endDate}`
                        : 'Sin fechas'}
                    </span>
                  </div>
                    {atencion.realStartDate && (
                      <div className="flex items-center gap-1 text-primary">
                        <MapPin className="w-3 h-3" />
                        <span>Inicio real: {atencion.realStartDate}</span>
                      </div>
                    )}
                    {atencion.delayEndDate && (
                    <div className="text-destructive">Fin atraso: {atencion.delayEndDate}</div>
                  )}
                </div>
              )}

              {/* Expanded cycles */}
              {cyclesOpen && (
                <div className="mt-2 space-y-2">
                  {/* Global read-only planned dates + editable delays */}
                  <div className="bg-surface-1 rounded-lg p-2.5 space-y-1.5 border border-border/50">
                    <span className="text-[9px] uppercase text-muted-foreground font-semibold">Fechas globales (auto-calculadas de ciclos)</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Plan</label>
                        <div className="w-full bg-surface-0/50 border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground">
                          {atencion.startDate || '—'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Plan</label>
                        <div className="w-full bg-surface-0/50 border border-border rounded px-1.5 py-1 text-[10px] text-muted-foreground">
                          {atencion.endDate || '—'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Real Global</label>
                        <input type="date" value={atencion.realStartDate || ''}
                          onChange={e => onUpdate({ ...atencion, realStartDate: e.target.value || undefined })}
                          className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Atraso Global</label>
                        <input type="date" value={atencion.delayEndDate || ''}
                          onChange={e => onUpdate({ ...atencion, delayEndDate: e.target.value || undefined })}
                          className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Texto Atraso Global</label>
                        <input value={atencion.delayLabel || ''}
                          onChange={e => onUpdate({ ...atencion, delayLabel: e.target.value || undefined })}
                          placeholder="Ej: Atrasos Dev - C4"
                          className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Cycle entries */}
                  {cycles.map((cycle, ci) => (
                    <div key={cycle.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('cycleId', cycle.id); setDragCycleId(cycle.id); }}
                      onDragEnd={() => setDragCycleId(null)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const srcId = e.dataTransfer.getData('cycleId');
                        if (!srcId || srcId === cycle.id) return;
                        const newCycles = [...cycles];
                        const srcIdx = newCycles.findIndex(c => c.id === srcId);
                        const tgtIdx = newCycles.findIndex(c => c.id === cycle.id);
                        const [moved] = newCycles.splice(srcIdx, 1);
                        newCycles.splice(tgtIdx, 0, moved);
                        const computed = computeDatesFromCycles(newCycles);
                        onUpdate({ ...atencion, cycles: newCycles, ...computed });
                        setDragCycleId(null);
                      }}
                      className={`bg-surface-1 rounded-lg p-2.5 space-y-1.5 border border-border/50 cursor-grab active:cursor-grabbing transition-opacity ${dragCycleId === cycle.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 text-muted-foreground" />
                          <select
                            value={CYCLE_LABEL_OPTIONS.includes(cycle.label as any) ? cycle.label : '__custom__'}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__custom__') {
                                const custom = prompt('Nombre de actividad:', cycle.label);
                                if (custom) updateCycle(cycle.id, { label: custom });
                              } else {
                                updateCycle(cycle.id, { label: val });
                              }
                            }}
                            className="bg-transparent text-xs font-semibold text-foreground border-none outline-none flex-1 min-w-0 cursor-pointer"
                          >
                            {CYCLE_LABEL_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="__custom__">+ Otra actividad</option>
                            {!CYCLE_LABEL_OPTIONS.includes(cycle.label as any) && cycle.label && (
                              <option value={cycle.label}>{cycle.label}</option>
                            )}
                          </select>
                        </div>
                        <button onClick={() => deleteCycle(cycle.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Plan</label>
                          <input type="date" value={cycle.startDate || ''}
                            onChange={e => updateCycle(cycle.id, { startDate: e.target.value || undefined })}
                            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Plan</label>
                          <input type="date" value={cycle.endDate || ''}
                            onChange={e => updateCycle(cycle.id, { endDate: e.target.value || undefined })}
                            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Inicio Real</label>
                          <input type="date" value={cycle.realStartDate || ''}
                            onChange={e => updateCycle(cycle.id, { realStartDate: e.target.value || undefined })}
                            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Fin Real</label>
                          <input type="date" value={cycle.realEndDate || ''}
                            onChange={e => updateCycle(cycle.id, { realEndDate: e.target.value || undefined })}
                            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Texto atraso</label>
                        <input value={cycle.delayLabel || ''}
                          onChange={e => updateCycle(cycle.id, { delayLabel: e.target.value || undefined })}
                          placeholder="Ej: Atrasos Dev"
                          className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addCycle}
                    className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Agregar Actividad
                  </button>
                </div>
              )}
            </div>

            {checklistPhases.map(phase => (
              <div key={phase.id} className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                  {phase.name}
                </h3>
                <div className="space-y-1.5">
                  {phase.items.map(item => {
                    const val = checkMap[item.id];
                    const isNa = val === 'na';
                    const isChecked = val === true;
                    return (
                      <div key={item.id} className="flex items-center gap-2 group/item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isNa}
                          onChange={() => {
                            const newMap = { ...checkMap, [item.id]: !isChecked };
                            onUpdate({ ...atencion, checklistMap: newMap });
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-border accent-primary disabled:opacity-30"
                        />
                        <span className={`text-sm flex-1 ${isNa ? 'line-through text-muted-foreground/50 italic' : isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.label}
                        </span>
                        <button
                          onClick={() => {
                            const newVal = isNa ? false : 'na' as const;
                            const newMap = { ...checkMap, [item.id]: newVal };
                            onUpdate({ ...atencion, checklistMap: newMap });
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${isNa ? 'bg-muted text-muted-foreground border-border font-semibold' : 'border-transparent text-muted-foreground/40 hover:text-muted-foreground hover:border-border'}`}
                        >
                          N/A
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Status Section */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Status</h3>
              <div className="grid grid-cols-5 gap-2">
                {(['conforme', 'enProceso', 'pendientes', 'bloqueados', 'defectos'] as const).map(key => {
                  const labels: Record<string, string> = { conforme: 'Conforme', enProceso: 'En Proceso', pendientes: 'Pendientes', bloqueados: 'Bloqueados', defectos: 'Defectos' };
                  const isPendientes = key === 'pendientes';
                  // Auto-calculate pendientes = totalCPs - (conforme + enProceso + bloqueados)
                  const computedPendientes = (atencion.totalCPs ?? 0) - ((atencion.status?.conforme ?? 0) + (atencion.status?.enProceso ?? 0) + (atencion.status?.bloqueados ?? 0));
                  const displayValue = isPendientes ? (atencion.totalCPs != null ? Math.max(0, computedPendientes) : '') : (atencion.status?.[key] ?? '');
                  return (
                    <div key={key}>
                      <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">{labels[key]}</label>
                      <input
                        type="number"
                        min={0}
                        value={displayValue}
                        readOnly={isPendientes}
                        onChange={e => {
                          if (isPendientes) return;
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          onUpdate({ ...atencion, status: { ...atencion.status, [key]: val } });
                        }}
                        className={`w-full border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isPendientes ? 'bg-surface-0/50 cursor-not-allowed' : 'bg-surface-1'}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Comentarios / Observaciones</h3>
            <textarea
              value={atencion.comments}
              onChange={e => onUpdate({ ...atencion, comments: e.target.value })}
              placeholder="Agregar comentarios u observaciones..."
              className="w-full bg-surface-1 border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <h3 className="text-sm font-semibold mb-2 mt-3 text-muted-foreground uppercase tracking-wider">Performance</h3>
            <textarea
              value={atencion.performanceComment || ''}
              onChange={e => onUpdate({ ...atencion, performanceComment: e.target.value || undefined })}
              placeholder="Comentario de rendimiento..."
              className="w-full bg-surface-1 border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <h3 className="text-sm font-semibold mb-2 mt-3 text-muted-foreground uppercase tracking-wider">Seguridad</h3>
            <textarea
              value={atencion.securityComment || ''}
              onChange={e => onUpdate({ ...atencion, securityComment: e.target.value || undefined })}
              placeholder="Comentario de seguridad..."
              className="w-full bg-surface-1 border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </>
  );
}
