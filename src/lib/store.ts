import { Atencion, KanbanColumn, CriticalItem, NoteItem, DEFAULT_TAGS, Tag, CHECKLIST_ITEMS } from '@/types/qa';

const STORAGE_KEY = 'qa-dashboard-v7';

export interface DashboardState {
  columns: KanbanColumn[];
  atenciones: Atencion[];
  criticalItems: CriticalItem[];
  notes: NoteItem[];
  tags: Tag[];
}

export interface ProjectTab {
  id: string;
  name: string;
  state: DashboardState;
}

export interface AppState {
  tabs: ProjectTab[];
  activeTabId: string;
}

const defaultDashboard: DashboardState = {
  columns: [
    { id: 'remaining', title: 'Remaining' },
    { id: 'munoz', title: 'Muñoz' },
    { id: 'alejandro', title: 'Alejandro' },
    { id: 'ortiz', title: 'Ortiz' },
    { id: 'morales', title: 'Morales' },
    { id: 'completado', title: 'Completado (UAT + Rend + EH)' },
  ],
  atenciones: [
    { id: '1', code: 'RQ2024-889', tags: ['calidad', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-01-26', endDate: '2026-02-10', delayEndDate: '2026-02-17', delayLabel: 'Atrasos Dev - C4', timelineNote: 'Termino UAT, falta regularizar docs', sortOrder: 1 },
    { id: '2', code: 'RQ2024-887', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-01-27', endDate: '2026-02-14', delayEndDate: '2026-02-19', delayLabel: 'Atraso Entrega Dev', timelineNote: 'A la espera de desarrollo para iniciar C4', sortOrder: 2 },
    { id: '3', code: 'RQ2024-960', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-10', endDate: '2026-02-28', timelineNote: 'A la espera que dev entregue para iniciar C1', sortOrder: 3 },
    { id: '4', code: 'RQ2024-961', tags: ['desarrollo', 'core'], progress: 100, columnId: 'munoz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-01-20', endDate: '2026-02-17', delayEndDate: '2026-02-20', delayLabel: 'Atrasos Dev - C2', timelineNote: 'A la espera que dev entregue para iniciar C1', sortOrder: 0 },
    { id: '5', code: 'RQ2024-962', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-05', endDate: '2026-02-28', timelineNote: 'En ejecución de pruebas - C1 (Soporte Oscco)', sortOrder: 4 },
    { id: '6', code: 'RQ2026-4', tags: ['calidad', 'core'], progress: 100, columnId: 'ortiz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-01-27', endDate: '2026-02-17', delayEndDate: '2026-02-24', delayLabel: 'Atrasos Dev - C2', timelineNote: 'A la espera que dev entregue para iniciar C2', sortOrder: 5 },
    { id: '7', code: 'RQ2026-7', tags: ['calidad', 'sap'], progress: 100, columnId: 'ortiz', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-10', endDate: '2026-02-28', sortOrder: 6 },
    { id: '8', code: 'RQ2026-914', tags: ['calidad', 'sap'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-10', endDate: '2026-02-28', sortOrder: 7 },
    { id: '9', code: 'RQ2026-982', tags: ['calidad'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-17', endDate: '2026-03-20', sortOrder: 8 },
    { id: '10', code: 'RQ2026-34', tags: ['calidad', 'sap', 'dl'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-23', endDate: '2026-03-10', sortOrder: 9 },
    { id: '11', code: 'RQ2026-2', tags: ['desarrollo'], progress: 100, columnId: 'remaining', checklist: CHECKLIST_ITEMS.map(() => false), comments: '', startDate: '2026-02-25', endDate: '2026-03-12', sortOrder: 10 },
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

const defaultAppState: AppState = {
  tabs: [
    { id: 'finanzas', name: 'BC Finanzas', state: defaultDashboard },
  ],
  activeTabId: 'finanzas',
};

export function loadAppState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: AppState = JSON.parse(saved);
      // Always use fresh tags from code
      return {
        ...parsed,
        tabs: parsed.tabs.map(tab => ({
          ...tab,
          state: { ...tab.state, tags: DEFAULT_TAGS },
        })),
      };
    }
  } catch {}
  return defaultAppState;
}

export function saveAppState(appState: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Legacy compat
export function loadState(): DashboardState {
  const app = loadAppState();
  const tab = app.tabs.find(t => t.id === app.activeTabId);
  return tab?.state ?? defaultDashboard;
}

export function saveState(_state: DashboardState) {
  // no-op, handled by AppState now
}
