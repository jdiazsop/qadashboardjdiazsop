export interface Tag {
  id: string;
  label: string;
  color: 'calidad' | 'sap' | 'core' | 'desarrollo' | 'dl' | 'rend';
  /** 'estado' = state tag (Calidad, Desarrollo), 'tipo' = test type tag (SAP, CORE, DL, Rend) */
  kind?: 'estado' | 'tipo';
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'calidad', label: 'En Calidad', color: 'calidad', kind: 'estado' },
  { id: 'sap', label: 'SAP', color: 'sap', kind: 'tipo' },
  { id: 'core', label: 'CORE', color: 'core', kind: 'tipo' },
  { id: 'desarrollo', label: 'En Desarrollo', color: 'desarrollo', kind: 'estado' },
  { id: 'dl', label: 'DL', color: 'dl', kind: 'tipo' },
  { id: 'rend', label: 'Rendimiento', color: 'rend', kind: 'tipo' },
];

export const CHECKLIST_ITEMS = [
  'Plan de pruebas',
  'Estimación',
  'Matriz de cobertura',
  'Matriz EH - LT',
  'Checklist de rendimiento (Alta o Baja)',
  'Acta de Reunión de entendimiento de rendimiento',
  'Acta de Reunión de entendimiento (funcional/técnica)',
  'Acta de Reunión (Reunión extraordinarias - Acuerdos, cambios de alcance, etc)',
  'Conformidad Estimación y Plan de Pruebas',
  'Conformidad de las revisiones de pares',
  'Checklist de revisión de calidad',
];

export interface Atencion {
  id: string;
  code: string;
  tags: string[];
  progress: number;
  columnId: string;
  checklist: boolean[];
  comments: string;
  startDate?: string;
  endDate?: string;
  delayStartDate?: string;
  delayEndDate?: string;
  timelineNote?: string;
  barLabel?: string;
  delayLabel?: string;
  /** Manual sort order within timeline (lower = higher) */
  sortOrder?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
}

export interface CriticalItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}
