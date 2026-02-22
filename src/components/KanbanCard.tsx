import { useState } from 'react';
import { Atencion, Tag, CHECKLIST_ITEMS, TestCycle, computeDatesFromCycles, computeCycleDelay } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { CheckSquare, MessageSquare, X, ChevronDown, ChevronRight, Plus, Trash2, MapPin } from 'lucide-react';

interface Props {
  atencion: Atencion;
  tags: Tag[];
  onUpdate: (a: Atencion) => void;
  onDelete: (id: string) => void;
}

export function KanbanCard({ atencion, tags, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const checkedCount = atencion.checklist.filter(Boolean).length;
  const total = atencion.checklist.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const cycles = atencion.cycles ?? [];

  const atencionTags = tags.filter(t => atencion.tags.includes(t.id))
    .sort((a, b) => (a.kind === 'estado' ? -1 : 1) - (b.kind === 'estado' ? -1 : 1));

  const addCycle = () => {
    const num = cycles.length + 1;
    const newCycle: TestCycle = { id: Date.now().toString(), label: `C${num}` };
    const newCycles = [...cycles, newCycle];
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, ...computed });
  };

  const updateCycle = (cycleId: string, patch: Partial<TestCycle>) => {
    const newCycles = cycles.map(c => c.id === cycleId ? { ...c, ...patch } : c);
    // Always recalculate global planned dates from cycles
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, startDate: computed.startDate || atencion.startDate, endDate: computed.endDate || atencion.endDate });
  };

  const deleteCycle = (cycleId: string) => {
    const newCycles = cycles.filter(c => c.id !== cycleId);
    const computed = computeDatesFromCycles(newCycles);
    onUpdate({ ...atencion, cycles: newCycles, startDate: computed.startDate || atencion.startDate, endDate: computed.endDate || atencion.endDate });
  };

  return (
    <>
      <div
        className="bg-surface-2 border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors group"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-sm font-semibold text-foreground">{atencion.code}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(atencion.id); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {atencionTags.map(t => <TagBadge key={t.id} tag={t} />)}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            <span>{checkedCount}/{total}</span>
          </div>
          {cycles.length > 0 && (
            <span className="text-[10px] bg-surface-0 px-1.5 py-0.5 rounded">{cycles.length} ciclos</span>
          )}
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
              <h2 className="font-mono text-lg font-bold">{atencion.code}</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
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
                    <div key={cycle.id} className="bg-surface-1 rounded-lg p-2.5 space-y-1.5 border border-border/50">
                      <div className="flex items-center justify-between">
                        <input
                          value={cycle.label}
                          onChange={e => updateCycle(cycle.id, { label: e.target.value })}
                          className="bg-transparent text-xs font-semibold text-foreground border-none outline-none w-20"
                          placeholder={`Ciclo ${ci + 1}`}
                        />
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
                    <Plus className="w-3 h-3" /> Agregar ciclo
                  </button>
                </div>
              )}
            </div>

            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Checklist de Entregables</h3>
            <div className="space-y-1.5 mb-6">
              {CHECKLIST_ITEMS.map((item, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer group/item">
                  <input
                    type="checkbox"
                    checked={atencion.checklist[i]}
                    onChange={() => {
                      const newChecklist = [...atencion.checklist];
                      newChecklist[i] = !newChecklist[i];
                      onUpdate({ ...atencion, checklist: newChecklist });
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className={`text-sm ${atencion.checklist[i] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item}
                  </span>
                </label>
              ))}
            </div>

            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Comentarios / Observaciones</h3>
            <textarea
              value={atencion.comments}
              onChange={e => onUpdate({ ...atencion, comments: e.target.value })}
              placeholder="Agregar comentarios u observaciones..."
              className="w-full bg-surface-1 border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </>
  );
}
