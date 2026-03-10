import ExcelJS from 'exceljs';
import type { EstimationTask } from '@/types/qa';

/** Safely extract a numeric value from an ExcelJS cell (handles formulas) */
function cellNumber(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) {
    const r = (v as any).result;
    return typeof r === 'number' ? r : (parseFloat(String(r)) || 0);
  }
  return parseFloat(String(v)) || 0;
}

/**
 * Phase header patterns mapped to estimation task labels.
 * EJECUCIÓN is handled specially — it gets split by cycle sub-sections.
 */
const PHASE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^AN[ÁA]LISIS\s+DE\s+PRUEBAS$/i, label: 'Análisis de Pruebas' },
  { pattern: /^DISE[ÑN]O\s+DE\s+PRUEBAS$/i, label: 'Diseño de Pruebas' },
  { pattern: /^DESPLIEGUE$/i, label: 'Despliegue' },
  { pattern: /^GENERACI[ÓO]N\s+DE\s+DATA$/i, label: 'Generación de Data' },
  { pattern: /^PRUEBAS\s+DE\s+HUMO$/i, label: 'Pruebas de Humo' },
  { pattern: /^EJECUCI[ÓO]N$/i, label: '__EJECUCION__' },
  { pattern: /^UAT$/i, label: 'UAT' },
  { pattern: /^CIERRE\s*(\/\s*POST\s*PRODUCCI[ÓO]N)?$/i, label: 'Cierre / Post Producción' },
];

/** Detect if a cell text is a phase header (must be an exact/short match) */
function matchPhase(text: string): string | null {
  const trimmed = text.trim();
  // Phase headers are short standalone labels, skip long task descriptions
  if (trimmed.length > 40) return null;
  for (const p of PHASE_PATTERNS) {
    if (p.pattern.test(trimmed)) return p.label;
  }
  return null;
}

/** Detect execution cycle references like "ciclo 1", "ciclo 2", etc. */
function detectExecutionCycle(text: string): number | null {
  const m = text.match(/ciclo\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

/** Check if a row text looks like "Ejecución del antes" or similar pre-cycle execution */
function isPreCycleExecution(text: string): boolean {
  return /ejecuci[oó]n\s+del?\s+antes/i.test(text);
}

interface ParsedPhase {
  label: string;
  hours: number;
}

export async function parseEstimationExcel(file: File): Promise<EstimationTask[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Try to find the estimation sheet (look for "Estimación" in name, fallback to first)
  let worksheet = workbook.worksheets.find(ws =>
    /estimaci[oó]n/i.test(ws.name)
  ) || workbook.worksheets[0];

  if (!worksheet) throw new Error('No se encontró una hoja válida en el archivo.');

  // Find header row with "Esfuerzo facturable"
  let factCol = -1;
  let noFactCol = -1;
  let taskCol = -1; // Column C typically
  let headerRow = -1;

  worksheet.eachRow((row, rowNumber) => {
    if (headerRow > -1) return;
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim().toLowerCase();
      if (val.includes('esfuerzo facturable') && !val.includes('no facturable') && !val.includes('por recurso')) {
        factCol = colNumber;
        headerRow = rowNumber;
      }
      if (val.includes('esfuerzo no') || val.includes('no facturable')) {
        noFactCol = colNumber;
      }
      if (val.includes('tarea') || val.includes('actividad')) {
        taskCol = colNumber;
      }
    });
  });

  // Fallback columns based on the reference structure
  if (taskCol === -1) taskCol = 3; // Column C
  if (factCol === -1) factCol = 4; // Column D
  if (noFactCol === -1) noFactCol = 5; // Column E

  // Parse rows after header
  const startRow = headerRow > 0 ? headerRow + 1 : 1;
  
  let currentPhase: string | null = null;
  const phases: ParsedPhase[] = [];
  const executionCycles = new Map<number, number>(); // cycleNum -> hours
  let executionBeforeHours = 0;
  let hasExecutionBefore = false;

  for (let r = startRow; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const taskText = String(row.getCell(taskCol).value ?? '').trim();
    
    if (!taskText) continue;

    // Check if this is a TOTAL row — stop
    if (/^TOTAL\s+DE\s+HORAS/i.test(taskText)) break;

    // Check if this is a phase header
    const phase = matchPhase(taskText);
    if (phase) {
      currentPhase = phase;
      continue;
    }

    // Get hours – use cellNumber to handle formula cells correctly
    const factHours = cellNumber(row.getCell(factCol));
    const noFactHours = cellNumber(row.getCell(noFactCol));
    const totalHours = factHours + noFactHours;

    if (totalHours === 0 && !taskText) continue;

    if (currentPhase === '__EJECUCION__') {
      // Check for pre-cycle execution ("Ejecución del antes")
      if (isPreCycleExecution(taskText)) {
        hasExecutionBefore = true;
        executionBeforeHours += totalHours;
        continue;
      }

      // Try to detect which cycle this row belongs to
      const cycleNum = detectExecutionCycle(taskText);
      if (cycleNum !== null) {
        executionCycles.set(cycleNum, (executionCycles.get(cycleNum) ?? 0) + totalHours);
      } else {
        // Row under EJECUCION but no specific cycle detected
        // Try to assign to the last detected cycle
        const lastCycle = Math.max(0, ...executionCycles.keys());
        if (lastCycle > 0) {
          executionCycles.set(lastCycle, (executionCycles.get(lastCycle) ?? 0) + totalHours);
        } else {
          executionBeforeHours += totalHours;
          hasExecutionBefore = true;
        }
      }
    } else if (currentPhase && currentPhase !== '__EJECUCION__') {
      // Accumulate hours for the current non-execution phase
      const existing = phases.find(p => p.label === currentPhase);
      if (existing) {
        existing.hours += totalHours;
      } else {
        phases.push({ label: currentPhase, hours: totalHours });
      }
    } else if (!currentPhase && totalHours > 0) {
      // Rows before any phase header or under unrecognised headers –
      // try to infer phase from the task text itself
      let inferred = false;
      for (const p of PHASE_PATTERNS) {
        if (p.pattern.test(taskText.replace(/\s*-\s*.+$/, '').trim())) {
          const lbl = p.label === '__EJECUCION__' ? 'Ejecución C1' : p.label;
          const existing = phases.find(ph => ph.label === lbl);
          if (existing) existing.hours += totalHours;
          else phases.push({ label: lbl, hours: totalHours });
          inferred = true;
          break;
        }
      }
      // If still unmatched, add to a generic bucket
      if (!inferred) {
        const existing = phases.find(p => p.label === 'Otros');
        if (existing) existing.hours += totalHours;
        else phases.push({ label: 'Otros', hours: totalHours });
      }
    }
  }

  // Build final task list
  const tasks: EstimationTask[] = [];
  let idCounter = 0;

  // Add non-execution phases in order, inserting execution phases at the right spot
  const orderedLabels = [
    'Análisis de Pruebas',
    'Diseño de Pruebas',
    'Despliegue',
    'Generación de Data',
    'Pruebas de Humo',
  ];

  for (const label of orderedLabels) {
    const found = phases.find(p => p.label === label);
    tasks.push({
      id: `est-${idCounter++}`,
      label,
      hours: found?.hours ?? 0,
    });
  }

  // Add execution "antes" if present
  if (hasExecutionBefore && executionBeforeHours > 0) {
    tasks.push({
      id: `est-${idCounter++}`,
      label: 'Ejecución Antes',
      hours: executionBeforeHours,
    });
  }

  // Add execution cycles sorted
  const sortedCycles = [...executionCycles.entries()].sort((a, b) => a[0] - b[0]);
  for (const [cycleNum, hours] of sortedCycles) {
    tasks.push({
      id: `est-${idCounter++}`,
      label: `Ejecución C${cycleNum}`,
      hours,
    });
  }

  // Add UAT and Cierre
  const postExecutionLabels = ['UAT', 'Cierre / Post Producción'];
  for (const label of postExecutionLabels) {
    const found = phases.find(p => p.label === label);
    tasks.push({
      id: `est-${idCounter++}`,
      label,
      hours: found?.hours ?? 0,
    });
  }

  return tasks;
}
