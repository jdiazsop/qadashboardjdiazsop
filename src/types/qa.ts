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

export interface TestCycle {
  id: string;
  label: string;
  startDate?: string;
  endDate?: string;
  delayStartDate?: string;
  delayEndDate?: string;
  realStartDate?: string;
  delayLabel?: string;
}

export interface Atencion {
  id: string;
  code: string;
  tags: string[];
  progress: number;
  columnId: string;
  checklist: boolean[];
  comments: string;
  /** Global planned start (auto-calculated from cycles or manual override) */
  startDate?: string;
  /** Global planned end (auto-calculated from cycles or manual override) */
  endDate?: string;
  /** @deprecated Use delayEndDate computed from cycles */
  delayStartDate?: string;
  /** Global delay end (auto-calculated from cycles or manual override) */
  delayEndDate?: string;
  /** Global real start date marker */
  realStartDate?: string;
  delayLabel?: string;
  timelineNote?: string;
  barLabel?: string;
  /** Manual sort order within timeline (lower = higher) */
  sortOrder?: number;
  /** Testing cycles */
  cycles?: TestCycle[];
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

/** Compute global dates from cycles (min start, max end, max delay end) */
export function computeDatesFromCycles(cycles: TestCycle[]): { startDate?: string; endDate?: string; delayEndDate?: string } {
  const starts = cycles.map(c => c.startDate).filter(Boolean) as string[];
  const ends = cycles.map(c => c.endDate).filter(Boolean) as string[];
  const delayEnds = cycles.map(c => c.delayEndDate).filter(Boolean) as string[];

  return {
    startDate: starts.length > 0 ? starts.sort()[0] : undefined,
    endDate: ends.length > 0 ? ends.sort().reverse()[0] : undefined,
    delayEndDate: delayEnds.length > 0 ? delayEnds.sort().reverse()[0] : undefined,
  };
}
