import { useState } from 'react';
import { Tag } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { Plus, Trash2, X, Settings } from 'lucide-react';

interface Props {
  tags: Tag[];
  onUpdateTags: (tags: Tag[]) => void;
}

export function TagManager({ tags, onUpdateTags }: Props) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<'estado' | 'tipo'>('tipo');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, '-');
    if (tags.find(t => t.id === id)) return;
    const newTag: Tag = {
      id,
      label: newLabel.trim(),
      color: newKind === 'estado' ? 'calidad' : 'sap', // yellow for estado, orange for tipo
      kind: newKind,
    };
    onUpdateTags([...tags, newTag]);
    setNewLabel('');
  };

  const handleDelete = (id: string) => {
    onUpdateTags(tags.filter(t => t.id !== id));
  };

  const handleToggleKind = (id: string) => {
    onUpdateTags(tags.map(t => {
      if (t.id !== id) return t;
      const newKind = t.kind === 'estado' ? 'tipo' : 'estado';
      return { ...t, kind: newKind, color: newKind === 'estado' ? 'calidad' : 'sap' };
    }));
  };

  const estadoTags = tags.filter(t => t.kind === 'estado');
  const tipoTags = tags.filter(t => t.kind === 'tipo');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface-2"
      >
        <Settings className="w-3.5 h-3.5" />
        Configurar Tags
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Configuración de Tags</h3>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Estado tags */}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5 tracking-wide">
            Tags de Estado <span className="text-tag-calidad">(amarillo)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {estadoTags.map(t => (
              <div key={t.id} className="flex items-center gap-1 bg-surface-2 rounded px-2 py-1">
                <TagBadge tag={t} />
                <button onClick={() => handleToggleKind(t.id)} className="text-[9px] text-muted-foreground hover:text-primary ml-1" title="Cambiar a tipo">→tipo</button>
                <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Tipo tags */}
        <div>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1.5 tracking-wide">
            Tags de Tipo de Prueba <span className="text-tag-sap">(naranja)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {tipoTags.map(t => (
              <div key={t.id} className="flex items-center gap-1 bg-surface-2 rounded px-2 py-1">
                <TagBadge tag={t} />
                <button onClick={() => handleToggleKind(t.id)} className="text-[9px] text-muted-foreground hover:text-primary ml-1" title="Cambiar a estado">→estado</button>
                <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Add new */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Nuevo tag..." className="bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1" />
          <select value={newKind} onChange={e => setNewKind(e.target.value as 'estado' | 'tipo')} className="bg-surface-0 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="estado">Estado</option>
            <option value="tipo">Tipo</option>
          </select>
          <button onClick={handleAdd} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
