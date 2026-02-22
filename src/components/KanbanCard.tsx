import { useState } from 'react';
import { Atencion, Tag, CHECKLIST_ITEMS } from '@/types/qa';
import { TagBadge } from './TagBadge';
import { CheckSquare, MessageSquare, X } from 'lucide-react';

interface Props {
  atencion: Atencion;
  tags: Tag[];
  onUpdate: (a: Atencion) => void;
  onDelete: (id: string) => void;
}

export function KanbanCard({ atencion, tags, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const checkedCount = atencion.checklist.filter(Boolean).length;
  const total = atencion.checklist.length;
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  const atencionTags = tags.filter(t => atencion.tags.includes(t.id))
    .sort((a, b) => (a.kind === 'estado' ? -1 : 1) - (b.kind === 'estado' ? -1 : 1));

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
