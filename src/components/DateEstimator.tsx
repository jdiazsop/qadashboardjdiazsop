import { useMemo } from 'react';
import { DateEstimation, EstimationTask, computeEstimation, createDefaultEstimation, ESTIMATION_TASK_LABELS } from '@/types/qa';
import { Calculator, Plus, Trash2, Clock, Users, CalendarDays } from 'lucide-react';

interface Props {
  estimation: DateEstimation | undefined;
  onChange: (est: DateEstimation) => void;
}

export function DateEstimator({ estimation, onChange }: Props) {
  const est = estimation ?? createDefaultEstimation();

  const computed = useMemo(() => computeEstimation(est), [est]);

  const totalHours = est.tasks.reduce((s, t) => s + t.hours, 0);
  const totalAdjusted = computed.reduce((s, t) => s + (t.adjustedHours ?? 0), 0);
  const lastTask = [...computed].reverse().find(t => (t.adjustedHours ?? 0) > 0);

  const updateTask = (taskId: string, patch: Partial<EstimationTask>) => {
    onChange({
      ...est,
      tasks: est.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t),
    });
  };

  const addTask = () => {
    const usedLabels = new Set(est.tasks.map(t => t.label));
    const nextLabel = ESTIMATION_TASK_LABELS.find(l => !usedLabels.has(l)) || `Tarea ${est.tasks.length + 1}`;
    onChange({
      ...est,
      tasks: [...est.tasks, { id: `est-${Date.now()}`, label: nextLabel, hours: 0 }],
    });
  };

  const removeTask = (taskId: string) => {
    onChange({ ...est, tasks: est.tasks.filter(t => t.id !== taskId) });
  };

  const initEstimation = () => {
    onChange(createDefaultEstimation());
  };

  if (!estimation) {
    return (
      <button
        onClick={initEstimation}
        className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
      >
        <Calculator className="w-3 h-3" /> Agregar Estimador de Fechas
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header controls */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground mb-0.5">
            <CalendarDays className="w-2.5 h-2.5" /> Fecha Inicio
          </label>
          <input
            type="date"
            value={est.startDate}
            onChange={e => onChange({ ...est, startDate: e.target.value })}
            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground mb-0.5">
            <Users className="w-2.5 h-2.5" /> # QA
          </label>
          <input
            type="number"
            min={1}
            value={est.qaCount}
            onChange={e => onChange({ ...est, qaCount: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground mb-0.5">
            <Clock className="w-2.5 h-2.5" /> Hrs/día
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={est.hoursPerDay}
            onChange={e => onChange({ ...est, hoursPerDay: Math.max(1, Math.min(24, parseInt(e.target.value) || 9)) })}
            className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 bg-surface-0 rounded px-2 py-1.5 text-[10px] text-muted-foreground">
        <span>Total: <strong className="text-foreground">{totalHours}h</strong></span>
        <span>Ajustado ({est.qaCount} QA): <strong className="text-foreground">{Math.round(totalAdjusted * 10) / 10}h</strong></span>
        {lastTask && (
          <span>Fin: <strong className="text-primary">{lastTask.computedEnd}</strong></span>
        )}
      </div>

      {/* Task table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_60px_80px_80px] bg-surface-0 px-2 py-1 text-[8px] uppercase text-muted-foreground font-semibold border-b border-border">
          <span>Tarea</span>
          <span className="text-center">Horas</span>
          <span className="text-center">Ajust.</span>
          <span className="text-center">Inicio</span>
          <span className="text-center">Fin</span>
        </div>
        {computed.map((task, i) => (
          <div
            key={task.id}
            className={`grid grid-cols-[1fr_60px_60px_80px_80px] items-center px-2 py-1 text-[10px] ${i % 2 === 0 ? 'bg-surface-1/50' : 'bg-surface-0/30'} group/row`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => removeTask(task.id)}
                className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
              <input
                value={task.label}
                onChange={e => updateTask(task.id, { label: e.target.value })}
                className="bg-transparent text-foreground text-[10px] w-full min-w-0 truncate focus:outline-none focus:underline"
              />
            </div>
            <input
              type="number"
              min={0}
              step={0.5}
              value={task.hours || ''}
              onChange={e => updateTask(task.id, { hours: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-full bg-surface-0 border border-border rounded px-1 py-0.5 text-[10px] text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-center text-muted-foreground">
              {task.adjustedHours != null && task.adjustedHours > 0 ? `${task.adjustedHours}h` : '—'}
            </div>
            <div className="text-center text-muted-foreground">
              {task.adjustedHours != null && task.adjustedHours > 0 ? task.computedStart : '—'}
            </div>
            <div className="text-center text-foreground font-medium">
              {task.adjustedHours != null && task.adjustedHours > 0 ? task.computedEnd : '—'}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addTask}
        className="text-[10px] text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
      >
        <Plus className="w-3 h-3" /> Agregar tarea
      </button>
    </div>
  );
}
