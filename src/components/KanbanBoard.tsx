import { useState } from 'react';
import { Atencion, KanbanColumn, Tag, CHECKLIST_ITEMS } from '@/types/qa';
import { KanbanCard } from './KanbanCard';
import { Plus, X } from 'lucide-react';

interface Props {
  columns: KanbanColumn[];
  atenciones: Atencion[];
  tags: Tag[];
  onUpdateAtencion: (a: Atencion) => void;
  onDeleteAtencion: (id: string) => void;
  onAddAtencion: (a: Atencion) => void;
  onAddColumn: (col: KanbanColumn) => void;
  onDeleteColumn: (id: string) => void;
}

export function KanbanBoard({ columns, atenciones, tags, onUpdateAtencion, onDeleteAtencion, onAddAtencion, onAddColumn, onDeleteColumn }: Props) {
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

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
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const atencionId = e.dataTransfer.getData('atencionId');
    const atencion = atenciones.find(a => a.id === atencionId);
    if (atencion) onUpdateAtencion({ ...atencion, columnId: colId });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 300 }}>
      {columns.map(col => {
        const colAtenciones = atenciones.filter(a => a.columnId === col.id);
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-56 bg-surface-1 rounded-xl border border-border"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col.title}</h3>
                <span className="text-[10px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">{colAtenciones.length}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setAddingToCol(col.id)} className="text-muted-foreground hover:text-primary">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {columns.length > 1 && (
                  <button onClick={() => onDeleteColumn(col.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
              {colAtenciones.map(a => (
                <div key={a.id} draggable onDragStart={e => handleDragStart(e, a.id)}>
                  <KanbanCard atencion={a} tags={tags} onUpdate={onUpdateAtencion} onDelete={onDeleteAtencion} />
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
    </div>
  );
}
