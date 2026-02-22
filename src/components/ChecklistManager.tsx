import { useState } from 'react';
import { ChecklistPhase, ChecklistItem } from '@/types/qa';
import { Settings, Plus, Trash2, ChevronDown, ChevronRight, X, GripVertical } from 'lucide-react';

interface Props {
  phases: ChecklistPhase[];
  onUpdatePhases: (phases: ChecklistPhase[]) => void;
}

export function ChecklistManager({ phases, onUpdatePhases }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});

  // Drag state for items
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragPhaseId, setDragPhaseId] = useState<string | null>(null);

  // Drag state for phases
  const [dragPhaseReorder, setDragPhaseReorder] = useState<string | null>(null);

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

  // Item drag handlers
  const handleItemDragStart = (e: React.DragEvent, phaseId: string, itemId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragItemId(itemId);
    setDragPhaseId(phaseId);
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = (e: React.DragEvent, targetPhaseId: string, targetIndex: number) => {
    e.preventDefault();
    if (!dragItemId || !dragPhaseId) return;

    const sourcePhase = phases.find(p => p.id === dragPhaseId);
    if (!sourcePhase) return;
    const item = sourcePhase.items.find(i => i.id === dragItemId);
    if (!item) return;

    let newPhases = phases.map(p => {
      if (p.id === dragPhaseId) {
        return { ...p, items: p.items.filter(i => i.id !== dragItemId) };
      }
      return p;
    });

    newPhases = newPhases.map(p => {
      if (p.id === targetPhaseId) {
        const items = [...p.items];
        items.splice(targetIndex, 0, item);
        return { ...p, items };
      }
      return p;
    });

    onUpdatePhases(newPhases);
    setDragItemId(null);
    setDragPhaseId(null);
  };

  // Phase drag handlers
  const handlePhaseDragStart = (e: React.DragEvent, phaseId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragPhaseReorder(phaseId);
  };

  const handlePhaseDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePhaseDrop = (e: React.DragEvent, targetPhaseId: string) => {
    e.preventDefault();
    if (!dragPhaseReorder || dragPhaseReorder === targetPhaseId) return;

    const fromIdx = phases.findIndex(p => p.id === dragPhaseReorder);
    const toIdx = phases.findIndex(p => p.id === targetPhaseId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newPhases = [...phases];
    const [moved] = newPhases.splice(fromIdx, 1);
    newPhases.splice(toIdx, 0, moved);
    onUpdatePhases(newPhases);
    setDragPhaseReorder(null);
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Configurar Entregables por Fase</h3>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {phases.map(phase => {
          const isExpanded = expandedPhase === phase.id;
          return (
            <div
              key={phase.id}
              className={`bg-surface-2 border rounded-lg p-3 ${dragPhaseReorder === phase.id ? 'border-primary opacity-50' : 'border-border/50'}`}
              draggable
              onDragStart={e => handlePhaseDragStart(e, phase.id)}
              onDragOver={handlePhaseDragOver}
              onDrop={e => handlePhaseDrop(e, phase.id)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
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
                  {phase.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 group ${dragItemId === item.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={e => { e.stopPropagation(); handleItemDragStart(e, phase.id, item.id); }}
                      onDragOver={handleItemDragOver}
                      onDrop={e => { e.stopPropagation(); handleItemDrop(e, phase.id, idx); }}
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab shrink-0" />
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
                  {/* Drop zone at end */}
                  <div
                    className="h-1"
                    onDragOver={handleItemDragOver}
                    onDrop={e => { e.stopPropagation(); handleItemDrop(e, phase.id, phase.items.length); }}
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={newItemLabels[phase.id] || ''}
                      onChange={e => setNewItemLabels(prev => ({ ...prev, [phase.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addItem(phase.id); }}
                      placeholder="Nuevo entregable..."
                      className="flex-1 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ml-5"
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
        <div className="flex items-center gap-2 pt-2 border-t border-border">
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
    </div>
  );
}
