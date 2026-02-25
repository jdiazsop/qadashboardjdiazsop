export const CYCLE_LABEL_OPTIONS = [
  'Análisis y Diseño',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'UAT',
  'Rendimiento',
] as const;

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
  /** Total CPs for this cycle */
  totalCPs?: number;
  /** Status counters for this cycle */
  status?: AtencionStatus;
}

/** Get the current (latest) Cx cycle from a list of cycles */
export function getCurrentCxCycle(cycles: TestCycle[]): TestCycle | undefined {
  const cxPattern = /^C(\d+)$/i;
  const cxCycles = cycles
    .filter(c => cxPattern.test(c.label.trim()))
    .map(c => ({ cycle: c, num: parseInt(c.label.trim().match(cxPattern)![1]) }))
    .sort((a, b) => a.num - b.num);
  return cxCycles.length > 0 ? cxCycles[cxCycles.length - 1].cycle : undefined;
}

export interface AtencionStatus {
  conforme?: number;
  enProceso?: number;
  pendientes?: number;
  bloqueados?: number;
  defectos?: number;
}

export const ESTIMATION_TASK_LABELS = [
  'Análisis de Pruebas',
  'Diseño de Pruebas',
  'Despliegue',
  'Generación de Data',
  'Pruebas de Humo',
  'Ejecución C1',
  'Ejecución C2',
  'Ejecución C3',
  'UAT',
  'Cierre / Post Producción',
] as const;

export interface EstimationTask {
  id: string;
  label: string;
  hours: number;
  /** Computed: adjusted hours after dividing by qaCount */
  adjustedHours?: number;
  /** Computed start date */
  computedStart?: string;
  /** Computed end date */
  computedEnd?: string;
}

export interface DateEstimation {
  startDate: string;
  qaCount: number;
  hoursPerDay: number;
  tasks: EstimationTask[];
}

export function createDefaultEstimation(): DateEstimation {
  return {
    startDate: new Date().toISOString().slice(0, 10),
    qaCount: 1,
    hoursPerDay: 9,
    tasks: ESTIMATION_TASK_LABELS.map((label, i) => ({
      id: `est-${i}`,
      label,
      hours: 0,
    })),
  };
}

/** Peru public holidays (fixed + approximate movable ones for 2024-2027) */
export function getPeruHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`, // Año Nuevo
    `${year}-05-01`, // Día del Trabajo
    `${year}-06-07`, // Batalla de Arica  
    `${year}-06-29`, // San Pedro y San Pablo
    `${year}-07-23`, // Día de la Fuerza Aérea
    `${year}-07-28`, // Fiestas Patrias
    `${year}-07-29`, // Fiestas Patrias
    `${year}-08-06`, // Batalla de Junín
    `${year}-08-30`, // Santa Rosa de Lima
    `${year}-10-08`, // Combate de Angamos
    `${year}-11-01`, // Día de Todos los Santos
    `${year}-12-08`, // Inmaculada Concepción
    `${year}-12-09`, // Batalla de Ayacucho
    `${year}-12-25`, // Navidad
  ];
  // Semana Santa (approximate - Thursday + Friday before Easter)
  const easterDates: Record<number, string[]> = {
    2024: ['2024-03-28', '2024-03-29'],
    2025: ['2025-04-17', '2025-04-18'],
    2026: ['2026-04-02', '2026-04-03'],
    2027: ['2027-03-25', '2027-03-26'],
  };
  const easter = easterDates[year] || [];
  return new Set([...fixed, ...easter]);
}

export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  const iso = date.toISOString().slice(0, 10);
  return !holidays.has(iso);
}

/** Add business hours starting from a date, returns { start, end } business dates */
export function computeBusinessDates(
  startDate: Date,
  hours: number,
  hoursPerDay: number,
  holidays: Set<string>
): { start: string; end: string } {
  const safeHpd = Math.max(0.5, hoursPerDay || 9);
  const safeHours = Math.min(Math.max(0, hours || 0), 10000);

  if (isNaN(startDate.getTime())) {
    return { start: '—', end: '—' };
  }
  if (safeHours <= 0) {
    const fmt = startDate.toISOString().slice(0, 10);
    return { start: fmt, end: fmt };
  }
  // Find first business day >= startDate (max 30 days skip)
  let current = new Date(startDate);
  let guard = 0;
  while (!isBusinessDay(current, holidays) && guard < 30) {
    current.setDate(current.getDate() + 1);
    guard++;
  }
  const startIso = current.toISOString().slice(0, 10);
  
  let remainingHours = safeHours;
  let maxIter = 5000;
  while (remainingHours > safeHpd && maxIter > 0) {
    remainingHours -= safeHpd;
    current.setDate(current.getDate() + 1);
    guard = 0;
    while (!isBusinessDay(current, holidays) && guard < 30) {
      current.setDate(current.getDate() + 1);
      guard++;
    }
    maxIter--;
  }
  const endIso = current.toISOString().slice(0, 10);
  return { start: startIso, end: endIso };
}

/** Compute all estimation task dates sequentially */
export function computeEstimation(estimation: DateEstimation): EstimationTask[] {
  const start = new Date(estimation.startDate + 'T12:00:00');
  if (isNaN(start.getTime())) {
    // Invalid start date – return tasks without computed dates
    return estimation.tasks.map(task => ({
      ...task,
      adjustedHours: 0,
      computedStart: '—',
      computedEnd: '—',
    }));
  }
  const qaCount = Math.max(1, estimation.qaCount);
  const hoursPerDay = estimation.hoursPerDay || 9;
  
  // Collect holidays for relevant years
  const holidays = new Set<string>();
  for (let y = start.getFullYear(); y <= start.getFullYear() + 2; y++) {
    getPeruHolidays(y).forEach(h => holidays.add(h));
  }
  
  let cursor = new Date(start);
  return estimation.tasks.map(task => {
    const adjustedHours = Math.ceil(task.hours / qaCount * 10) / 10;
    if (isNaN(cursor.getTime())) {
      return { ...task, adjustedHours, computedStart: '—', computedEnd: '—' };
    }
    if (adjustedHours <= 0) {
      const fmt = cursor.toISOString().slice(0, 10);
      return { ...task, adjustedHours, computedStart: fmt, computedEnd: fmt };
    }
    const { start: cs, end: ce } = computeBusinessDates(cursor, adjustedHours, hoursPerDay, holidays);
    const result = { ...task, adjustedHours, computedStart: cs, computedEnd: ce };
    // Move cursor to next business day after end
    const nextCursor = new Date(ce + 'T12:00:00');
    if (!isNaN(nextCursor.getTime())) {
      cursor = nextCursor;
      cursor.setDate(cursor.getDate() + 1);
      while (!isBusinessDay(cursor, holidays)) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return result;
  });
}

export interface Atencion {
  id: string;
  code: string;
  /** Links duplicated cards so edits sync between them */
  sourceId?: string;
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
  /** Order within kanban column */
  cardOrder?: number;
  /** Date estimation data */
  estimation?: DateEstimation;
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
