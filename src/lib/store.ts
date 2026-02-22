import { Atencion, KanbanColumn, CriticalItem, NoteItem, DEFAULT_TAGS, Tag, CHECKLIST_ITEMS } from '@/types/qa';

const STORAGE_KEY = 'qa-dashboard-v13';

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

const CK = () => CHECKLIST_ITEMS.map(() => false);

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
    {
      id: '1', code: 'RQ2024-889', tags: ['calidad', 'core'], progress: 100, columnId: 'morales', checklist: CK(), comments: '',
      startDate: '2026-01-26', endDate: '2026-02-14', delayEndDate: '2026-02-17', delayLabel: 'Atrasos Dev - C4',
      timelineNote: 'Termino UAT, falta regularizar docs', sortOrder: 1,
      cycles: [
        { id: 'c1-1', label: 'C1', startDate: '2026-01-26', endDate: '2026-01-30', realStartDate: '2026-01-26' },
        { id: 'c1-2', label: 'C2', startDate: '2026-01-31', endDate: '2026-02-05', realStartDate: '2026-02-01' },
        { id: 'c1-3', label: 'C3', startDate: '2026-02-06', endDate: '2026-02-10', realStartDate: '2026-02-06' },
        { id: 'c1-4', label: 'C4', startDate: '2026-02-11', endDate: '2026-02-14', realEndDate: '2026-02-17', delayLabel: 'Atrasos Dev', realStartDate: '2026-02-12' },
      ],
    },
    {
      id: '2', code: 'RQ2024-887', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CK(), comments: '',
      startDate: '2026-01-27', endDate: '2026-02-14', delayEndDate: '2026-02-19', delayLabel: 'Atraso Entrega Dev',
      timelineNote: 'A la espera de desarrollo para iniciar C4', sortOrder: 2,
      cycles: [
        { id: 'c2-1', label: 'C1', startDate: '2026-01-27', endDate: '2026-02-03', realStartDate: '2026-01-27' },
        { id: 'c2-2', label: 'C2', startDate: '2026-02-04', endDate: '2026-02-10', realStartDate: '2026-02-05' },
        { id: 'c2-3', label: 'C3', startDate: '2026-02-11', endDate: '2026-02-14', realEndDate: '2026-02-19', delayLabel: 'Atraso Dev', realStartDate: '2026-02-12' },
      ],
    },
    {
      id: '3', code: 'RQ2024-960', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CK(), comments: '',
      startDate: '2026-02-10', endDate: '2026-02-28',
      timelineNote: 'A la espera que dev entregue para iniciar C1', sortOrder: 3,
      cycles: [
        { id: 'c3-1', label: 'C1', startDate: '2026-02-10', endDate: '2026-02-20' },
        { id: 'c3-2', label: 'C2', startDate: '2026-02-21', endDate: '2026-02-28' },
      ],
    },
    {
      id: '4', code: 'RQ2024-961', tags: ['desarrollo', 'core'], progress: 100, columnId: 'munoz', checklist: CK(), comments: '',
      startDate: '2026-01-20', endDate: '2026-02-17', delayEndDate: '2026-02-20', delayLabel: 'Atrasos Dev - C2',
      timelineNote: 'A la espera que dev entregue para iniciar C1', sortOrder: 0,
      cycles: [
        { id: 'c4-1', label: 'C1', startDate: '2026-01-20', endDate: '2026-02-02', realStartDate: '2026-01-20' },
        { id: 'c4-2', label: 'C2', startDate: '2026-02-03', endDate: '2026-02-17', realEndDate: '2026-02-20', delayLabel: 'Atrasos Dev', realStartDate: '2026-02-04' },
      ],
    },
    {
      id: '5', code: 'RQ2024-962', tags: ['desarrollo', 'core'], progress: 100, columnId: 'morales', checklist: CK(), comments: '',
      startDate: '2026-02-05', endDate: '2026-02-28',
      timelineNote: 'En ejecución de pruebas - C1 (Soporte Oscco)', sortOrder: 4,
      cycles: [
        { id: 'c5-1', label: 'C1', startDate: '2026-02-05', endDate: '2026-02-18', realStartDate: '2026-02-05' },
        { id: 'c5-2', label: 'C2', startDate: '2026-02-19', endDate: '2026-02-28' },
      ],
    },
    {
      id: '6', code: 'RQ2026-4', tags: ['calidad', 'core'], progress: 100, columnId: 'ortiz', checklist: CK(), comments: '',
      startDate: '2026-01-27', endDate: '2026-02-17', delayEndDate: '2026-02-24', delayLabel: 'Atrasos Dev - C2',
      timelineNote: 'A la espera que dev entregue para iniciar C2', sortOrder: 5,
      cycles: [
        { id: 'c6-1', label: 'C1', startDate: '2026-01-27', endDate: '2026-02-09', realStartDate: '2026-01-27' },
        { id: 'c6-2', label: 'C2', startDate: '2026-02-10', endDate: '2026-02-17', realEndDate: '2026-02-24', delayLabel: 'Atrasos Dev', realStartDate: '2026-02-11' },
      ],
    },
    {
      id: '7', code: 'RQ2026-7', tags: ['calidad', 'sap'], progress: 100, columnId: 'ortiz', checklist: CK(), comments: '',
      startDate: '2026-02-10', endDate: '2026-02-28', sortOrder: 6,
      cycles: [
        { id: 'c7-1', label: 'C1', startDate: '2026-02-10', endDate: '2026-02-20' },
        { id: 'c7-2', label: 'C2', startDate: '2026-02-21', endDate: '2026-02-28' },
      ],
    },
    {
      id: '8', code: 'RQ2026-914', tags: ['calidad', 'sap'], progress: 100, columnId: 'remaining', checklist: CK(), comments: '',
      startDate: '2026-02-10', endDate: '2026-02-28', sortOrder: 7,
      cycles: [
        { id: 'c8-1', label: 'C1', startDate: '2026-02-10', endDate: '2026-02-19' },
        { id: 'c8-2', label: 'C2', startDate: '2026-02-20', endDate: '2026-02-28' },
      ],
    },
    {
      id: '9', code: 'RQ2026-982', tags: ['calidad'], progress: 100, columnId: 'remaining', checklist: CK(), comments: '',
      startDate: '2026-02-17', endDate: '2026-03-20', sortOrder: 8,
      cycles: [
        { id: 'c9-1', label: 'C1', startDate: '2026-02-17', endDate: '2026-03-05' },
        { id: 'c9-2', label: 'C2', startDate: '2026-03-06', endDate: '2026-03-20' },
      ],
    },
    {
      id: '10', code: 'RQ2026-34', tags: ['calidad', 'sap', 'dl'], progress: 100, columnId: 'remaining', checklist: CK(), comments: '',
      startDate: '2026-02-23', endDate: '2026-03-10', sortOrder: 9,
      cycles: [
        { id: 'c10-1', label: 'C1', startDate: '2026-02-23', endDate: '2026-03-03' },
        { id: 'c10-2', label: 'C2', startDate: '2026-03-04', endDate: '2026-03-10' },
      ],
    },
    {
      id: '11', code: 'RQ2026-2', tags: ['desarrollo'], progress: 100, columnId: 'remaining', checklist: CK(), comments: '',
      startDate: '2026-02-25', endDate: '2026-03-12', sortOrder: 10,
      cycles: [
        { id: 'c11-1', label: 'C1', startDate: '2026-02-25', endDate: '2026-03-05' },
        { id: 'c11-2', label: 'C2', startDate: '2026-03-06', endDate: '2026-03-12' },
      ],
    },
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

export function loadState(): DashboardState {
  const app = loadAppState();
  const tab = app.tabs.find(t => t.id === app.activeTabId);
  return tab?.state ?? defaultDashboard;
}

export function saveState(_state: DashboardState) {
  // no-op, handled by AppState now
}
