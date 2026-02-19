import { useState, useEffect } from 'react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TimelineView } from '@/components/TimelineView';
import { CriticalPending } from '@/components/CriticalPending';
import { NotesPanel } from '@/components/NotesPanel';
import { loadState, saveState, DashboardState } from '@/lib/store';
import { Atencion, KanbanColumn } from '@/types/qa';
import { LayoutDashboard, Kanban, GanttChart } from 'lucide-react';

const Index = () => {
  const [state, setState] = useState<DashboardState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateAtencion = (a: Atencion) => {
    setState(s => ({ ...s, atenciones: s.atenciones.map(x => x.id === a.id ? a : x) }));
  };

  const deleteAtencion = (id: string) => {
    setState(s => ({ ...s, atenciones: s.atenciones.filter(x => x.id !== id) }));
  };

  const addAtencion = (a: Atencion) => {
    setState(s => ({ ...s, atenciones: [...s.atenciones, a] }));
  };

  const addColumn = (col: KanbanColumn) => {
    setState(s => ({ ...s, columns: [...s.columns, col] }));
  };

  const deleteColumn = (id: string) => {
    setState(s => ({
      ...s,
      columns: s.columns.filter(c => c.id !== id),
      atenciones: s.atenciones.filter(a => a.columnId !== id),
    }));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">QA Dashboard</h1>
          <p className="text-xs text-muted-foreground">Planificación BC Finanzas</p>
        </div>
      </header>

      {/* Kanban Section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Kanban className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Kanban Board</h2>
        </div>
        <KanbanBoard
          columns={state.columns}
          atenciones={state.atenciones}
          tags={state.tags}
          onUpdateAtencion={updateAtencion}
          onDeleteAtencion={deleteAtencion}
          onAddAtencion={addAtencion}
          onAddColumn={addColumn}
          onDeleteColumn={deleteColumn}
        />
      </section>

      {/* Bottom Grid: Timeline + Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <section className="lg:col-span-2 bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <GanttChart className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Timeline</h2>
          </div>
          <TimelineView atenciones={state.atenciones} tags={state.tags} />
        </section>

        {/* Side Panels */}
        <div className="space-y-4">
          <CriticalPending
            items={state.criticalItems}
            onUpdate={items => setState(s => ({ ...s, criticalItems: items }))}
          />
          <NotesPanel
            notes={state.notes}
            onUpdate={notes => setState(s => ({ ...s, notes }))}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
