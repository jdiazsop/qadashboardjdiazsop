import { useState } from 'react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TimelineView } from '@/components/TimelineView';
import { ExportExcel } from '@/components/ExportExcel';
import { TagManager } from '@/components/TagManager';
import { ChecklistManager } from '@/components/ChecklistManager';
import { useAuth } from '@/hooks/useAuth';
import { useCloudState } from '@/hooks/useCloudState';
import { DashboardState, ProjectTab } from '@/lib/store';
import { Atencion, KanbanColumn, Tag, ChecklistPhase, DEFAULT_CHECKLIST_PHASES } from '@/types/qa';
import { TestSchedule } from '@/components/TestSchedule';
import { PerformanceSection } from '@/components/PerformanceSection';
import { LayoutDashboard, Kanban, GanttChart, CalendarDays, Plus, Pencil, Settings, Trash2, LogOut, Activity } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const { user, signOut } = useAuth();
  const { appState, setAppState, loading } = useCloudState(user?.id);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTabName, setEditTabName] = useState('');

  if (loading || !appState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Cargando datos...
      </div>
    );
  }

  const activeTab = appState.tabs.find(t => t.id === appState.activeTabId) ?? appState.tabs[0];
  const state = activeTab?.state;

  const updateTabState = (fn: (s: DashboardState) => DashboardState) => {
    setAppState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.id === prev.activeTabId ? { ...t, state: fn(t.state) } : t
      ),
    }));
  };

  const updateAtencion = (a: Atencion) => {
    updateTabState(s => {
      let updated = s.atenciones.map(x => x.id === a.id ? a : x);
      const srcId = a.sourceId;
      if (srcId) {
        updated = updated.map(x => {
          if (x.sourceId === srcId && x.id !== a.id) {
            return {
              ...x,
              description: a.description,
              aplicativo: a.aplicativo,
              estadoJira: a.estadoJira,
              totalCPs: a.totalCPs,
              tags: a.tags,
              comments: a.comments,
              performanceComment: a.performanceComment,
              securityComment: a.securityComment,
              status: a.status,
              cycles: a.cycles,
              startDate: a.startDate,
              endDate: a.endDate,
              delayEndDate: a.delayEndDate,
              delayLabel: a.delayLabel,
              realStartDate: a.realStartDate,
              checklistMap: a.checklistMap,
              productionDate: a.productionDate,
            };
          }
          return x;
        });
      }
      return { ...s, atenciones: updated };
    });
  };

  const deleteAtencion = (id: string) => {
    updateTabState(s => ({ ...s, atenciones: s.atenciones.filter(x => x.id !== id) }));
  };

  const addAtencion = (a: Atencion) => {
    const minOrder = Math.min(0, ...state.atenciones.map(x => x.sortOrder ?? 0)) - 1;
    updateTabState(s => ({ ...s, atenciones: [...s.atenciones, { ...a, sortOrder: minOrder }] }));
  };

  const addColumn = (col: KanbanColumn) => {
    updateTabState(s => ({ ...s, columns: [...s.columns, col] }));
  };

  const deleteColumn = (id: string) => {
    updateTabState(s => ({
      ...s,
      columns: s.columns.filter(c => c.id !== id),
      atenciones: s.atenciones.filter(a => a.columnId !== id),
    }));
  };

  const reorderColumns = (columns: KanbanColumn[]) => {
    updateTabState(s => ({ ...s, columns }));
  };

  const renameColumn = (id: string, title: string) => {
    updateTabState(s => ({ ...s, columns: s.columns.map(c => c.id === id ? { ...c, title } : c) }));
  };

  const addTab = () => {
    const id = Date.now().toString();
    const newTab: ProjectTab = {
      id,
      name: 'Nuevo Proyecto',
      state: {
        columns: [
          { id: 'backlog', title: 'Backlog' },
          { id: 'en-proceso', title: 'En Proceso' },
          { id: 'completado', title: 'Completado' },
        ],
        atenciones: [],
        criticalItems: [],
        notes: [],
        tags: state.tags,
        checklistPhases: state.checklistPhases ?? DEFAULT_CHECKLIST_PHASES,
      },
    };
    setAppState(prev => ({
      ...prev,
      tabs: [...prev.tabs, newTab],
      activeTabId: id,
    }));
  };

  const deleteTab = (id: string) => {
    if (appState.tabs.length <= 1) return;
    setAppState(prev => {
      const tabs = prev.tabs.filter(t => t.id !== id);
      return {
        ...prev,
        tabs,
        activeTabId: prev.activeTabId === id ? tabs[0].id : prev.activeTabId,
      };
    });
  };

  const startEditTab = (tab: ProjectTab) => {
    setEditingTabId(tab.id);
    setEditTabName(tab.name);
  };

  const saveEditTab = () => {
    if (!editingTabId || !editTabName.trim()) return;
    setAppState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => t.id === editingTabId ? { ...t, name: editTabName.trim() } : t),
    }));
    setEditingTabId(null);
  };

  if (!state) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-6 pt-4 pb-2">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">QA Dashboard</h1>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {appState.tabs.length > 1 && (
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Eliminar pestaña "{activeTab.name}"
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                )}
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{activeTab.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente la pestaña y todos sus datos. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteTab(activeTab.id)}
                >
                  Sí, eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Excel-style tabs */}
      <div className="flex items-end gap-0 px-4 md:px-6 mt-2 border-b border-border overflow-x-auto">
        {appState.tabs.map(tab => {
          const isActive = tab.id === appState.activeTabId;
          const isEditing = editingTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-1 px-3 py-1.5 text-xs font-medium cursor-pointer border border-b-0 rounded-t-md transition-colors select-none shrink-0
                ${isActive
                  ? 'bg-surface-1 text-foreground border-border'
                  : 'bg-surface-2/50 text-muted-foreground border-transparent hover:bg-surface-2 hover:text-foreground'
                }`}
              onClick={() => !isEditing && setAppState(p => ({ ...p, activeTabId: tab.id }))}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={editTabName}
                  onChange={e => setEditTabName(e.target.value)}
                  onBlur={saveEditTab}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditTab(); if (e.key === 'Escape') setEditingTabId(null); }}
                  className="bg-transparent border-none outline-none text-xs w-28 text-foreground"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span onDoubleClick={(e) => { e.stopPropagation(); startEditTab(tab); }}>{tab.name}</span>
              )}
              {isActive && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); startEditTab(tab); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-0.5 transition-opacity"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addTab}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" /> Nueva pestaña
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <TagManager
            tags={state.tags}
            onUpdateTags={(tags: Tag[]) => updateTabState(s => ({ ...s, tags }))}
          />
          <ChecklistManager
            phases={state.checklistPhases ?? DEFAULT_CHECKLIST_PHASES}
            onUpdatePhases={(checklistPhases: ChecklistPhase[]) => updateTabState(s => ({ ...s, checklistPhases }))}
          />
          <ExportExcel atenciones={state.atenciones} columns={state.columns} />
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Kanban className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Kanban Board</h2>
          </div>
          <KanbanBoard
            columns={state.columns}
            atenciones={state.atenciones}
            tags={state.tags}
            checklistPhases={state.checklistPhases ?? DEFAULT_CHECKLIST_PHASES}
            onUpdateAtencion={updateAtencion}
            onDeleteAtencion={deleteAtencion}
            onAddAtencion={addAtencion}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            onReorderColumns={reorderColumns}
            onRenameColumn={renameColumn}
          />
        </section>

        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <GanttChart className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Timeline</h2>
          </div>
          <TimelineView
            atenciones={state.atenciones}
            tags={state.tags}
            columns={state.columns}
            onUpdateAtencion={updateAtencion}
            onAddAtencion={addAtencion}
            onReorderAtenciones={(atenciones) => updateTabState(s => ({ ...s, atenciones }))}
          />
        </section>

        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Cronograma de Pruebas</h2>
          </div>
          <TestSchedule atenciones={state.atenciones} onUpdateAtencion={updateAtencion} />
        </section>

        <section className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Rendimiento</h2>
          </div>
          <PerformanceSection
            data={state.performanceData}
            onChange={(performanceData) => updateTabState(s => ({ ...s, performanceData }))}
          />
        </section>
      </div>
    </div>
  );
};

export default Index;
