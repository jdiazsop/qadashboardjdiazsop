import { useState } from 'react';
import { NoteItem } from '@/types/qa';
import { StickyNote, Plus, Trash2 } from 'lucide-react';

interface Props {
  notes: NoteItem[];
  onUpdate: (notes: NoteItem[]) => void;
}

export function NotesPanel({ notes, onUpdate }: Props) {
  const [newText, setNewText] = useState('');

  const addNote = () => {
    if (!newText.trim()) return;
    onUpdate([{ id: Date.now().toString(), text: newText.trim(), createdAt: new Date().toISOString() }, ...notes]);
    setNewText('');
  };

  const removeNote = (id: string) => {
    onUpdate(notes.filter(n => n.id !== id));
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-tag-calidad" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Notas</h3>
      </div>

      <div className="flex gap-1.5 mb-3">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Nueva nota..."
          className="flex-1 bg-surface-0 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={e => e.key === 'Enter' && addNote()}
        />
        <button onClick={addNote} className="bg-primary text-primary-foreground rounded px-2 py-1">
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.map(n => (
          <div key={n.id} className="flex items-start gap-2 group bg-surface-2 rounded-lg px-3 py-2">
            <span className="text-xs text-foreground flex-1">{n.text}</span>
            <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
