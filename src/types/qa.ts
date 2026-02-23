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

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistPhase {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export const DEFAULT_CHECKLIST_PHASES: ChecklistPhase[] = [
  {
    id: 'desarrollo',
    name: 'En Desarrollo',
    items: [
      { id: 'd1', label: 'Plan de pruebas' },
      { id: 'd2', label: 'Estimación' },
      { id: 'd3', label: 'Matriz de cobertura' },
      { id: 'd4', label: 'Matriz EH - LT' },
      { id: 'd5', label: 'Checklist de rendimiento (Alta o Baja)' },
      { id: 'd6', label: 'Acta de Reunión de entendimiento de rendimiento' },
      { id: 'd7', label: 'Acta de Reunión de entendimiento (funcional/técnica)' },
      { id: 'd8', label: 'Acta de Reunión (Reunión extraordinarias - Acuerdos, cambios de alcance, etc)' },
      { id: 'd9', label: 'Conformidad Estimación y Plan de Pruebas' },
      { id: 'd10', label: 'Conformidad de las revisiones de pares' },
      { id: 'd11', label: 'Checklist de revisión de calidad' },
    ],
  },
  {
    id: 'post-pruebas',
    name: 'Post Pruebas',
    items: [
      { id: 'p1', label: 'Informe de pruebas' },
      { id: 'p2', label: 'Acta de conformidad de pruebas' },
      { id: 'p3', label: 'Matriz de trazabilidad actualizada' },
    ],
  },
];

/** Legacy static items for backward compatibility */
export const CHECKLIST_ITEMS = DEFAULT_CHECKLIST_PHASES[0].items.map(i => i.label);

export interface TestCycle {
  id: string;
  label: string;
  startDate?: string;
  endDate?: string;
  realStartDate?: string;
  /** Actual end date — if it exceeds endDate, the difference is delay */
  realEndDate?: string;
  delayLabel?: string;
  note?: string;
  /** Whether this cycle is marked as completed */
  completed?: boolean;
}

export interface AtencionStatus {
  conforme?: number;
  enProceso?: number;
  pendientes?: number;
  bloqueados?: number;
  defectos?: number;
}

export interface Atencion {
  id: string;
  code: string;
  tags: string[];
  progress: number;
  columnId: string;
  /** Free-text description */
  description?: string;
  /** Application name */
  aplicativo?: string;
  /** Jira status */
  estadoJira?: string;
  /** Total CPs (casos de prueba) */
  totalCPs?: number;
  checklist: boolean[];
  /** Checklist keyed by item IDs: true = done, false = pending, 'na' = not applicable */
  checklistMap?: Record<string, boolean | 'na'>;
  comments: string;
  /** Performance comment */
  performanceComment?: string;
  /** Security comment */
  securityComment?: string;
  /** Status counters */
  status?: AtencionStatus;
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
  /** Date when this atencion goes to production */
  productionDate?: string;
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

/** Compute delay for a single cycle: if realEndDate > endDate, delay = realEndDate */
export function computeCycleDelay(cycle: TestCycle): string | undefined {
  if (cycle.realEndDate && cycle.endDate && cycle.realEndDate > cycle.endDate) {
    return cycle.realEndDate;
  }
  return undefined;
}

/** Compute global dates from cycles (min start, max end, max delay end derived from realEndDate > endDate) */
export function computeDatesFromCycles(cycles: TestCycle[]): { startDate?: string; endDate?: string; delayEndDate?: string; delayLabel?: string } {
  const starts = cycles.map(c => c.startDate).filter(Boolean) as string[];
  const ends = cycles.map(c => c.endDate).filter(Boolean) as string[];
  
  // Delay is derived: for each cycle, if realEndDate > endDate, that's the delay end
  const delayEnds = cycles
    .map(c => computeCycleDelay(c))
    .filter(Boolean) as string[];

  // Auto-generate global delayLabel from cycles that have delays
  const delayLabels = cycles
    .filter(c => computeCycleDelay(c))
    .map(c => {
      const base = c.delayLabel ? `${c.label}: ${c.delayLabel}` : `Atraso ${c.label}`;
      return base;
    });

  return {
    startDate: starts.length > 0 ? starts.sort()[0] : undefined,
    endDate: ends.length > 0 ? ends.sort().reverse()[0] : undefined,
    delayEndDate: delayEnds.length > 0 ? delayEnds.sort().reverse()[0] : undefined,
    delayLabel: delayLabels.length > 0 ? delayLabels.join(' | ') : undefined,
  };
}
