import { Atencion, KanbanColumn, CriticalItem, NoteItem, DEFAULT_TAGS, Tag, CHECKLIST_ITEMS } from '@/types/qa';

const STORAGE_KEY = 'qa-dashboard';

export interface DashboardState {
  columns: KanbanColumn[];
  atenciones: Atencion[];
  criticalItems: CriticalItem[];
  notes: NoteItem[];
  tags: Tag[];
}

const defaultState: DashboardState = {
  columns: [
    { id: 'remaining', title: 'Remaining' },
    { id: 'munoz', title: 'Muñoz' },
    { id: 'alejandro', title: 'Alejandro' },
    { id: 'ortiz', title: 'Ortiz' },
    { id: 'morales', title: 'Morales' },
    { id: 'completado', title: 'Completado (UAT + Rend + EH)' },
  ],
  atenciones: [
    { id: '1', code: 'RQ2026-34', tags: ['calidad', 'sap', 'dl'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-01-27', endDate: '2025-02-14' },
    { id: '2', code: 'RQ2025-914', tags: ['calidad', 'sap'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-02-10', endDate: '2025-02-28' },
    { id: '3', code: 'RQ2025-982', tags: ['calidad', 'sap'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-02-17', endDate: '2025-03-20' },
    { id: '4', code: 'RQ2024-961', tags: ['calidad', 'core'], progress: 100, columnId: 'munoz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-01-20', endDate: '2025-02-17', timelineNote: 'Atrasos Dev - C2' },
    { id: '5', code: 'RQ2026-4', tags: ['calidad', 'core'], progress: 100, columnId: 'ortiz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-01-27', endDate: '2025-02-17', timelineNote: 'Atrasos Dev - C2' },
    { id: '6', code: 'RQ2024-889', tags: ['calidad', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-01-27', endDate: '2025-02-10', timelineNote: 'Atrasos Dev - C4' },
    { id: '7', code: 'RQ2024-960', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-02-10', endDate: '2025-02-24' },
    { id: '8', code: 'RQ2026-7', tags: ['calidad', 'sap'], progress: 100, columnId: 'ortiz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-02-12', endDate: '2025-02-28' },
    { id: '9', code: 'RQ2024-887', tags: ['desarrollo'], progress: 100, columnId: 'munoz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-01-20', endDate: '2025-02-14', timelineNote: 'Atraso Entrega Dev' },
    { id: '10', code: 'RQ2024-962', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2025-02-05', endDate: '2025-02-28' },
  ],
  criticalItems: [
    { id: '1', text: 'DL: Culminar la generación de data, 65%, Morales', done: false },
    { id: '2', text: 'Transferencia de Conocimiento de Jorge por vacas', done: false },
    { id: '3', text: 'Realizar la revisión de pares de todas las atenciones - Resp: Deisy', done: false },
    { id: '4', text: 'Revisión de entregables - Resp: Wilfredo + Deisy', done: false },
  ],
  notes: [
    { id: '1', text: 'Termino UAT, falta regularizar docs', createdAt: new Date().toISOString() },
    { id: '2', text: 'A la espera de desarrollo para iniciar C4', createdAt: new Date().toISOString() },
  ],
  tags: DEFAULT_TAGS,
};

export function loadState(): DashboardState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultState;
}

export function saveState(state: DashboardState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
