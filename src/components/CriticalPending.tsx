import { useState } from 'react';
import { CriticalItem } from '@/types/qa';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface Props {
  items: CriticalItem[];
  onUpdate: (items: CriticalItem[]) => void;
}

export function CriticalPending({ items, onUpdate }: Props) {
  const [newText, setNewText] = useState('');

  const addItem = () => {
    if (!newText.trim()) return;
    onUpdate([...items, { id: Date.now().toString(), text: newText.trim(), done: false }]);
    setNewText('');
  };

  const toggle = (id: string) => {
    onUpdate(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const remove = (id: string) => {
    onUpdate(items.filter(i => i.id !== id));
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-destructive">Pendientes Críticos</h3>
      </div>

      <div className="space-y-2 mb-3">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2 group">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              className="mt-1 w-3.5 h-3.5 accent-primary rounded"
            />
            <span className={`text-xs flex-1 ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.text}
            </span>
            <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Nuevo pendiente..."
          className="flex-1 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} className="bg-destructive text-destructive-foreground rounded px-2 py-1">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
