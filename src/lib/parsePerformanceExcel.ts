import ExcelJS from 'exceljs';
import type { PerformanceAcceptanceCriteria } from '@/types/qa';

/**
 * Resolve a cell value to a plain string, handling hyperlinks, rich text, formulas, etc.
 */
function resolveCellValue(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val == null) return '';

  // Hyperlink object: { text, hyperlink }
  if (typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as any;
    // ExcelJS hyperlink: { text: '...', hyperlink: 'https://...' }
    if (obj.hyperlink) return String(obj.hyperlink).trim();
    // Rich text: { richText: [{ text: '...' }, ...] }
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r: any) => String(r?.text ?? '')).join('').trim();
    }
    // Formula result
    if (obj.result != null) return String(obj.result).trim();
    // SharedString with text property
    if (typeof obj.text === 'string') return obj.text.trim();
  }

  return String(val).trim();
}

/**
 * Parse the performance relevamiento Excel matrix
 * and extract acceptance criteria fields.
 */
export async function parsePerformanceExcel(file: File): Promise<PerformanceAcceptanceCriteria> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const criteria: PerformanceAcceptanceCriteria = {};

  workbook.eachSheet((sheet) => {
    const columnHints = detectColumnHints(sheet);

    sheet.eachRow((row) => {
      const cells: string[] = [];
      const rawCells: ExcelJS.Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rawCells[colNumber] = cell;
        cells[colNumber] = resolveCellValue(cell);
      });

      for (let i = 1; i <= cells.length; i++) {
        const label = normalizeText(cells[i] ?? '');
        if (!label) continue;

        if (label.includes('metodo http') || label === 'metodo') {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.method = value;
        } else if (label.includes('nombre del api') || label.includes('nombre del servicio')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.apiName = value;
        } else if (label.includes('endpoint') || (label.includes('url') && !label.includes('usuario'))) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.endpoint = value;
        } else if (label.includes('usuarios unicos mensuales') || label.includes('n° usuarios unicos')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, true);
          criteria.monthlyUsers = parseNum(value);
        } else if (label.includes('solicitudes promedio por dia') || label.includes('solicitudes promedio por día')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, true);
          criteria.avgDailyRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por hora')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, true);
          criteria.peakHourRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por minuto')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, true);
          criteria.peakMinuteRequests = parseNum(value);
        } else if (label.includes('aplicaciones impactadas') && !label.includes('nombre')) {
          // Could be "N° de aplicaciones impactadas" or "Nro de aplicaciones impactadas" etc.
          if (label.includes('n°') || label.includes('nro') || label.includes('numero') || label.includes('número') || label.includes('n ')) {
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            criteria.impactedApps = parseNum(value);
          } else {
            // Fallback: still try numeric
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            const num = parseNum(value);
            if (num !== undefined) criteria.impactedApps = num;
          }
        } else if (label.includes('nombres de aplicaciones impactadas') || label.includes('nombre de aplicaciones impactadas') || label.includes('nombres de las aplicaciones')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.impactedAppNames = value;
        } else if (label.includes('horario pico') || label.includes('horario de uso pico')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.peakUsageTime = value;
        } else if (label.includes('microservicios involucrados') || label.includes('microservicios')) {
          // Match "N° de microservicios involucrados" or just "Microservicios involucrados"
          if (label.includes('n°') || label.includes('nro') || label.includes('numero') || label.includes('número') || label.includes('n ')) {
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            criteria.microservices = parseNum(value);
          } else {
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            const num = parseNum(value);
            if (num !== undefined) criteria.microservices = num;
            else if (value && !criteria.microservices) {
              // It's text - store as string (convert to number if possible later)
              const fallback = pickBestValue(cells, rawCells, i, columnHints, false);
              if (fallback) {
                const n = parseNum(fallback);
                if (n !== undefined) criteria.microservices = n;
              }
            }
          }
        } else if (label.includes('parametros de entrada') || label.includes('parámetros de entrada')) {
          if (label.includes('n°') || label.includes('nro') || label.includes('numero') || label.includes('número') || label.includes('n ')) {
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            criteria.inputParams = parseNum(value);
          } else {
            const value = pickBestValue(cells, rawCells, i, columnHints, true);
            criteria.inputParams = parseNum(value);
          }
        } else if (label.includes('sla') && (label.includes('tiempo') || label.includes('respuesta'))) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.slaMaxResponse = value;
        } else if (label.includes('tasa maxima de error') || label.includes('tasa máxima de error')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.maxErrorRate = value;
        } else if (label.includes('throughput') && (label.includes('minimo') || label.includes('mínimo'))) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.minThroughput = value;
        } else if (label.includes('volumen de datos')) {
          const value = pickBestValue(cells, rawCells, i, columnHints, false);
          if (value) criteria.dataVolume = value;
        }
      }
    });
  });

  return criteria;
}

type ColumnHints = {
  descriptionCol?: number;
  referenceCol?: number;
};

function detectColumnHints(sheet: ExcelJS.Worksheet): ColumnHints {
  let descriptionCol: number | undefined;
  let referenceCol: number | undefined;

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = normalizeText(String(cell.value ?? ''));
      if (!text) return;

      if (!descriptionCol && text.includes('descripcion')) {
        descriptionCol = colNumber;
      }

      if (!referenceCol && (text.includes('ejemplo de referencia') || text === 'referencia')) {
        referenceCol = colNumber;
      }
    });
  });

  return { descriptionCol, referenceCol };
}

function pickBestValue(cells: string[], rawCells: ExcelJS.Cell[], labelCol: number, hints: ColumnHints, preferNumeric: boolean): string {
  const candidates: Array<{ col: number; value: string }> = [];

  // Priority: reference column first
  if (hints.referenceCol && hints.referenceCol !== labelCol) {
    const val = rawCells[hints.referenceCol] ? resolveCellValue(rawCells[hints.referenceCol]) : (cells[hints.referenceCol] ?? '').trim();
    candidates.push({ col: hints.referenceCol, value: val });
  }

  // Then adjacent columns
  for (const offset of [1, 2, 3]) {
    const col = labelCol + offset;
    if (!col || col >= cells.length + 1) continue;
    const val = rawCells[col] ? resolveCellValue(rawCells[col]) : (cells[col] ?? '').trim();
    candidates.push({ col, value: val });
  }

  const uniqueCandidates = candidates
    .filter((c, idx, arr) => arr.findIndex((x) => x.col === c.col) === idx)
    .filter((c) => c.value.length > 0);

  if (uniqueCandidates.length === 0) return '';

  if (preferNumeric) {
    const numericCandidate = uniqueCandidates.find((c) => parseNum(c.value) !== undefined);
    if (numericCandidate) return numericCandidate.value;
  }

  // Filter out description column
  const filtered = uniqueCandidates.filter((c) => {
    if (hints.descriptionCol && c.col === hints.descriptionCol && uniqueCandidates.length > 1) return false;
    return !isLikelyDescription(c.value, preferNumeric) || uniqueCandidates.length === 1;
  });

  return (filtered[0] ?? uniqueCandidates[0]).value;
}

function isLikelyDescription(value: string, preferNumeric: boolean): boolean {
  const text = normalizeText(value);
  if (!text) return true;

  if (preferNumeric) {
    return parseNum(value) === undefined;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasDigits = /\d/.test(text);
  const descriptionHints = [
    'tipo de', 'direccion completa', 'total de', 'cantidad',
    'porcentaje', 'franja', 'numero de', 'lista de',
    'estructura', 'componentes', 'contacto', 'ambiente', 'limite',
  ];

  return wordCount >= 6 && !hasDigits && descriptionHints.some((hint) => text.includes(hint));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNum(val: string): number | undefined {
  const token = val.replace(/[^\d.,-]/g, '').match(/-?\d[\d.,]*/)?.[0];
  if (!token) return undefined;

  let normalized = token;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = normalized.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? undefined : num;
}
