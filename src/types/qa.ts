export interface Tag {
  id: string;
  label: string;
  color: 'calidad' | 'sap' | 'core' | 'desarrollo' | 'dl' | 'rend';
}

export const DEFAULT_TAGS: Tag[] = [
  { id: 'calidad', label: 'Calidad', color: 'calidad' },
  { id: 'sap', label: 'SAP', color: 'sap' },
  { id: 'core', label: 'CORE', color: 'core' },
  { id: 'desarrollo', label: 'Desarrollo', color: 'desarrollo' },
  { id: 'dl', label: 'DL', color: 'dl' },
  { id: 'rend', label: 'Rendimiento', color: 'rend' },
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
