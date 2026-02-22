import { useState } from 'react';
import { ChecklistPhase, ChecklistItem } from '@/types/qa';
import { Settings, Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

interface Props {
  phases: ChecklistPhase[];
  onUpdatePhases: (phases: ChecklistPhase[]) => void;
}

export function ChecklistManager({ phases, onUpdatePhases }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});

  const addPhase = () => {
    const name = newPhaseName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (phases.some(p => p.id === id)) return;
    onUpdatePhases([...phases, { id, name, items: [] }]);
    setNewPhaseName('');
  };

  const deletePhase = (id: string) => {
    onUpdatePhases(phases.filter(p => p.id !== id));
  };

  const renamePhase = (id: string, name: string) => {
    onUpdatePhases(phases.map(p => p.id === id ? { ...p, name } : p));
  };

  const addItem = (phaseId: string) => {
    const label = (newItemLabels[phaseId] || '').trim();
    if (!label) return;
    const itemId = `${phaseId}-${Date.now()}`;
    onUpdatePhases(phases.map(p =>
      p.id === phaseId
        ? { ...p, items: [...p.items, { id: itemId, label }] }
        : p
    ));
    setNewItemLabels(prev => ({ ...prev, [phaseId]: '' }));
  };

  const deleteItem = (phaseId: string, itemId: string) => {
    onUpdatePhases(phases.map(p =>
      p.id === phaseId
        ? { ...p, items: p.items.filter(i => i.id !== itemId) }
        : p
    ));
  };

  const renameItem = (phaseId: string, itemId: string, label: string) => {
    onUpdatePhases(phases.map(p =>
      p.id === phaseId
        ? { ...p, items: p.items.map(i => i.id === itemId ? { ...i, label } : i) }
        : p
    ));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
      >
        <Settings className="w-3.5 h-3.5" /> Configurar Entregables
      </button>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Configurar Entregables por Fase</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cerrar</button>
      </div>

      {phases.map(phase => {
        const isExpanded = expandedPhase === phase.id;
        return (
          <div key={phase.id} className="bg-surface-2 border border-border/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <input
                value={phase.name}
                onChange={e => renamePhase(phase.id, e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-semibold text-foreground flex-1"
              />
              <span className="text-[10px] text-muted-foreground">{phase.items.length} items</span>
              <button onClick={() => deletePhase(phase.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {isExpanded && (
              <div className="mt-2 space-y-1 pl-6">
                {phase.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <input
                      value={item.label}
                      onChange={e => renameItem(phase.id, item.id, e.target.value)}
                      className="flex-1 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => deleteItem(phase.id, item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={newItemLabels[phase.id] || ''}
                    onChange={e => setNewItemLabels(prev => ({ ...prev, [phase.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(phase.id); }}
                    placeholder="Nuevo entregable..."
                    className="flex-1 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button onClick={() => addItem(phase.id)} className="text-primary hover:text-primary/80">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add new phase */}
      <div className="flex items-center gap-2">
        <input
          value={newPhaseName}
          onChange={e => setNewPhaseName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addPhase(); }}
          placeholder="Nueva fase (ej: Post Pruebas)..."
          className="flex-1 bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={addPhase} className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Agregar fase
        </button>
      </div>
    </div>
  );
}
