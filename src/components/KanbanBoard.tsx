import { useState } from 'react';
import { Atencion, KanbanColumn, Tag, CHECKLIST_ITEMS, ChecklistPhase, DEFAULT_CHECKLIST_PHASES } from '@/types/qa';
import { KanbanCard } from './KanbanCard';
import { Plus, X, GripVertical, Pencil, Check, Copy } from 'lucide-react';

interface Props {
  columns: KanbanColumn[];
  atenciones: Atencion[];
  tags: Tag[];
  checklistPhases: ChecklistPhase[];
  onUpdateAtencion: (a: Atencion) => void;
  onDeleteAtencion: (id: string) => void;
  onAddAtencion: (a: Atencion) => void;
  onAddColumn: (col: KanbanColumn) => void;
  onDeleteColumn: (id: string) => void;
  onReorderColumns: (columns: KanbanColumn[]) => void;
  onRenameColumn: (id: string, title: string) => void;
}

export function KanbanBoard({ columns, atenciones, tags, checklistPhases, onUpdateAtencion, onDeleteAtencion, onAddAtencion, onAddColumn, onDeleteColumn, onReorderColumns, onRenameColumn }: Props) {
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [duplicatingAtencion, setDuplicatingAtencion] = useState<Atencion | null>(null);

  // When duplicating, the new card in the target column shares the same sourceId for sync
  const handleDuplicate = (a: Atencion) => {
    setDuplicatingAtencion(a);
  };

  const confirmDuplicate = (targetColId: string) => {
    if (!duplicatingAtencion) return;
    const sourceId = duplicatingAtencion.sourceId || duplicatingAtencion.id;
    // Mark original with sourceId if not already set
    if (!duplicatingAtencion.sourceId) {
      onUpdateAtencion({ ...duplicatingAtencion, sourceId });
    }
    const dup: Atencion = {
      ...duplicatingAtencion,
      id: Date.now().toString(),
      columnId: targetColId,
      sourceId,
    };
    onAddAtencion(dup);
    setDuplicatingAtencion(null);
  };

  const handleAddAtencion = (colId: string) => {
    if (!newCode.trim()) return;
    const a: Atencion = {
      id: Date.now().toString(),
      code: newCode.trim(),
      tags: selectedTags,
      progress: 0,
      columnId: colId,
      checklist: CHECKLIST_ITEMS.map(() => false),
      comments: '',
    };
    onAddAtencion(a);
    setNewCode('');
    setSelectedTags([]);
    setAddingToCol(null);
  };

  const handleAddColumn = () => {
    if (!newColTitle.trim()) return;
    onAddColumn({ id: Date.now().toString(), title: newColTitle.trim() });
    setNewColTitle('');
    setShowAddCol(false);
  };

  const handleDragStart = (e: React.DragEvent, atencionId: string) => {
    e.dataTransfer.setData('atencionId', atencionId);
    e.dataTransfer.setData('type', 'card');
  };

  const handleCardDrop = (e: React.DragEvent, targetId: string, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('type');
    if (type !== 'card') return;
    const srcId = e.dataTransfer.getData('atencionId');
    if (srcId === targetId) return;
    const srcAtencion = atenciones.find(a => a.id === srcId);
    if (!srcAtencion) return;
    // Move to this column if different
    const colCards = atenciones
      .filter(a => a.columnId === colId)
      .sort((a, b) => (a.cardOrder ?? 0) - (b.cardOrder ?? 0));
    // Remove src from list if same column
    const filtered = colCards.filter(a => a.id !== srcId);
    const tgtIdx = filtered.findIndex(a => a.id === targetId);
    filtered.splice(tgtIdx, 0, { ...srcAtencion, columnId: colId });
    // Assign new cardOrder
    filtered.forEach((a, i) => {
      onUpdateAtencion({ ...a, cardOrder: i });
    });
    if (srcAtencion.columnId !== colId) {
      onUpdateAtencion({ ...srcAtencion, columnId: colId, cardOrder: tgtIdx });
    }
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type === 'card') {
      const atencionId = e.dataTransfer.getData('atencionId');
      const atencion = atenciones.find(a => a.id === atencionId);
      if (!atencion) return;
      // Drop on empty area = move to end
      const colCards = atenciones.filter(a => a.columnId === colId && a.id !== atencionId);
      const maxOrder = colCards.reduce((m, a) => Math.max(m, a.cardOrder ?? 0), -1);
      onUpdateAtencion({ ...atencion, columnId: colId, cardOrder: maxOrder + 1 });
    }
  };

  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    e.dataTransfer.setData('colId', colId);
    e.dataTransfer.setData('type', 'column');
    setDragColId(colId);
  };

  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type === 'column') {
      const sourceColId = e.dataTransfer.getData('colId');
      if (sourceColId === targetColId) return;
      const newCols = [...columns];
      const srcIdx = newCols.findIndex(c => c.id === sourceColId);
      const tgtIdx = newCols.findIndex(c => c.id === targetColId);
      const [moved] = newCols.splice(srcIdx, 1);
      newCols.splice(tgtIdx, 0, moved);
      onReorderColumns(newCols);
    } else {
      handleDrop(e, targetColId);
    }
    setDragColId(null);
  };

  const startEditCol = (col: KanbanColumn) => {
    setEditingColId(col.id);
    setEditColTitle(col.title);
  };

  const saveEditCol = () => {
    if (editingColId && editColTitle.trim()) {
      onRenameColumn(editingColId, editColTitle.trim());
    }
    setEditingColId(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 300 }}>
      {columns.map(col => {
        const colAtenciones = atenciones.filter(a => a.columnId === col.id).sort((a, b) => (a.cardOrder ?? 0) - (b.cardOrder ?? 0));
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-52 bg-surface-1 rounded-xl border border-border transition-opacity ${dragColId === col.id ? 'opacity-50' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleColDrop(e, col.id)}
          >
            <div
              className="flex items-center gap-1 px-2 py-2 border-b border-border cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={e => handleColDragStart(e, col.id)}
              onDragEnd={() => setDragColId(null)}
            >
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <GripVertical className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                {editingColId === col.id ? (
                  <input
                    value={editColTitle}
                    onChange={e => setEditColTitle(e.target.value)}
                    className="bg-surface-0 border border-border rounded px-1 py-0.5 text-[10px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-0"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEditCol()}
                    onBlur={saveEditCol}
                  />
                ) : (
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" title={col.title}>{col.title}</h3>
                )}
                <span className="text-[9px] bg-surface-3 text-muted-foreground px-1 py-0.5 rounded-full font-mono flex-shrink-0">{colAtenciones.length}</span>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                <button onClick={() => editingColId === col.id ? saveEditCol() : startEditCol(col)} className="text-muted-foreground hover:text-primary p-0.5">
                  {editingColId === col.id ? <Check className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
                </button>
                <button onClick={() => setAddingToCol(col.id)} className="text-muted-foreground hover:text-primary p-0.5">
                  <Plus className="w-3 h-3" />
                </button>
                {columns.length > 1 && (
                  <button onClick={() => onDeleteColumn(col.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
              {colAtenciones.map(a => (
                <div key={a.id} draggable onDragStart={e => handleDragStart(e, a.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleCardDrop(e, a.id, col.id)}
                >
                  <KanbanCard
                    atencion={a}
                    tags={tags}
                    checklistPhases={checklistPhases}
                    onUpdate={(updated) => {
                      // Sync duplicates: update all cards with same sourceId
                      const srcId = updated.sourceId;
                      if (srcId) {
                        const siblings = atenciones.filter(x => x.sourceId === srcId && x.id !== updated.id);
                        siblings.forEach(sib => {
                          onUpdateAtencion({
                            ...sib,
                            description: updated.description,
                            aplicativo: updated.aplicativo,
                            estadoJira: updated.estadoJira,
                            totalCPs: updated.totalCPs,
                            tags: updated.tags,
                            comments: updated.comments,
                            performanceComment: updated.performanceComment,
                            securityComment: updated.securityComment,
                            status: updated.status,
                            cycles: updated.cycles,
                            startDate: updated.startDate,
                            endDate: updated.endDate,
                            delayEndDate: updated.delayEndDate,
                            delayLabel: updated.delayLabel,
                            realStartDate: updated.realStartDate,
                            checklistMap: updated.checklistMap,
                            productionDate: updated.productionDate,
                          });
                        });
                      }
                      onUpdateAtencion(updated);
                    }}
                    onDelete={onDeleteAtencion}
                    onDuplicate={handleDuplicate}
                  />
                </div>
              ))}

              {addingToCol === col.id && (
                <div className="bg-surface-2 border border-primary/30 rounded-lg p-3 space-y-2">
                  <input
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    placeholder="Código (ej: RQ2026-10)"
                    className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleAddAtencion(col.id)}
                  />
                  <div className="flex flex-wrap gap-1">
                    {tags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTags(prev =>
                          prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                        )}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border transition-colors ${
                          selectedTags.includes(t.id) ? 'border-primary bg-primary/20 text-foreground' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleAddAtencion(col.id)} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded hover:bg-primary/90">
                      Agregar
                    </button>
                    <button onClick={() => setAddingToCol(null)} className="text-muted-foreground text-xs px-2 py-1 hover:text-foreground">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Column */}
      <div className="flex-shrink-0 w-56">
        {showAddCol ? (
          <div className="bg-surface-1 rounded-xl border border-primary/30 p-3 space-y-2">
            <input
              value={newColTitle}
              onChange={e => setNewColTitle(e.target.value)}
              placeholder="Nombre de columna..."
              className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
            />
            <div className="flex gap-1">
              <button onClick={handleAddColumn} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded">Agregar</button>
              <button onClick={() => setShowAddCol(false)} className="text-muted-foreground text-xs px-2 py-1">Cancelar</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCol(true)}
            className="w-full h-12 border border-dashed border-border rounded-xl flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Columna
          </button>
        )}
      </div>

      {/* Duplicate column picker */}
      {duplicatingAtencion && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDuplicatingAtencion(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-xs p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Copy className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Duplicar "{duplicatingAtencion.code}"</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Selecciona la columna destino:</p>
            <div className="space-y-1.5">
              {columns.filter(c => c.id !== duplicatingAtencion.columnId).map(c => (
                <button
                  key={c.id}
                  onClick={() => confirmDuplicate(c.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-surface-1 border border-border text-sm hover:border-primary hover:bg-surface-2 transition-colors"
                >
                  {c.title}
                </button>
              ))}
            </div>
            <button onClick={() => setDuplicatingAtencion(null)} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
